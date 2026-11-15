// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Test double for Uniswap Permit2 allowance transfers. The digest matches Permit2.
contract MockPermit2 {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    bytes32 private constant DETAILS_TYPEHASH = keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 private constant SINGLE_TYPEHASH = keccak256("PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");

    mapping(address owner => mapping(address token => mapping(address spender => uint160 amount))) public allowed;
    mapping(address owner => mapping(address token => mapping(address spender => uint48 nonce))) public nonces;

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256("Permit2"),
            block.chainid,
            address(this)
        ));
    }

    function permit(address owner, PermitSingle calldata permitSingle, bytes calldata signature) external {
        if (block.timestamp > permitSingle.sigDeadline) revert("expired");
        if (nonces[owner][permitSingle.details.token][permitSingle.spender] != permitSingle.details.nonce) revert("nonce");
        bytes32 detailsHash = keccak256(abi.encode(
            DETAILS_TYPEHASH,
            permitSingle.details.token,
            permitSingle.details.amount,
            permitSingle.details.expiration,
            permitSingle.details.nonce
        ));
        bytes32 structHash = keccak256(abi.encode(SINGLE_TYPEHASH, detailsHash, permitSingle.spender, permitSingle.sigDeadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
        address signer = ECDSA.recover(digest, signature);
        if (signer != owner) revert("signer");
        nonces[owner][permitSingle.details.token][permitSingle.spender] = permitSingle.details.nonce + 1;
        allowed[owner][permitSingle.details.token][permitSingle.spender] = permitSingle.details.amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 remaining = allowed[from][token][msg.sender];
        if (remaining < amount) revert("allowance");
        if (remaining != type(uint160).max) allowed[from][token][msg.sender] = remaining - amount;
        if (!IERC20(token).transferFrom(from, to, amount)) revert("transfer");
    }
}
