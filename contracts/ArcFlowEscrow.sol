// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Escrow {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ArcFlowEscrow {
    struct Escrow {
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint256 expiry;
        address arbitrator;
        bool disputed;
        bool released;
        bool refunded;
    }

    uint256 public nextEscrowId;
    mapping(uint256 => Escrow) public escrows;

    // NEW: fee configuration
    address public feeCollector;
    uint256 public feeBps; // e.g. 10 = 0.1%

    event EscrowCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        address token,
        uint256 amount,
        uint256 expiry,
        address arbitrator
    );
    event EscrowDisputed(uint256 indexed id);
    event EscrowResolved(uint256 indexed id, bool releaseToPayee);
    event EscrowReleased(uint256 indexed id);
    event EscrowRefunded(uint256 indexed id);

    error NotParticipant();
    error NotArbitrator();
    error InvalidEscrow();
    error AlreadyClosed();
    error TooEarly();
    error AlreadyDisputed();

    constructor(address _feeCollector, uint256 _feeBps) {
        feeCollector = _feeCollector;
        feeBps = _feeBps; // in basis points, 10_000 = 100%
    }

    function createEscrow(
        address payee,
        address token,
        uint256 amount,
        uint256 expiry,
        address arbitrator
    ) external returns (uint256 id) {
        if (payee == address(0) || token == address(0)) revert InvalidEscrow();
        if (amount == 0) revert InvalidEscrow();
        if (expiry <= block.timestamp) revert InvalidEscrow();

        id = nextEscrowId++;
        escrows[id] = Escrow({
            payer: msg.sender,
            payee: payee,
            token: token,
            amount: amount,
            expiry: expiry,
            arbitrator: arbitrator,
            disputed: false,
            released: false,
            refunded: false
        });

        bool ok = IERC20Escrow(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FROM_FAILED");

        emit EscrowCreated(id, msg.sender, payee, token, amount, expiry, arbitrator);
    }

    function _requireParticipant(uint256 id) internal view {
        Escrow storage e = escrows[id];
        if (e.payer == address(0)) revert InvalidEscrow();
        if (msg.sender != e.payer && msg.sender != e.payee) revert NotParticipant();
    }

    function _requireOpen(uint256 id) internal view {
        Escrow storage e = escrows[id];
        if (e.released || e.refunded) revert AlreadyClosed();
    }

    // NEW: payout helper with fee
    function _payout(address token, address to, uint256 amount) internal {
        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;

        if (fee > 0 && feeCollector != address(0)) {
            require(IERC20Escrow(token).transfer(feeCollector, fee), "FEE_TRANSFER_FAILED");
        }
        require(IERC20Escrow(token).transfer(to, net), "TRANSFER_FAILED");
    }

    function raiseDispute(uint256 id) external {
        _requireParticipant(id);
        _requireOpen(id);
        Escrow storage e = escrows[id];
        if (e.disputed) revert AlreadyDisputed();
        e.disputed = true;
        emit EscrowDisputed(id);
    }

    function resolveDispute(uint256 id, bool releaseToPayee) external {
        Escrow storage e = escrows[id];
        if (e.payer == address(0)) revert InvalidEscrow();
        if (msg.sender != e.arbitrator) revert NotArbitrator();
        _requireOpen(id);
        e.disputed = false;

        if (releaseToPayee) {
            e.released = true;
            _payout(e.token, e.payee, e.amount);
            emit EscrowResolved(id, true);
            emit EscrowReleased(id);
        } else {
            e.refunded = true;
            _payout(e.token, e.payer, e.amount);
            emit EscrowResolved(id, false);
            emit EscrowRefunded(id);
        }
    }

    function autoRelease(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.payer == address(0)) revert InvalidEscrow();
        _requireOpen(id);
        if (block.timestamp < e.expiry) revert TooEarly();
        if (e.disputed) revert AlreadyDisputed();

        e.released = true;
        _payout(e.token, e.payee, e.amount);
        emit EscrowReleased(id);
    }
}
