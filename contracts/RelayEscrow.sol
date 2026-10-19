// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RelayEscrow
/// @notice Non-custodial MUSD escrow for RELAY protected checkout on Mezo.
/// @dev The configured token is immutable. There is no administrator and no function that
///      can sweep unrelated balances or change parties, amounts, or deadlines after creation.
///
///      This contract has not been independently audited.
///
///      State machine
///      -------------
///      Created   -> Funded      fundEscrow | fundEscrowAsAgent
///      Created   -> Cancelled   cancelUnfunded
///      Funded    -> Delivered   submitDelivery
///      Funded    -> Refunded    refundAfterMissedDeadline
///      Delivered -> Released    releaseToSeller | releaseAfterReviewWindow
///      Delivered -> Disputed    raiseDispute
///      Disputed  -> Released    resolveDispute(paySeller = true)
///      Disputed  -> Refunded    resolveDispute(paySeller = false)
///      Disputed  -> Split       resolveDisputeSplit
///
///      Released, Refunded, Cancelled, and Split are terminal. A dispute is not cosmetic:
///      only the resolver stored on that escrow can settle it. A full settlement goes to
///      one party. A split pays the seller a stated amount and the buyer the remainder.
///
///      Deadline comparisons (inclusive windows use <= ; "after" uses >)
///      ---------------------------------------------------------------
///      fund:            timestamp <= fundingDeadline
///      submitDelivery:  timestamp <= deliveryDeadline
///      refund:          timestamp >  deliveryDeadline
///      buyer release:   timestamp <= reviewDeadline
///      raiseDispute:    timestamp <= reviewDeadline
///      auto-release:    timestamp >  reviewDeadline
///
///      At the exact delivery deadline the seller can still submit evidence and the buyer
///      cannot yet refund. One second later only the refund path remains.
///      At the exact review deadline the buyer can still release or either party can dispute.
///      Auto-release is available only after that second. A dispute blocks every unilateral path.
///
///      If the buyer does not release or dispute before the review window ends, anyone may
///      call releaseAfterReviewWindow. Funds go only to the seller. The caller is not paid.
///
///      Tokens sent directly to this contract are not credited to an escrow and are not
///      recoverable. There is intentionally no rescue function.
contract RelayEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        Created,
        Funded,
        Delivered,
        Released,
        Refunded,
        Disputed,
        Cancelled,
        Split
    }

    struct Escrow {
        address seller;
        address buyer;
        address resolver;
        uint256 amount;
        uint64 createdAt;
        uint64 fundingDeadline;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        uint32 reviewPeriod;
        State state;
        bytes32 termsHash;
        bytes32 metadataHash;
        bytes32 evidenceHash;
        string metadata;
        string evidence;
    }

    uint8 public constant RELEASE_BUYER_ACCEPTED = 1;
    uint8 public constant RELEASE_REVIEW_WINDOW = 2;
    uint8 public constant RELEASE_DISPUTE = 3;
    uint8 public constant REFUND_MISSED_DELIVERY = 1;
    uint8 public constant REFUND_DISPUTE = 2;

    uint32 public constant MIN_REVIEW_PERIOD = 15 minutes;
    uint32 public constant MAX_REVIEW_PERIOD = 30 days;
    uint64 public constant MIN_DELIVERY_GAP = 1 hours;
    uint64 public constant MAX_HORIZON = 365 days;
    uint256 public constant MAX_METADATA_BYTES = 2048;
    uint256 public constant MAX_EVIDENCE_BYTES = 800;
    uint256 public constant MAX_REASON_BYTES = 280;

    IERC20 public immutable musdToken;

    uint256 public nextEscrowId = 1;
    mapping(uint256 => Escrow) private _escrows;
    /// @notice Remaining MUSD a buyer allows an agent to fund. The agent does not become the buyer.
    mapping(address buyer => mapping(address agent => uint256)) public agentAllowance;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed seller,
        address indexed buyer,
        address resolver,
        uint256 amount,
        uint64 fundingDeadline,
        uint64 deliveryDeadline,
        uint32 reviewPeriod,
        bytes32 termsHash,
        bytes32 metadataHash
    );
    event EscrowFunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event DeliverySubmitted(uint256 indexed escrowId, bytes32 evidenceHash, uint64 reviewDeadline);
    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy, bytes32 reasonHash, string reason);
    event EscrowReleased(uint256 indexed escrowId, address indexed seller, uint256 amount, uint8 reason);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount, uint8 reason);
    event DisputeResolved(uint256 indexed escrowId, address indexed resolver, bool paySeller);
    event EscrowCancelled(uint256 indexed escrowId, address indexed cancelledBy);
    event DisputeSplit(uint256 indexed escrowId, address indexed resolver, uint256 sellerAmount, uint256 buyerAmount);
    event AgentAllowanceSet(address indexed buyer, address indexed agent, uint256 amount);
    event AgentFunded(uint256 indexed escrowId, address indexed agent, address indexed buyer, uint256 amount);

    error ZeroAmount();
    error InvalidAddress();
    error BuyerIsSeller();
    error ResolverIsParty();
    error InvalidDeadline();
    error InvalidReviewPeriod();
    error InvalidMetadata();
    error EscrowNotFound();
    error InvalidState();
    error NotBuyer();
    error NotSeller();
    error NotParty();
    error NotResolver();
    error FundingClosed();
    error DeliveryWindowClosed();
    error ReviewWindowOpen();
    error ReviewWindowClosed();
    error ZeroHash();
    error EvidenceTooLarge();
    error UnexpectedTokenAmount();
    error ReasonInvalid();
    error HashMismatch();
    error SplitAmount();
    error AgentNotAllowed();
    error AgentAllowance();

    constructor(address musd) {
        if (musd == address(0) || musd.code.length == 0) revert InvalidAddress();
        musdToken = IERC20(musd);
    }

    function escrowCount() external view returns (uint256) {
        return nextEscrowId - 1;
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _load(escrowId);
    }

    /// @notice Create an unfunded agreement. The caller is the seller. No tokens move.
    /// @param buyer Use address(0) to let the first eligible funder become the buyer.
    /// @param metadata Canonical agreement JSON. Its keccak256 must equal metadataHash.
    function createEscrow(
        address buyer,
        address resolver,
        uint256 amount,
        uint64 fundingDeadline,
        uint64 deliveryDeadline,
        uint32 reviewPeriod,
        bytes32 termsHash,
        bytes32 metadataHash,
        string calldata metadata
    ) external returns (uint256 escrowId) {
        if (amount == 0) revert ZeroAmount();
        if (resolver == address(0)) revert InvalidAddress();
        if (buyer == msg.sender) revert BuyerIsSeller();
        if (resolver == msg.sender || (buyer != address(0) && resolver == buyer)) revert ResolverIsParty();
        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) revert InvalidReviewPeriod();

        uint256 nowTs = block.timestamp;
        if (fundingDeadline <= nowTs) revert InvalidDeadline();
        if (uint256(deliveryDeadline) < uint256(fundingDeadline) + MIN_DELIVERY_GAP) revert InvalidDeadline();
        if (uint256(fundingDeadline) > nowTs + MAX_HORIZON) revert InvalidDeadline();
        if (uint256(deliveryDeadline) > nowTs + MAX_HORIZON) revert InvalidDeadline();

        uint256 metadataLength = bytes(metadata).length;
        if (metadataLength == 0 || metadataLength > MAX_METADATA_BYTES) revert InvalidMetadata();
        if (termsHash == bytes32(0) || metadataHash == bytes32(0)) revert ZeroHash();
        if (keccak256(bytes(metadata)) != metadataHash) revert HashMismatch();

        escrowId = nextEscrowId++;
        Escrow storage escrow = _escrows[escrowId];
        escrow.seller = msg.sender;
        escrow.buyer = buyer;
        escrow.resolver = resolver;
        escrow.amount = amount;
        escrow.createdAt = uint64(nowTs);
        escrow.fundingDeadline = fundingDeadline;
        escrow.deliveryDeadline = deliveryDeadline;
        escrow.reviewPeriod = reviewPeriod;
        escrow.termsHash = termsHash;
        escrow.metadataHash = metadataHash;
        escrow.metadata = metadata;
        escrow.state = State.Created;

        emit EscrowCreated(
            escrowId,
            msg.sender,
            buyer,
            resolver,
            amount,
            fundingDeadline,
            deliveryDeadline,
            reviewPeriod,
            termsHash,
            metadataHash
        );
    }

    /// @notice Pull the exact MUSD amount into this contract. A restricted buyer cannot be replaced.
    function fundEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Created) revert InvalidState();
        if (block.timestamp > escrow.fundingDeadline) revert FundingClosed();

        if (escrow.buyer != address(0)) {
            if (msg.sender != escrow.buyer) revert NotBuyer();
        } else {
            if (msg.sender == escrow.seller) revert BuyerIsSeller();
            if (msg.sender == escrow.resolver) revert ResolverIsParty();
            escrow.buyer = msg.sender;
        }

        uint256 amount = escrow.amount;
        escrow.state = State.Funded;

        uint256 beforeBal = musdToken.balanceOf(address(this));
        musdToken.safeTransferFrom(msg.sender, address(this), amount);
        if (musdToken.balanceOf(address(this)) - beforeBal != amount) revert UnexpectedTokenAmount();

        emit EscrowFunded(escrowId, msg.sender, amount);
    }

    /// @notice Replace the remaining MUSD this caller allows `agent` to fund on agreements that name the caller as buyer.
    /// @dev Setting the amount to zero revokes the agent. This does not approve MUSD. The buyer must still approve this contract.
    function setAgentAllowance(address agent, uint256 amount) external {
        if (agent == address(0) || agent == msg.sender) revert InvalidAddress();
        agentAllowance[msg.sender][agent] = amount;
        emit AgentAllowanceSet(msg.sender, agent, amount);
    }

    /// @notice Fund an agreement for its stored buyer, spending that buyer's MUSD and the remaining agent budget.
    /// @dev The caller does not become the buyer and cannot release, refund, or dispute. Open invoices are rejected.
    function fundEscrowAsAgent(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Created) revert InvalidState();
        if (block.timestamp > escrow.fundingDeadline) revert FundingClosed();
        if (escrow.buyer == address(0)) revert NotBuyer();
        if (msg.sender == escrow.buyer || msg.sender == escrow.seller || msg.sender == escrow.resolver) revert AgentNotAllowed();

        uint256 amount = escrow.amount;
        uint256 remaining = agentAllowance[escrow.buyer][msg.sender];
        if (remaining < amount) revert AgentAllowance();
        agentAllowance[escrow.buyer][msg.sender] = remaining - amount;
        escrow.state = State.Funded;

        address buyer = escrow.buyer;
        uint256 beforeBal = musdToken.balanceOf(address(this));
        musdToken.safeTransferFrom(buyer, address(this), amount);
        if (musdToken.balanceOf(address(this)) - beforeBal != amount) revert UnexpectedTokenAmount();

        emit EscrowFunded(escrowId, buyer, amount);
        emit AgentFunded(escrowId, msg.sender, buyer, amount);
    }

    /// @notice Seller commits a canonical evidence document before the delivery deadline.
    function submitDelivery(uint256 escrowId, bytes32 evidenceHash, string calldata evidence) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.seller) revert NotSeller();
        if (escrow.state != State.Funded) revert InvalidState();
        if (block.timestamp > escrow.deliveryDeadline) revert DeliveryWindowClosed();
        if (evidenceHash == bytes32(0)) revert ZeroHash();

        uint256 evidenceLength = bytes(evidence).length;
        if (evidenceLength == 0 || evidenceLength > MAX_EVIDENCE_BYTES) revert EvidenceTooLarge();
        if (keccak256(bytes(evidence)) != evidenceHash) revert HashMismatch();

        uint64 reviewDeadline = uint64(block.timestamp) + escrow.reviewPeriod;
        escrow.evidenceHash = evidenceHash;
        escrow.evidence = evidence;
        escrow.reviewDeadline = reviewDeadline;
        escrow.state = State.Delivered;

        emit DeliverySubmitted(escrowId, evidenceHash, reviewDeadline);
    }

    /// @notice Buyer accepts delivery and releases the full amount to the seller.
    function releaseToSeller(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.buyer) revert NotBuyer();
        if (escrow.state != State.Delivered) revert InvalidState();
        if (block.timestamp > escrow.reviewDeadline) revert ReviewWindowClosed();
        _release(escrow, escrowId, RELEASE_BUYER_ACCEPTED);
    }

    /// @notice After the review window, finalize payment to the seller. The caller receives nothing.
    function releaseAfterReviewWindow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Delivered) revert InvalidState();
        if (block.timestamp <= escrow.reviewDeadline) revert ReviewWindowOpen();
        _release(escrow, escrowId, RELEASE_REVIEW_WINDOW);
    }

    /// @notice Buyer refund when the delivery deadline passed and no delivery was recorded.
    function refundAfterMissedDeadline(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.buyer) revert NotBuyer();
        if (escrow.state != State.Funded) revert InvalidState();
        if (block.timestamp <= escrow.deliveryDeadline) revert DeliveryWindowClosed();
        _refund(escrow, escrowId, REFUND_MISSED_DELIVERY);
    }

    /// @notice Buyer or seller can freeze unilateral settlement during the review window.
    /// @dev `reason` is public calldata and is emitted. Do not include secrets or personal data.
    function raiseDispute(uint256 escrowId, bytes32 reasonHash, string calldata reason) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) revert NotParty();
        if (escrow.state != State.Delivered) revert InvalidState();
        if (block.timestamp > escrow.reviewDeadline) revert ReviewWindowClosed();

        uint256 reasonLength = bytes(reason).length;
        if (reasonHash == bytes32(0) || reasonLength == 0 || reasonLength > MAX_REASON_BYTES) revert ReasonInvalid();
        if (keccak256(bytes(reason)) != reasonHash) revert HashMismatch();

        escrow.state = State.Disputed;
        emit DisputeRaised(escrowId, msg.sender, reasonHash, reason);
    }

    /// @notice Designated resolver settles a disputed escrow for the full amount to one party.
    /// @param paySeller True releases to the seller. False refunds the buyer.
    function resolveDispute(uint256 escrowId, bool paySeller) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.resolver) revert NotResolver();
        if (escrow.state != State.Disputed) revert InvalidState();

        emit DisputeResolved(escrowId, msg.sender, paySeller);
        if (paySeller) {
            _release(escrow, escrowId, RELEASE_DISPUTE);
        } else {
            _refund(escrow, escrowId, REFUND_DISPUTE);
        }
    }

    /// @notice True when this deployment can split a disputed amount between seller and buyer.
    function partialSettlementSupported() external pure returns (bool) {
        return true;
    }

    /// @notice Resolver splits a disputed escrow. The seller receives `sellerAmount` and the buyer receives the remainder.
    /// @dev Neither side may receive the full amount through this function. Use `resolveDispute` for a full release or refund.
    function resolveDisputeSplit(uint256 escrowId, uint256 sellerAmount) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.resolver) revert NotResolver();
        if (escrow.state != State.Disputed) revert InvalidState();
        if (sellerAmount == 0 || sellerAmount >= escrow.amount) revert SplitAmount();

        address buyer = escrow.buyer;
        if (buyer == address(0)) revert InvalidAddress();
        address seller = escrow.seller;
        uint256 buyerAmount = escrow.amount - sellerAmount;
        escrow.state = State.Split;

        emit DisputeSplit(escrowId, msg.sender, sellerAmount, buyerAmount);
        musdToken.safeTransfer(seller, sellerAmount);
        musdToken.safeTransfer(buyer, buyerAmount);
    }

    /// @notice Seller can cancel before funding. Anyone can cancel an unfunded escrow after the funding deadline.
    function cancelUnfunded(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Created) revert InvalidState();
        if (msg.sender != escrow.seller && block.timestamp <= escrow.fundingDeadline) revert InvalidState();
        escrow.state = State.Cancelled;
        emit EscrowCancelled(escrowId, msg.sender);
    }

    function _release(Escrow storage escrow, uint256 escrowId, uint8 reason) private {
        address seller = escrow.seller;
        uint256 amount = escrow.amount;
        escrow.state = State.Released;
        musdToken.safeTransfer(seller, amount);
        emit EscrowReleased(escrowId, seller, amount, reason);
    }

    function _refund(Escrow storage escrow, uint256 escrowId, uint8 reason) private {
        address buyer = escrow.buyer;
        if (buyer == address(0)) revert InvalidAddress();
        uint256 amount = escrow.amount;
        escrow.state = State.Refunded;
        musdToken.safeTransfer(buyer, amount);
        emit EscrowRefunded(escrowId, buyer, amount, reason);
    }

    function _load(uint256 escrowId) private view returns (Escrow storage escrow) {
        if (escrowId == 0 || escrowId >= nextEscrowId) revert EscrowNotFound();
        escrow = _escrows[escrowId];
        if (escrow.seller == address(0)) revert EscrowNotFound();
    }
}
