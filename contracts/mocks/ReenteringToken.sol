// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IRelayAttackSurface {
    function fundEscrow(uint256 escrowId) external;
    function releaseToSeller(uint256 escrowId) external;
}

/// @notice Token that attempts to reenter the escrow during transfer hooks.
contract ReenteringToken {
    string public name = "Reentering USD";
    string public symbol = "RENT";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    IRelayAttackSurface public escrow;
    uint256 public attackId;
    bool public attackOnTransferFrom;
    bool public attackOnTransfer;
    bool private _inAttack;

    function setEscrow(address nextEscrow) external {
        escrow = IRelayAttackSurface(nextEscrow);
    }

    function setAttack(uint256 id, bool onTransferFrom, bool onTransfer) external {
        attackId = id;
        attackOnTransferFrom = onTransferFrom;
        attackOnTransfer = onTransfer;
        _inAttack = false;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _maybeAttackTransfer();
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _maybeAttackTransferFrom();
        _move(from, to, amount);
        return true;
    }

    function _maybeAttackTransferFrom() internal {
        if (attackOnTransferFrom && !_inAttack) {
            _inAttack = true;
            attackOnTransferFrom = false;
            escrow.fundEscrow(attackId);
        }
    }

    function _maybeAttackTransfer() internal {
        if (attackOnTransfer && !_inAttack) {
            _inAttack = true;
            attackOnTransfer = false;
            escrow.releaseToSeller(attackId);
        }
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}
