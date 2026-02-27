// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Router {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ArcFlowPayoutRouter {
    struct Batch {
        address creator;
        address token;
        uint256 totalAmount;
        uint256 createdAt;
    }

    uint256 public nextBatchId;
    mapping(uint256 => Batch) public batches;

    event BatchCreated(
        uint256 indexed batchId,
        address indexed creator,
        address indexed token,
        uint256 totalAmount
    );

    event PayoutInstruction(
        uint256 indexed batchId,
        uint256 indexed index,
        address recipient,
        uint256 amount,
        bytes32 destinationChain
    );

    error InvalidBatch();
    error LengthMismatch();

    function getNextBatchId() external view returns (uint256) {
        return nextBatchId;
    }

    function createBatchPayout(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata destinationChains
    ) external returns (uint256 batchId) {
        uint256 len = recipients.length;
        if (len == 0) revert InvalidBatch();
        if (amounts.length != len || destinationChains.length != len) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < len; i++) {
            total += amounts[i];
        }
        if (total == 0) revert InvalidBatch();

        batchId = nextBatchId++;
        batches[batchId] = Batch({
            creator: msg.sender,
            token: token,
            totalAmount: total,
            createdAt: block.timestamp
        });

        bool ok = IERC20Router(token).transferFrom(msg.sender, address(this), total);
        require(ok, "TRANSFER_FROM_FAILED");

        emit BatchCreated(batchId, msg.sender, token, total);

        for (uint256 i = 0; i < len; i++) {
            emit PayoutInstruction(batchId, i, recipients[i], amounts[i], destinationChains[i]);
        }
    }
}
