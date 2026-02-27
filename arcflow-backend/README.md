# ArcFlow Treasury - Backend

Event listener and API server for the ArcFlow Treasury project.

## Overview

The backend consists of two main components:

1. **Payout Worker**: Listens to `PayoutInstruction` events from the `ArcFlowPayoutRouter` contract on Arc testnet and processes them via Circle's API
2. **REST API Server**: Provides endpoints for querying payout and batch status

## Features

- **Event Listening**: Real-time monitoring of `PayoutInstruction` events from Arc testnet
- **Circle Integration**: Stub implementation of Circle Wallets/Gateway/CCTP for cross-chain payouts
- **Status Tracking**: In-memory storage of payout statuses (MVP - would use database in production)
- **RESTful API**: Simple HTTP endpoints for frontend integration
- **Logging**: Structured logging with Winston

## Prerequisites

- Node.js 18+
- Arc testnet RPC access
- Deployed `ArcFlowPayoutRouter` contract address

## Installation

```bash
cd arcflow-backend
npm install
```

## Configuration

Create a `.env` file in the `arcflow-backend` directory:

```bash
# Arc Testnet Configuration
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PAYOUT_ROUTER_ADDRESS=0xYourDeployedPayoutRouterAddress

# Server Configuration
PORT=3000
NODE_ENV=development

# Circle API Configuration (stubbed for now)
CIRCLE_API_KEY=stub_key_not_required_yet
CIRCLE_ENTITY_SECRET=stub_secret_not_required_yet

# Logging
LOG_LEVEL=info
```

You can copy from `.env.example`:

```bash
cp .env.example .env
# Then edit .env with your values
```

## Running

### Development Mode

**Option 1: Run worker only** (event listener)
```bash
npm run dev:worker
```

**Option 2: Run server** (includes worker + HTTP API)
```bash
npm run dev:server
```

### Production Mode

```bash
npm run build
npm run start:server  # Or start:worker
```

## Project Structure

```
arcflow-backend/
├── src/
│   ├── config/
│   │   ├── arc.ts              # Arc provider configuration
│   │   └── logger.ts           # Winston logger setup
│   ├── services/
│   │   └── circleClient.ts     # Circle API stub
│   ├── workers/
│   │   └── payoutWorker.ts     # Event listener worker
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── abis/
│   │   └── ArcFlowPayoutRouter.json  # Contract ABI
│   └── server.ts               # Express REST API
├── test/
│   ├── circleClient.test.ts    # Circle client unit tests
│   └── eventDecoding.test.ts   # Event decoding tests
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### Health Check

```http
GET /status
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-02-27T10:00:00.000Z",
  "service": "arcflow-backend"
}
```

### Get Batch Status

```http
GET /payouts/:batchId/status
```

**Response:**
```json
{
  "batchId": "1",
  "totalPayouts": 3,
  "totalAmount": "600.000000",
  "ready": true,
  "summary": {
    "queued": 2,
    "processing": 0,
    "completed": 1,
    "failed": 0
  },
  "payouts": [
    {
      "index": 0,
      "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "amount": "100.000000",
      "destinationChain": "BASE",
      "status": "QUEUED",
      "circlePayoutId": "circle_payout_123...",
      "createdAt": "2025-02-27T10:00:00.000Z",
      "updatedAt": "2025-02-27T10:00:00.000Z"
    }
  ]
}
```

### Get Single Payout Status

```http
GET /payouts/:batchId/:index/status
```

**Response:**
```json
{
  "batchId": "1",
  "index": 0,
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amount": "100.000000",
  "destinationChain": "BASE",
  "status": "QUEUED",
  "circlePayoutId": "circle_payout_123...",
  "createdAt": "2025-02-27T10:00:00.000Z",
  "updatedAt": "2025-02-27T10:00:00.000Z"
}
```

## Testing

Run the unit tests:

```bash
npm test
```

Tests cover:
- Circle client stub functionality
- Event decoding and parameter validation
- Chain identifier mapping
- Amount formatting

## How It Works

### Event Flow

1. **Contract Emits Event**: When a user creates a batch payout via `ArcFlowPayoutRouter.createBatchPayout()`, the contract emits a `PayoutInstruction` event for each recipient

2. **Worker Listens**: The payout worker is subscribed to these events via ethers.js

3. **Event Processing**: For each event:
   - Decode the event parameters (batchId, index, recipient, amount, destinationChain)
   - Convert bytes32 chain identifier to Circle's format
   - Format amount from wei to human-readable
   - Generate idempotency key

4. **Circle Integration**: Call `circleClient.createTransfer()` with:
   - Idempotency key (prevents duplicates)
   - Amount and currency (`USDC` / `EURC`)
   - Destination address and Circle chain name (e.g. `ARC-TESTNET`, `BASE-SEPOLIA`)
   - CCTP domain ID for the destination chain

5. **Status Tracking**: Store the result in memory with status:
   - `QUEUED`: Successfully sent to Circle
   - `PROCESSING`: Circle is processing (future enhancement)
   - `COMPLETED`: Circle completed the payout (future enhancement)
   - `FAILED`: Error occurred

### Circle API Stub

The Circle integration is currently a stub. Its design follows the patterns used in
`circlefin/arc-multichain-wallet`, so switching to real Circle API calls is mostly a
matter of swapping base URLs and API keys — no structural changes required.

- ✅ Uses `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` (both validated at startup, matching arc-multichain-wallet)
- ✅ Routes same-chain transfers to the Circle Wallets API (`CIRCLE_WALLETS_BASE_URL/transfers`)
- ✅ Routes cross-chain transfers to the Circle Gateway API (`CIRCLE_GATEWAY_BASE_URL/transfer`)
- ✅ Uses Circle's exact blockchain chain names (`ARC-TESTNET`, `BASE-SEPOLIA`, `AVAX-FUJI`, etc.)
- ✅ Includes CCTP domain IDs per chain (required for Gateway burn-intent requests)
- ✅ Idempotency keys formatted as `arcflow_{batchId}-{index}_{txHash}`
- ⚠️ No actual HTTP calls — returns stub transfer IDs
- ⚠️ EIP-712 BurnIntent signing (needed for cross-chain Gateway transfers) not yet implemented

To go to production:
1. Set real `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` from the Circle Developer Console
2. Replace the stub body in `circleClient.createTransfer()` with real `fetch` calls
3. For cross-chain: add EIP-712 BurnIntent signing and `GET /transfers/{id}` polling
   (reference: `arc-multichain-wallet/lib/circle/gateway-sdk.ts` → `transferGatewayBalanceWithEOA`)
4. Add webhook handler at `POST /webhook/circle` to receive Circle status updates

## Chain Identifier Mapping

The backend maps bytes32 chain labels (from `ArcFlowPayoutRouter`) to Circle's blockchain
chain identifiers, following the naming convention used in `circlefin/arc-multichain-wallet`
(`lib/circle/gateway-sdk.ts`). Circle uses hyphenated, network-qualified names on testnet.

| Contract bytes32 | Circle chain name | CCTP domain ID | Notes                             |
|------------------|-------------------|----------------|-----------------------------------|
| ARC              | ARC-TESTNET       | 5              | Home chain — was incorrectly "ETH"|
| BASE             | BASE-SEPOLIA      | 6              | Base testnet                      |
| AVAX / AVALANCHE | AVAX-FUJI         | 1              | Avalanche testnet                 |
| ETH / ETHEREUM   | ETH-SEPOLIA       | 0              | Ethereum testnet                  |
| ARB / ARBITRUM   | ARB-SEPOLIA       | 3              | Arbitrum testnet                  |
| (unknown)        | ARC-TESTNET       | 5              | Default fallback (home chain)     |

USYC (Hashnote tokenized US Treasury yield token) is available on Arc testnet at
`usyc.dev.hashnote.com`. Holders can convert USDC ↔ USYC via the Subscribe/Redeem panels.
USYC is accepted as a source token by `ArcFlowPayoutRouter`; Circle's cross-chain routes
use USDC/EURC as the settlement asset.

## Logging

Logs are written to:
- **Console**: Colorized, human-readable (development)
- **combined.log**: All logs (JSON format)
- **error.log**: Errors only (JSON format)

Log levels: `error`, `warn`, `info`, `debug`

Set via `LOG_LEVEL` environment variable.

## Future Enhancements

- [ ] Database integration (PostgreSQL/MongoDB) for persistent storage
- [ ] Real Circle API integration with authentication
- [ ] Webhook listener for Circle status updates
- [ ] Retry logic with exponential backoff
- [ ] Batch processing optimization
- [ ] Metrics and monitoring (Prometheus)
- [ ] Rate limiting for API endpoints
- [ ] Authentication/authorization for API

## Troubleshooting

**Worker not starting:**
- Check `ARC_TESTNET_RPC_URL` is valid
- Verify `ARC_PAYOUT_ROUTER_ADDRESS` is correct
- Ensure RPC endpoint is accessible

**No events detected:**
- Verify the contract has emitted events
- Check if historical event fetching succeeded
- Try lowering the `fromBlock` value in the worker

**API returning 404:**
- Worker must be running to track payouts
- Batch ID must match an on-chain batch
- Try the `/status` endpoint to verify server is running

## Related Packages

- **Root (contracts)**: Smart contracts for ArcFlow Treasury
- **arcflow-frontend**: Web UI (to be implemented)

## License

MIT

## Support

For questions or issues, please refer to the main project documentation.
