// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Streams {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ArcFlowStreams {
    struct Stream {
        address employer;
        address employee;
        address token;
        uint256 totalAmount;
        uint256 start;
        uint256 cliff;
        uint256 end;
        uint256 withdrawn;
    }

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;

    event StreamCreated(
        uint256 indexed id,
        address indexed employer,
        address indexed employee,
        address token,
        uint256 totalAmount,
        uint256 start,
        uint256 cliff,
        uint256 end
    );
    event Withdrawn(uint256 indexed id, address indexed employee, uint256 amount);
    event Revoked(uint256 indexed id, uint256 toEmployee, uint256 refundedToEmployer);

    error InvalidStream();
    error NotEmployee();
    error NothingToWithdraw();
    error NotEmployer();

    function createStream(
        address employee,
        address token,
        uint256 totalAmount,
        uint256 start,
        uint256 cliff,
        uint256 end
    ) external returns (uint256 id) {
        if (employee == address(0) || token == address(0)) revert InvalidStream();
        if (totalAmount == 0) revert InvalidStream();
        if (end <= start || end <= block.timestamp) revert InvalidStream();
        if (cliff < start || cliff > end) revert InvalidStream();

        id = nextStreamId++;
        streams[id] = Stream({
            employer: msg.sender,
            employee: employee,
            token: token,
            totalAmount: totalAmount,
            start: start,
            cliff: cliff,
            end: end,
            withdrawn: 0
        });

        bool ok = IERC20Streams(token).transferFrom(msg.sender, address(this), totalAmount);
        require(ok, "TRANSFER_FROM_FAILED");

        emit StreamCreated(id, msg.sender, employee, token, totalAmount, start, cliff, end);
    }

    function getNextStreamId() external view returns (uint256) {
        return nextStreamId;
    }

    function getVested(uint256 id) public view returns (uint256) {
        Stream storage s = streams[id];
        if (s.totalAmount == 0) return 0;

        if (block.timestamp <= s.cliff) {
            return 0;
        } else if (block.timestamp >= s.end) {
            return s.totalAmount;
        } else {
            uint256 elapsed = block.timestamp - s.cliff;
            uint256 duration = s.end - s.cliff;
            return (s.totalAmount * elapsed) / duration;
        }
    }

    function getWithdrawable(uint256 id) public view returns (uint256) {
        Stream storage s = streams[id];
        uint256 vested = getVested(id);
        if (vested <= s.withdrawn) return 0;
        return vested - s.withdrawn;
    }

    function withdraw(uint256 id) external {
        Stream storage s = streams[id];
        if (s.employee == address(0)) revert InvalidStream();
        if (msg.sender != s.employee) revert NotEmployee();

        uint256 amount = getWithdrawable(id);
        if (amount == 0) revert NothingToWithdraw();

        s.withdrawn += amount;
        bool ok = IERC20Streams(s.token).transfer(s.employee, amount);
        require(ok, "TRANSFER_FAILED");

        emit Withdrawn(id, s.employee, amount);
    }

    function revoke(uint256 id) external {
        Stream storage s = streams[id];
        if (s.employer == address(0)) revert InvalidStream();
        if (msg.sender != s.employer) revert NotEmployer();

        uint256 vested = getVested(id);
        uint256 owedToEmployee = vested > s.withdrawn ? (vested - s.withdrawn) : 0;
        uint256 remaining = s.totalAmount - s.withdrawn;
        uint256 refundToEmployer = remaining > owedToEmployee ? (remaining - owedToEmployee) : 0;

        // mark all as withdrawn to prevent future use
        s.withdrawn = s.totalAmount;

        if (owedToEmployee > 0) {
            require(IERC20Streams(s.token).transfer(s.employee, owedToEmployee), "EMP_TRANSFER_FAILED");
        }
        if (refundToEmployer > 0) {
            require(IERC20Streams(s.token).transfer(s.employer, refundToEmployer), "EMP_REFUND_FAILED");
        }

        emit Revoked(id, owedToEmployee, refundToEmployer);
    }
}
