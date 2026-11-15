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
///                   A named buyer must accept the resolver first.
///                   A predecessor must already be Released.
///      Created   -> Cancelled   cancelUnfunded
///      Funded    -> Delivered   submitDelivery | submitDeliveryAsAgent
///      Funded    -> Refunded    refundAfterMissedDeadline | acceptMutualCancel
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
    uint8 public constant REFUND_MUTUAL = 3;

    uint32 public constant MIN_REVIEW_PERIOD = 15 minutes;
    uint32 public constant MAX_REVIEW_PERIOD = 30 days;
    uint64 public constant MIN_DELIVERY_GAP = 1 hours;
    uint64 public constant MAX_HORIZON = 365 days;
    uint256 public constant MAX_METADATA_BYTES = 2048;
    uint256 public constant MAX_EVIDENCE_BYTES = 800;
    uint256 public constant MAX_REASON_BYTES = 280;
    uint256 public constant FEE_BPS = 50;
    uint256 private constant FEE_DENOMINATOR = 10_000;

    IERC20 public immutable musdToken;
    address public immutable feeRecipient;

    uint256 public nextEscrowId = 1;
    mapping(uint256 => Escrow) private _escrows;
    /// @notice Remaining MUSD a buyer allows an agent to fund. The agent does not become the buyer.
    mapping(address buyer => mapping(address agent => uint256)) public agentAllowance;
    /// @notice Address that proposed a full refund of a funded agreement. The other party must accept.
    mapping(uint256 escrowId => address proposer) public mutualCancelProposer;
    /// @notice Seller-approved address that may submit delivery and nothing else.
    mapping(address seller => mapping(address agent => bool)) public deliveryAgent;
    /// @notice Earlier agreement that must be Released before this one can be funded. Zero means none.
    mapping(uint256 escrowId => uint256 predecessorId) public predecessorOf;
    /// @notice MUSD paid to the resolver only when a dispute is settled. Zero means none.
    mapping(uint256 escrowId => uint256 fee) public resolverFeeOf;
    /// @notice Named buyer has accepted the resolver. Open invoices are accepted by funding.
    mapping(uint256 escrowId => bool accepted) public resolverAccepted;
    mapping(uint256 escrowId => address proposer) public reviewExtensionProposer;
    mapping(uint256 escrowId => uint64 proposedDeadline) public reviewExtensionDeadline;

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
    event ProtocolFeePaid(uint256 indexed escrowId, address indexed recipient, uint256 amount);
    event MutualCancelProposed(uint256 indexed escrowId, address indexed proposer);
    event MutualCancelRevoked(uint256 indexed escrowId, address indexed proposer);
    event DeliveryAgentSet(address indexed seller, address indexed agent, bool allowed);
    event AgentDelivered(uint256 indexed escrowId, address indexed agent, address indexed seller);
    event ResolverAccepted(uint256 indexed escrowId, address indexed buyer);
    event ResolverFeePaid(uint256 indexed escrowId, address indexed resolver, uint256 amount);
    event ReviewExtensionProposed(uint256 indexed escrowId, address indexed proposer, uint64 newDeadline);
    event ReviewExtensionAccepted(uint256 indexed escrowId, address indexed acceptor, uint64 newDeadline);

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
    error PredecessorNotReleased();
    error ResolverNotAccepted();
    error ResolverFee();

    constructor(address musd, address recipient) {
        if (musd == address(0) || musd.code.length == 0) revert InvalidAddress();
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        musdToken = IERC20(musd);
        feeRecipient = recipient;
    }

    /// @notice Protocol fee in basis points. 50 means 0.50% of a seller payout. Refunds are not charged.
    function feeBps() external pure returns (uint256) {
        return FEE_BPS;
    }

    /// @notice MUSD taken from a seller payout. Integer division can make this zero for a tiny amount.
    function protocolFee(uint256 sellerAmount) public pure returns (uint256) {
        return sellerAmount * FEE_BPS / FEE_DENOMINATOR;
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
        string calldata metadata,
        uint256 predecessorId,
        uint256 resolverFee
    ) external returns (uint256 escrowId) {
        if (amount == 0) revert ZeroAmount();
        if (resolverFee >= amount) revert ResolverFee();
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
        if (predecessorId != 0) {
            Escrow storage prior = _load(predecessorId);
            if (prior.seller != msg.sender) revert NotSeller();
            if (buyer != address(0) && prior.buyer != address(0) && prior.buyer != buyer) revert NotBuyer();
        }

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
        predecessorOf[escrowId] = predecessorId;
        resolverFeeOf[escrowId] = resolverFee;

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
            _requireFundable(escrow, escrowId);
        } else {
            if (msg.sender == escrow.seller) revert BuyerIsSeller();
            if (msg.sender == escrow.resolver) revert ResolverIsParty();
            _requireFundable(escrow, escrowId);
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
        if (escrow.buyer == address(0)) revert NotBuyer();
        if (msg.sender == escrow.buyer || msg.sender == escrow.seller || msg.sender == escrow.resolver) revert AgentNotAllowed();

        uint256 amount = escrow.amount;
        uint256 remaining = agentAllowance[escrow.buyer][msg.sender];
        if (remaining < amount) revert AgentAllowance();
        _requireFundable(escrow, escrowId);
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
        _submitDelivery(escrow, escrowId, evidenceHash, evidence);
    }

    /// @notice A seller-approved agent submits delivery. The agent does not become the seller.
    function submitDeliveryAsAgent(uint256 escrowId, bytes32 evidenceHash, string calldata evidence) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        address seller = escrow.seller;
        if (!deliveryAgent[seller][msg.sender]) revert AgentNotAllowed();
        if (msg.sender == seller || msg.sender == escrow.buyer || msg.sender == escrow.resolver) revert AgentNotAllowed();
        _submitDelivery(escrow, escrowId, evidenceHash, evidence);
        emit AgentDelivered(escrowId, msg.sender, seller);
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
        _takeResolverFee(escrow, escrowId);
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

    /// @notice True when a funded agreement can be refunded by both parties.
    function mutualCancelSupported() external pure returns (bool) {
        return true;
    }

    /// @notice True when a seller can authorize an agent to submit delivery.
    function deliveryAgentSupported() external pure returns (bool) {
        return true;
    }

    function milestoneGateSupported() external pure returns (bool) {
        return true;
    }

    function resolverAcceptanceSupported() external pure returns (bool) {
        return true;
    }

    function reviewExtensionSupported() external pure returns (bool) {
        return true;
    }

    function resolverFeeSupported() external pure returns (bool) {
        return true;
    }

    /// @notice Named buyer accepts the resolver. Funding stays off until this is called.
    function acceptResolver(uint256 escrowId) external {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Created) revert InvalidState();
        if (escrow.buyer == address(0) || msg.sender != escrow.buyer) revert NotBuyer();
        resolverAccepted[escrowId] = true;
        emit ResolverAccepted(escrowId, msg.sender);
    }

    /// @notice Buyer or seller proposes a later review deadline. The other party must accept.
    function proposeReviewExtension(uint256 escrowId, uint64 newDeadline) external {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Delivered) revert InvalidState();
        if (block.timestamp > escrow.reviewDeadline) revert ReviewWindowClosed();
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) revert NotParty();
        _checkReviewExtension(escrow, newDeadline);
        reviewExtensionProposer[escrowId] = msg.sender;
        reviewExtensionDeadline[escrowId] = newDeadline;
        emit ReviewExtensionProposed(escrowId, msg.sender, newDeadline);
    }

    /// @notice The party that did not propose accepts the later review deadline.
    function acceptReviewExtension(uint256 escrowId) external {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Delivered) revert InvalidState();
        if (block.timestamp > escrow.reviewDeadline) revert ReviewWindowClosed();
        address proposer = reviewExtensionProposer[escrowId];
        uint64 proposed = reviewExtensionDeadline[escrowId];
        if (proposer == address(0) || proposed == 0 || msg.sender == proposer) revert NotParty();
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) revert NotParty();
        _checkReviewExtension(escrow, proposed);
        escrow.reviewDeadline = proposed;
        delete reviewExtensionProposer[escrowId];
        delete reviewExtensionDeadline[escrowId];
        emit ReviewExtensionAccepted(escrowId, msg.sender, proposed);
    }

    /// @notice Buyer or seller asks for a full refund. Only the other party can accept.
    function proposeMutualCancel(uint256 escrowId) external {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Funded) revert InvalidState();
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) revert NotParty();
        mutualCancelProposer[escrowId] = msg.sender;
        emit MutualCancelProposed(escrowId, msg.sender);
    }

    /// @notice The proposer withdraws a mutual-cancel request. No tokens move.
    function revokeMutualCancel(uint256 escrowId) external {
        if (mutualCancelProposer[escrowId] != msg.sender) revert NotParty();
        delete mutualCancelProposer[escrowId];
        emit MutualCancelRevoked(escrowId, msg.sender);
    }

    /// @notice The party that did not propose accepts a full refund. No seller fee is charged.
    function acceptMutualCancel(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (escrow.state != State.Funded) revert InvalidState();
        address proposer = mutualCancelProposer[escrowId];
        if (proposer == address(0) || msg.sender == proposer) revert NotParty();
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) revert NotParty();
        delete mutualCancelProposer[escrowId];
        _refund(escrow, escrowId, REFUND_MUTUAL);
    }

    /// @notice Seller allows or removes an address that can submit delivery for the seller's agreements.
    function setDeliveryAgent(address agent, bool allowed) external {
        if (agent == address(0) || agent == msg.sender) revert InvalidAddress();
        deliveryAgent[msg.sender][agent] = allowed;
        emit DeliveryAgentSet(msg.sender, agent, allowed);
    }

    /// @notice Resolver splits a disputed escrow. The seller receives `sellerAmount` and the buyer receives the remainder.
    /// @dev Neither side may receive the full amount through this function. Use `resolveDispute` for a full release or refund.
    function resolveDisputeSplit(uint256 escrowId, uint256 sellerAmount) external nonReentrant {
        Escrow storage escrow = _load(escrowId);
        if (msg.sender != escrow.resolver) revert NotResolver();
        if (escrow.state != State.Disputed) revert InvalidState();
        _takeResolverFee(escrow, escrowId);
        if (sellerAmount == 0 || sellerAmount >= escrow.amount) revert SplitAmount();

        address buyer = escrow.buyer;
        if (buyer == address(0)) revert InvalidAddress();
        address seller = escrow.seller;
        uint256 buyerAmount = escrow.amount - sellerAmount;
        escrow.state = State.Split;
        uint256 sellerNet = _paySeller(escrowId, seller, sellerAmount);

        emit DisputeSplit(escrowId, msg.sender, sellerNet, buyerAmount);
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
        uint256 net = _paySeller(escrowId, seller, amount);
        emit EscrowReleased(escrowId, seller, net, reason);
    }

    /// @dev Charges the seller payout only. The caller must still transfer any buyer remainder.
    function _paySeller(uint256 escrowId, address seller, uint256 gross) private returns (uint256 net) {
        uint256 fee = protocolFee(gross);
        net = gross - fee;
        if (fee != 0) {
            musdToken.safeTransfer(feeRecipient, fee);
            emit ProtocolFeePaid(escrowId, feeRecipient, fee);
        }
        musdToken.safeTransfer(seller, net);
    }

    function _submitDelivery(
        Escrow storage escrow,
        uint256 escrowId,
        bytes32 evidenceHash,
        string calldata evidence
    ) private {
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
        delete mutualCancelProposer[escrowId];

        emit DeliverySubmitted(escrowId, evidenceHash, reviewDeadline);
    }

    function _refund(Escrow storage escrow, uint256 escrowId, uint8 reason) private {
        address buyer = escrow.buyer;
        if (buyer == address(0)) revert InvalidAddress();
        uint256 amount = escrow.amount;
        escrow.state = State.Refunded;
        delete mutualCancelProposer[escrowId];
        musdToken.safeTransfer(buyer, amount);
        emit EscrowRefunded(escrowId, buyer, amount, reason);
    }

    function _requireFundable(Escrow storage escrow, uint256 escrowId) private view {
        uint256 predecessorId = predecessorOf[escrowId];
        if (predecessorId != 0 && _escrows[predecessorId].state != State.Released) revert PredecessorNotReleased();
        if (escrow.buyer != address(0) && !resolverAccepted[escrowId]) revert ResolverNotAccepted();
    }

    function _checkReviewExtension(Escrow storage escrow, uint64 newDeadline) private view {
        if (newDeadline <= escrow.reviewDeadline) revert InvalidDeadline();
        uint256 deliveredAt = uint256(escrow.reviewDeadline) - uint256(escrow.reviewPeriod);
        if (uint256(newDeadline) > deliveredAt + MAX_REVIEW_PERIOD) revert InvalidReviewPeriod();
    }

    /// @dev Pays the resolver from a disputed escrow only. Release and refund paths do not call this.
    function _takeResolverFee(Escrow storage escrow, uint256 escrowId) private {
        uint256 fee = resolverFeeOf[escrowId];
        if (fee == 0) return;
        if (fee >= escrow.amount) revert ResolverFee();
        escrow.amount -= fee;
        musdToken.safeTransfer(escrow.resolver, fee);
        emit ResolverFeePaid(escrowId, escrow.resolver, fee);
    }

    function _load(uint256 escrowId) private view returns (Escrow storage escrow) {
        if (escrowId == 0 || escrowId >= nextEscrowId) revert EscrowNotFound();
        escrow = _escrows[escrowId];
        if (escrow.seller == address(0)) revert EscrowNotFound();
    }
}
