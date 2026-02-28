# ArcFlow Treasury - Contracts Package

Smart contracts for the ArcFlow Treasury hackathon project, built for Arc testnet.

## Overview

ArcFlow Treasury provides three core smart contracts for treasury operations with stablecoins (USDC/EURC):

- **ArcFlowEscrow**: On-chain escrows with dispute resolution and auto-release
- **ArcFlowStreams**: Vesting streams for payroll and token vesting
- **ArcFlowPayoutRouter**: Batch payouts with Circle integration for cross-chain transfers

## Prerequisites

- Node.js 18+ and npm
- Arc testnet account with test funds
- Arc testnet RPC URL

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```bash
# Arc Testnet Configuration
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PRIVATE_KEY=0xYourPrivateKeyWithTestFunds

# Optional: Fee configuration for ArcFlowEscrow
ARC_FEE_COLLECTOR=0xYourFeeCollectorAddress
ARC_FEE_BPS=100  # 100 basis points = 1%
```

**Important**: Never commit your private key. The `.env` file is gitignored.

## Compilation

Compile the smart contracts:

```bash
npm run compile
```

This will:
- Compile all Solidity contracts to `artifacts/`
- Generate TypeScript types to `typechain-types/`

## Testing

Run the full test suite:

```bash
npm test
```

The tests cover:
- **ArcFlowEscrow**: Escrow creation, disputes, auto-release, arbitration
- **ArcFlowStreams**: Stream creation, vesting calculation, withdrawals, revocation
- **ArcFlowPayoutRouter**: Batch creation, event emission, multi-recipient payouts

## Deployment

Deploy to Arc testnet:

```bash
npm run deploy:arc
```

This will deploy all three contracts and output their addresses. Example output:

```
ArcFlowEscrow deployed to: 0x123...
ArcFlowStreams deployed to: 0x456...
ArcFlowPayoutRouter deployed to: 0x789...

Env values for frontend/backend:
VITE_ARC_ESCROW_ADDRESS=  0x123...
VITE_ARC_STREAMS_ADDRESS= 0x456...
VITE_ARC_PAYOUT_ROUTER_ADDRESS= 0x789...
```

**Save these addresses** - you'll need them for the backend and frontend configuration.

## Contract Addresses (Example - Arc Testnet)

Replace with your deployed addresses:

```
ArcFlowEscrow:        0x...
ArcFlowStreams:       0x...
ArcFlowPayoutRouter:  0x...
```

## Contract APIs

### ArcFlowEscrow

**Create Escrow**
```solidity
function createEscrow(
    address payee,
    address token,
    uint256 amount,
    uint256 expiry,
    address arbitrator
) external returns (uint256 id)
```

**Auto Release** (after expiry, if no dispute)
```solidity
function autoRelease(uint256 id) external
```

**Raise Dispute**
```solidity
function raiseDispute(uint256 id) external
```

**Resolve Dispute** (arbitrator only)
```solidity
function resolveDispute(uint256 id, bool releaseToPayee) external
```

### ArcFlowStreams

**Create Stream**
```solidity
function createStream(
    address employee,
    address token,
    uint256 totalAmount,
    uint256 start,
    uint256 cliff,
    uint256 end
) external returns (uint256 id)
```

**Withdraw** (employee)
```solidity
function withdraw(uint256 id) external
```

**Revoke** (employer)
```solidity
function revoke(uint256 id) external
```

**View Functions**
```solidity
function getVested(uint256 id) public view returns (uint256)
function getWithdrawable(uint256 id) public view returns (uint256)
```

### ArcFlowPayoutRouter

**Create Batch Payout**
```solidity
function createBatchPayout(
    address token,
    address[] calldata recipients,
    uint256[] calldata amounts,
    bytes32[] calldata destinationChains
) external returns (uint256 batchId)
```

**Events**
```solidity
event BatchCreated(uint256 indexed batchId, address indexed creator, address indexed token, uint256 totalAmount)
event PayoutInstruction(uint256 indexed batchId, uint256 indexed index, address recipient, uint256 amount, bytes32 destinationChain)
```

## Project Structure

```
.
├── contracts/
│   ├── ArcFlowEscrow.sol         # Escrow contract
│   ├── ArcFlowStreams.sol        # Vesting streams contract
│   ├── ArcFlowPayoutRouter.sol   # Batch payout contract
│   └── mocks/
│       └── MockERC20.sol         # Mock token for testing
├── scripts/
│   └── deploy-arc.ts             # Deployment script
├── test/
│   ├── ArcFlowEscrow.test.ts     # Escrow tests
│   ├── ArcFlowStreams.test.ts    # Streams tests
│   └── ArcFlowPayoutRouter.test.ts # Router tests
├── hardhat.config.ts             # Hardhat configuration
├── package.json
├── tsconfig.json
└── .env                          # Local configuration (gitignored)
```

## Gas Estimates

Approximate gas costs on Arc testnet:

| Operation                    | Gas Estimate |
|------------------------------|--------------|
| Create Escrow                | ~150k        |
| Auto Release                 | ~80k         |
| Create Stream                | ~160k        |
| Withdraw from Stream         | ~90k         |
| Create Batch Payout (3 rcpt) | ~180k        |

## Development Tips

1. **Use Hardhat Console**
   ```bash
   npx hardhat console --network arcTestnet
   ```

2. **Verify Contracts** (if Arc supports verification)
   ```bash
   npx hardhat verify --network arcTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

3. **Test Locally** (Hardhat Network)
   ```bash
   npx hardhat node  # In one terminal
   npm test          # In another terminal
   ```

## Security Considerations

- All contracts use Solidity 0.8.20 with built-in overflow protection
- Escrow supports dispute resolution via trusted arbitrators
- Streams use time-based vesting with cliff and linear vesting periods
- PayoutRouter emits events for off-chain processing (Circle integration)

## Related Packages

- **arcflow-backend**: Event listener and Circle API integration
- **arcflow-frontend**: Web UI for managing treasury operations

## License

MIT

## Support

For questions or issues, please refer to the main project documentation or open an issue on GitHub.
