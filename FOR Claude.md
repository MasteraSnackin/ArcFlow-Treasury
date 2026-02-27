You are an experienced TypeScript/Web3 engineer. I have an Arc‑based hackathon project called ArcFlow Treasury. The contracts are already written; I now need you to:



Make sure they compile and deploy correctly to Arc testnet via Hardhat.



Add a minimal backend worker + tests that:



Listens to PayoutInstruction events on Arc.



Calls a stubbed Circle client (no real money) to demonstrate how Circle Wallets/Gateway/CCTP would be used.



Exposes simple APIs for a frontend (you don’t need to write the frontend).



Below is the current state of the contracts package. Assume it lives in arcflow-contracts/ and that I will run commands from there.



Contracts (do NOT change behaviour unless absolutely necessary)

ArcFlowEscrow.sol:



text

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;



interface IERC20Escrow {

&nbsp;   function transferFrom(address from, address to, uint256 amount) external returns (bool);

&nbsp;   function transfer(address to, uint256 amount) external returns (bool);

}



contract ArcFlowEscrow {

&nbsp;   struct Escrow {

&nbsp;       address payer;

&nbsp;       address payee;

&nbsp;       address token;

&nbsp;       uint256 amount;

&nbsp;       uint256 expiry;

&nbsp;       address arbitrator;

&nbsp;       bool disputed;

&nbsp;       bool released;

&nbsp;       bool refunded;

&nbsp;   }



&nbsp;   uint256 public nextEscrowId;

&nbsp;   mapping(uint256 => Escrow) public escrows;



&nbsp;   address public feeCollector;

&nbsp;   uint256 public feeBps; // e.g. 10 = 0.1%



&nbsp;   event EscrowCreated(

&nbsp;       uint256 indexed id,

&nbsp;       address indexed payer,

&nbsp;       address indexed payee,

&nbsp;       address token,

&nbsp;       uint256 amount,

&nbsp;       uint256 expiry,

&nbsp;       address arbitrator

&nbsp;   );

&nbsp;   event EscrowDisputed(uint256 indexed id);

&nbsp;   event EscrowResolved(uint256 indexed id, bool releaseToPayee);

&nbsp;   event EscrowReleased(uint256 indexed id);

&nbsp;   event EscrowRefunded(uint256 indexed id);



&nbsp;   error NotParticipant();

&nbsp;   error NotArbitrator();

&nbsp;   error InvalidEscrow();

&nbsp;   error AlreadyClosed();

&nbsp;   error TooEarly();

&nbsp;   error AlreadyDisputed();



&nbsp;   constructor(address \_feeCollector, uint256 \_feeBps) {

&nbsp;       feeCollector = \_feeCollector;

&nbsp;       feeBps = \_feeBps;

&nbsp;   }



&nbsp;   function createEscrow(

&nbsp;       address payee,

&nbsp;       address token,

&nbsp;       uint256 amount,

&nbsp;       uint256 expiry,

&nbsp;       address arbitrator

&nbsp;   ) external returns (uint256 id) {

&nbsp;       if (payee == address(0) || token == address(0)) revert InvalidEscrow();

&nbsp;       if (amount == 0) revert InvalidEscrow();

&nbsp;       if (expiry <= block.timestamp) revert InvalidEscrow();



&nbsp;       id = nextEscrowId++;

&nbsp;       escrows\[id] = Escrow({

&nbsp;           payer: msg.sender,

&nbsp;           payee: payee,

&nbsp;           token: token,

&nbsp;           amount: amount,

&nbsp;           expiry: expiry,

&nbsp;           arbitrator: arbitrator,

&nbsp;           disputed: false,

&nbsp;           released: false,

&nbsp;           refunded: false

&nbsp;       });



&nbsp;       bool ok = IERC20Escrow(token).transferFrom(msg.sender, address(this), amount);

&nbsp;       require(ok, "TRANSFER\_FROM\_FAILED");



&nbsp;       emit EscrowCreated(id, msg.sender, payee, token, amount, expiry, arbitrator);

&nbsp;   }



&nbsp;   function \_requireParticipant(uint256 id) internal view {

&nbsp;       Escrow storage e = escrows\[id];

&nbsp;       if (e.payer == address(0)) revert InvalidEscrow();

&nbsp;       if (msg.sender != e.payer \&\& msg.sender != e.payee) revert NotParticipant();

&nbsp;   }



&nbsp;   function \_requireOpen(uint256 id) internal view {

&nbsp;       Escrow storage e = escrows\[id];

&nbsp;       if (e.released || e.refunded) revert AlreadyClosed();

&nbsp;   }



&nbsp;   function \_payout(address token, address to, uint256 amount) internal {

&nbsp;       uint256 fee = (amount \* feeBps) / 10\_000;

&nbsp;       uint256 net = amount - fee;



&nbsp;       if (fee > 0 \&\& feeCollector != address(0)) {

&nbsp;           require(IERC20Escrow(token).transfer(feeCollector, fee), "FEE\_TRANSFER\_FAILED");

&nbsp;       }

&nbsp;       require(IERC20Escrow(token).transfer(to, net), "TRANSFER\_FAILED");

&nbsp;   }



&nbsp;   function raiseDispute(uint256 id) external {

&nbsp;       \_requireParticipant(id);

&nbsp;       \_requireOpen(id);

&nbsp;       Escrow storage e = escrows\[id];

&nbsp;       if (e.disputed) revert AlreadyDisputed();

&nbsp;       e.disputed = true;

&nbsp;       emit EscrowDisputed(id);

&nbsp;   }



&nbsp;   function resolveDispute(uint256 id, bool releaseToPayee) external {

&nbsp;       Escrow storage e = escrows\[id];

&nbsp;       if (e.payer == address(0)) revert InvalidEscrow();

&nbsp;       if (msg.sender != e.arbitrator) revert NotArbitrator();

&nbsp;       \_requireOpen(id);

&nbsp;       e.disputed = false;



&nbsp;       if (releaseToPayee) {

&nbsp;           e.released = true;

&nbsp;           \_payout(e.token, e.payee, e.amount);

&nbsp;           emit EscrowResolved(id, true);

&nbsp;           emit EscrowReleased(id);

&nbsp;       } else {

&nbsp;           e.refunded = true;

&nbsp;           \_payout(e.token, e.payer, e.amount);

&nbsp;           emit EscrowResolved(id, false);

&nbsp;           emit EscrowRefunded(id);

&nbsp;       }

&nbsp;   }



&nbsp;   function autoRelease(uint256 id) external {

&nbsp;       Escrow storage e = escrows\[id];

&nbsp;       if (e.payer == address(0)) revert InvalidEscrow();

&nbsp;       \_requireOpen(id);

&nbsp;       if (block.timestamp < e.expiry) revert TooEarly();

&nbsp;       if (e.disputed) revert AlreadyDisputed();



&nbsp;       e.released = true;

&nbsp;       \_payout(e.token, e.payee, e.amount);

&nbsp;       emit EscrowReleased(id);

&nbsp;   }

}

ArcFlowStreams.sol:



text

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;



interface IERC20Streams {

&nbsp;   function transferFrom(address from, address to, uint256 amount) external returns (bool);

&nbsp;   function transfer(address to, uint256 amount) external returns (bool);

}



contract ArcFlowStreams {

&nbsp;   struct Stream {

&nbsp;       address employer;

&nbsp;       address employee;

&nbsp;       address token;

&nbsp;       uint256 totalAmount;

&nbsp;       uint256 start;

&nbsp;       uint256 cliff;

&nbsp;       uint256 end;

&nbsp;       uint256 withdrawn;

&nbsp;   }



&nbsp;   uint256 public nextStreamId;

&nbsp;   mapping(uint256 => Stream) public streams;



&nbsp;   event StreamCreated(

&nbsp;       uint256 indexed id,

&nbsp;       address indexed employer,

&nbsp;       address indexed employee,

&nbsp;       address token,

&nbsp;       uint256 totalAmount,

&nbsp;       uint256 start,

&nbsp;       uint256 cliff,

&nbsp;       uint256 end

&nbsp;   );

&nbsp;   event Withdrawn(uint256 indexed id, address indexed employee, uint256 amount);

&nbsp;   event Revoked(uint256 indexed id, uint256 toEmployee, uint256 refundedToEmployer);



&nbsp;   error InvalidStream();

&nbsp;   error NotEmployee();

&nbsp;   error NothingToWithdraw();

&nbsp;   error NotEmployer();



&nbsp;   function createStream(

&nbsp;       address employee,

&nbsp;       address token,

&nbsp;       uint256 totalAmount,

&nbsp;       uint256 start,

&nbsp;       uint256 cliff,

&nbsp;       uint256 end

&nbsp;   ) external returns (uint256 id) {

&nbsp;       if (employee == address(0) || token == address(0)) revert InvalidStream();

&nbsp;       if (totalAmount == 0) revert InvalidStream();

&nbsp;       if (end <= start || end <= block.timestamp) revert InvalidStream();

&nbsp;       if (cliff < start || cliff > end) revert InvalidStream();



&nbsp;       id = nextStreamId++;

&nbsp;       streams\[id] = Stream({

&nbsp;           employer: msg.sender,

&nbsp;           employee: employee,

&nbsp;           token: token,

&nbsp;           totalAmount: totalAmount,

&nbsp;           start: start,

&nbsp;           cliff: cliff,

&nbsp;           end: end,

&nbsp;           withdrawn: 0

&nbsp;       });



&nbsp;       bool ok = IERC20Streams(token).transferFrom(msg.sender, address(this), totalAmount);

&nbsp;       require(ok, "TRANSFER\_FROM\_FAILED");



&nbsp;       emit StreamCreated(id, msg.sender, employee, token, totalAmount, start, cliff, end);

&nbsp;   }



&nbsp;   function getNextStreamId() external view returns (uint256) {

&nbsp;       return nextStreamId;

&nbsp;   }



&nbsp;   function getVested(uint256 id) public view returns (uint256) {

&nbsp;       Stream storage s = streams\[id];

&nbsp;       if (s.totalAmount == 0) return 0;



&nbsp;       if (block.timestamp <= s.cliff) {

&nbsp;           return 0;

&nbsp;       } else if (block.timestamp >= s.end) {

&nbsp;           return s.totalAmount;

&nbsp;       } else {

&nbsp;           uint256 elapsed = block.timestamp - s.cliff;

&nbsp;           uint256 duration = s.end - s.cliff;

&nbsp;           return (s.totalAmount \* elapsed) / duration;

&nbsp;       }

&nbsp;   }



&nbsp;   function getWithdrawable(uint256 id) public view returns (uint256) {

&nbsp;       Stream storage s = streams\[id];

&nbsp;       uint256 vested = getVested(id);

&nbsp;       if (vested <= s.withdrawn) return 0;

&nbsp;       return vested - s.withdrawn;

&nbsp;   }



&nbsp;   function withdraw(uint256 id) external {

&nbsp;       Stream storage s = streams\[id];

&nbsp;       if (s.employee == address(0)) revert InvalidStream();

&nbsp;       if (msg.sender != s.employee) revert NotEmployee();



&nbsp;       uint256 amount = getWithdrawable(id);

&nbsp;       if (amount == 0) revert NothingToWithdraw();



&nbsp;       s.withdrawn += amount;

&nbsp;       bool ok = IERC20Streams(s.token).transfer(s.employee, amount);

&nbsp;       require(ok, "TRANSFER\_FAILED");



&nbsp;       emit Withdrawn(id, s.employee, amount);

&nbsp;   }



&nbsp;   function revoke(uint256 id) external {

&nbsp;       Stream storage s = streams\[id];

&nbsp;       if (s.employer == address(0)) revert InvalidStream();

&nbsp;       if (msg.sender != s.employer) revert NotEmployer();



&nbsp;       uint256 vested = getVested(id);

&nbsp;       uint256 owedToEmployee = vested > s.withdrawn ? (vested - s.withdrawn) : 0;

&nbsp;       uint256 remaining = s.totalAmount - s.withdrawn;

&nbsp;       uint256 refundToEmployer = remaining > owedToEmployee ? (remaining - owedToEmployee) : 0;



&nbsp;       s.withdrawn = s.totalAmount;



&nbsp;       if (owedToEmployee > 0) {

&nbsp;           require(IERC20Streams(s.token).transfer(s.employee, owedToEmployee), "EMP\_TRANSFER\_FAILED");

&nbsp;       }

&nbsp;       if (refundToEmployer > 0) {

&nbsp;           require(IERC20Streams(s.token).transfer(s.employer, refundToEmployer), "EMP\_REFUND\_FAILED");

&nbsp;       }



&nbsp;       emit Revoked(id, owedToEmployee, refundToEmployer);

&nbsp;   }

}

ArcFlowPayoutRouter.sol:



text

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;



interface IERC20Router {

&nbsp;   function transferFrom(address from, address to, uint256 amount) external returns (bool);

}



contract ArcFlowPayoutRouter {

&nbsp;   struct Batch {

&nbsp;       address creator;

&nbsp;       address token;

&nbsp;       uint256 totalAmount;

&nbsp;       uint256 createdAt;

&nbsp;   }



&nbsp;   uint256 public nextBatchId;

&nbsp;   mapping(uint256 => Batch) public batches;



&nbsp;   event BatchCreated(

&nbsp;       uint256 indexed batchId,

&nbsp;       address indexed creator,

&nbsp;       address indexed token,

&nbsp;       uint256 totalAmount

&nbsp;   );



&nbsp;   event PayoutInstruction(

&nbsp;       uint256 indexed batchId,

&nbsp;       uint256 indexed index,

&nbsp;       address recipient,

&nbsp;       uint256 amount,

&nbsp;       bytes32 destinationChain

&nbsp;   );



&nbsp;   error InvalidBatch();

&nbsp;   error LengthMismatch();



&nbsp;   function getNextBatchId() external view returns (uint256) {

&nbsp;       return nextBatchId;

&nbsp;   }



&nbsp;   function createBatchPayout(

&nbsp;       address token,

&nbsp;       address\[] calldata recipients,

&nbsp;       uint256\[] calldata amounts,

&nbsp;       bytes32\[] calldata destinationChains

&nbsp;   ) external returns (uint256 batchId) {

&nbsp;       uint256 len = recipients.length;

&nbsp;       if (len == 0) revert InvalidBatch();

&nbsp;       if (amounts.length != len || destinationChains.length != len) revert LengthMismatch();



&nbsp;       uint256 total;

&nbsp;       for (uint256 i = 0; i < len; i++) {

&nbsp;           total += amounts\[i];

&nbsp;       }

&nbsp;       if (total == 0) revert InvalidBatch();



&nbsp;       batchId = nextBatchId++;

&nbsp;       batches\[batchId] = Batch({

&nbsp;           creator: msg.sender,

&nbsp;           token: token,

&nbsp;           totalAmount: total,

&nbsp;           createdAt: block.timestamp

&nbsp;       });



&nbsp;       bool ok = IERC20Router(token).transferFrom(msg.sender, address(this), total);

&nbsp;       require(ok, "TRANSFER\_FROM\_FAILED");



&nbsp;       emit BatchCreated(batchId, msg.sender, token, total);



&nbsp;       for (uint256 i = 0; i < len; i++) {

&nbsp;           emit PayoutInstruction(batchId, i, recipients\[i], amounts\[i], destinationChains\[i]);

&nbsp;       }

&nbsp;   }

}

Hardhat config and deploy script

hardhat.config.ts:



ts

import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-toolbox";

import \* as dotenv from "dotenv";



dotenv.config();



const ARC\_TESTNET\_RPC\_URL = process.env.ARC\_TESTNET\_RPC\_URL || "";

const ARC\_PRIVATE\_KEY = process.env.ARC\_PRIVATE\_KEY || "";



const config: HardhatUserConfig = {

&nbsp; solidity: {

&nbsp;   version: "0.8.20",

&nbsp;   settings: {

&nbsp;     optimizer: { enabled: true, runs: 200 },

&nbsp;   },

&nbsp; },

&nbsp; networks: {

&nbsp;   hardhat: {},

&nbsp;   arcTestnet: {

&nbsp;     url: ARC\_TESTNET\_RPC\_URL,

&nbsp;     accounts: ARC\_PRIVATE\_KEY ? \[ARC\_PRIVATE\_KEY] : \[],

&nbsp;     chainId: 5042002

&nbsp;   },

&nbsp; },

};



export default config;

package.json:



json

{

&nbsp; "name": "arcflow-contracts",

&nbsp; "version": "1.0.0",

&nbsp; "private": true,

&nbsp; "scripts": {

&nbsp;   "compile": "hardhat compile",

&nbsp;   "test": "hardhat test",

&nbsp;   "deploy:arc": "hardhat run scripts/deploy-arc.ts --network arcTestnet"

&nbsp; },

&nbsp; "devDependencies": {

&nbsp;   "@nomicfoundation/hardhat-toolbox": "^4.0.0",

&nbsp;   "@types/node": "^20.11.0",

&nbsp;   "dotenv": "^16.4.0",

&nbsp;   "hardhat": "^2.22.0",

&nbsp;   "ts-node": "^10.9.2",

&nbsp;   "typescript": "^5.6.0"

&nbsp; },

&nbsp; "dependencies": {

&nbsp;   "@openzeppelin/contracts": "^5.0.0"

&nbsp; }

}

deploy-arc.ts:



ts

import { ethers } from "hardhat";



async function main() {

&nbsp; const \[deployer] = await ethers.getSigners();

&nbsp; console.log("Deploying contracts with:", deployer.address);



&nbsp; const feeCollector = process.env.ARC\_FEE\_COLLECTOR ?? deployer.address;

&nbsp; const feeBps = Number(process.env.ARC\_FEE\_BPS ?? 0);



&nbsp; console.log("Escrow feeCollector:", feeCollector);

&nbsp; console.log("Escrow feeBps:", feeBps);



&nbsp; const Escrow = await ethers.getContractFactory("ArcFlowEscrow");

&nbsp; const escrow = await Escrow.deploy(feeCollector, feeBps);

&nbsp; await escrow.waitForDeployment();

&nbsp; const escrowAddress = await escrow.getAddress();

&nbsp; console.log("ArcFlowEscrow deployed to:", escrowAddress);



&nbsp; const Streams = await ethers.getContractFactory("ArcFlowStreams");

&nbsp; const streams = await Streams.deploy();

&nbsp; await streams.waitForDeployment();

&nbsp; const streamsAddress = await streams.getAddress();

&nbsp; console.log("ArcFlowStreams deployed to:", streamsAddress);



&nbsp; const Router = await ethers.getContractFactory("ArcFlowPayoutRouter");

&nbsp; const router = await Router.deploy();

&nbsp; await router.waitForDeployment();

&nbsp; const routerAddress = await router.getAddress();

&nbsp; console.log("ArcFlowPayoutRouter deployed to:", routerAddress);



&nbsp; console.log("\\nEnv values for frontend/backend:");

&nbsp; console.log("VITE\_ARC\_ESCROW\_ADDRESS=", escrowAddress);

&nbsp; console.log("VITE\_ARC\_STREAM\_ADDRESS=", streamsAddress);

&nbsp; console.log("VITE\_ARC\_PAYOUT\_ROUTER\_ADDRESS=", routerAddress);

&nbsp; console.log("ARC\_ESCROW\_ADDRESS=", escrowAddress);

&nbsp; console.log("ARC\_STREAMS\_ADDRESS=", streamsAddress);

&nbsp; console.log("ARC\_PAYOUT\_ROUTER\_ADDRESS=", routerAddress);

}



main().catch((err) => {

&nbsp; console.error(err);

&nbsp; process.exitCode = 1;

});

What I want you to do

Verify and fix the contracts deployment on Arc testnet



Make sure hardhat compile and npm run deploy:arc work against Arc testnet (using ARC\_TESTNET\_RPC\_URL and ARC\_PRIVATE\_KEY from .env).



If any issues arise (constructor args, gas limits, etc.), fix them with minimal, clearly justified changes.



Create a minimal backend worker (TypeScript, Node)



New folder arcflow-backend/ (or similar) with:



A small src/config/arc.ts that creates an ethers.JsonRpcProvider pointing at Arc testnet using the same RPC URL and chainId.



An ABI for ArcFlowPayoutRouter (you can generate it or hard‑code what you need for PayoutInstruction).



A worker that subscribes to PayoutInstruction events from the deployed router and logs decoded events.



Add a Circle client stub:



A module circleClient.ts that exposes createPayoutInstruction(params) but, for now, only logs the payload or returns a fake response. No real Circle keys required at this stage.



Wire the worker so that each PayoutInstruction:



Calls createPayoutInstruction with a reasonable mapping (idempotency key, amount, asset, destinationChain, destinationAddress).



Logs the returned “Circle” ID.



Add basic tests



Contract tests:



At least 1–2 tests for each contract covering the happy path (escrow creation + autoRelease; stream creation + withdraw; batch creation + PayoutInstruction event count).



Backend tests:



A unit test for the event decoding logic for PayoutInstruction.



A unit test for the Circle client stub (ensure it’s called with the right parameters).



Usage instructions



Add or update a README.md in arcflow-contracts and arcflow-backend explaining:



How to set .env (RPC URL, private key, feeCollector/feeBps).



How to deploy to Arc testnet.



How to run the backend worker and see it react to PayoutInstruction events.



How I want you to work

Start by restating the plan you will follow.



Then implement changes step‑by‑step:



First, ensure contracts compile and deploy (show me the commands and expected outputs).



Second, create the backend worker and Circle stub.



Third, add tests.



Paste the final versions of any new or modified files.



If something is ambiguous, ask a clarification question rather than guessing.

