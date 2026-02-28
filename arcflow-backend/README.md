# ArcFlow Treasury — Backend

Event listener and REST API server for ArcFlow Treasury.

## Overview

The backend has two main components:

1. **PayoutWorker** — subscribes to `PayoutInstruction` events from `ArcFlowPayoutRouter` on Arc Testnet and routes them to Circle's payout infrastructure
2. **Express REST API** — surfaces payout status, accepts Circle webhooks, and provides health checks

## Features

- ✅ **Event listening** — historical (last 1 000 blocks) + real-time WebSocket subscription
- ✅ **Circle same-chain routing** — live HTTP calls to Circle Wallets API when `CIRCLE_API_KEY` is set; stub mode when absent
- ✅ **Idempotency** — keys formatted as `arcflow_{batchId}-{index}_{txHash}` prevent duplicate Circle calls on re-delivery
- ✅ **PayoutStore** — in-memory Map with `batchIndex` and `transferIndex` secondary indexes for O(k)/O(1) lookups; optional JSON file persistence via `PAYOUT_STORE_PATH`
- ✅ **HMAC webhook verification** — `x-circle-signature` verified with `crypto.timingSafeEqual` when `CIRCLE_WEBHOOK_SECRET` is set
- ✅ **Single-pass BigInt arithmetic** — batch summaries use exact integer math (~1.9× faster than multi-pass float for large batches)
- ✅ **Structured logging** — Winston to console + `combined.log` + `error.log`

## Prerequisites

- Node.js 18+
- Arc Testnet RPC URL
- Deployed `ArcFlowPayoutRouter` contract address

## Installation

```bash
cd arcflow-backend
npm install
```

## Configuration

Copy the example and fill in your values:

```bash
cp .env.example .env
```

`arcflow-backend/.env`:

```env
# Arc Testnet
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PAYOUT_ROUTER_ADDRESS=0x...   # ArcFlowPayoutRouter deployed address

# Server
PORT=3000

# Circle API
# Leave blank → stub mode (logs fake IDs; good for local dev)
# Set a real key → live same-chain routing via Circle Wallets API
CIRCLE_API_KEY=
CIRCLE_WALLET_ID=                  # required when CIRCLE_API_KEY is set
CIRCLE_ENTITY_SECRET=              # Developer Controlled Wallets SDK (optional)
CIRCLE_WEBHOOK_SECRET=             # HMAC key for webhook verification (optional)

# Persistence
# Leave blank → payout state resets on restart
# Set a file path → payout state survives restarts (directory must exist)
PAYOUT_STORE_PATH=./data/payouts.json
```

## Running

```bash
# Development — server + worker (recommended)
npm run dev:server

# Development — worker only (no HTTP API)
npm run dev:worker

# Production
npm run build
npm run start:server
```

## Project Structure

```
arcflow-backend/
├── src/
│   ├── config/
│   │   ├── arc.ts              # Arc provider (ethers.js JsonRpcProvider)
│   │   └── logger.ts           # Winston logger
│   ├── services/
│   │   └── circleClient.ts     # Circle Wallets / Gateway / CCTP client
│   ├── stores/
│   │   └── payoutStore.ts      # PayoutStore — Map + secondary indexes + JSON persistence
│   ├── workers/
│   │   └── payoutWorker.ts     # PayoutInstruction event listener
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── abis/
│   │   └── ArcFlowPayoutRouter.json  # Contract ABI (full)
│   └── server.ts               # Express REST API + HMAC webhook
├── data/                        # JSON persistence directory (gitignored)
│   └── .gitkeep
├── test/
│   ├── circleClient.test.ts    # 15 tests
│   ├── eventDecoding.test.ts   # 4 tests
│   ├── payoutStore.test.ts     # 25 tests
│   └── batchSummary.test.ts    # 17 tests
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### `GET /status`

Health check.

```bash
curl http://localhost:3000/status
```

```json
{ "status": "ok", "network": "arc-testnet" }
```

---

### `GET /payouts/:batchId/status`

Returns a single-pass aggregated summary and full payout list for a batch.

```bash
curl http://localhost:3000/payouts/1/status
```

```json
{
  "batchId": "1",
  "totalPayouts": 3,
  "totalAmount": "600.000000",
  "ready": true,
  "summary": { "queued": 2, "processing": 0, "completed": 1, "failed": 0 },
  "payouts": [
    {
      "index": 0,
      "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "amount": "100.000000",
      "destinationChain": "BASE-SEPOLIA",
      "status": "COMPLETED",
      "circleTransferId": "circle_transfer_123...",
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:05:00.000Z"
    }
  ]
}
```

`totalAmount` uses exact BigInt arithmetic (no floating-point drift), always formatted to 6 decimal places.

---

### `GET /payouts/:batchId/:index/status`

Returns status for a single recipient within a batch.

```bash
curl http://localhost:3000/payouts/1/0/status
```

**Status values:** `QUEUED` · `PROCESSING` · `COMPLETED` · `FAILED`

---

### `POST /webhooks/circle`

Receives Circle transfer status callbacks. When `CIRCLE_WEBHOOK_SECRET` is set, the `x-circle-signature` HMAC-SHA256 header is verified before processing.

```bash
curl -X POST http://localhost:3000/webhooks/circle \
  -H "Content-Type: application/json" \
  -H "x-circle-signature: <hmac-hex>" \
  -d '{"transfer":{"id":"circle_transfer_123","status":"complete"}}'
```

```json
{ "received": true, "updated": true }
```

Circle status → payout status mapping:
| Circle status | Payout status |
|--------------|---------------|
| `pending` | `PROCESSING` |
| `complete` | `COMPLETED` |
| `failed` | `FAILED` |

---

### `GET /escrows/:id`

Escrow status stub — returns mock data for `id=0`; `404` otherwise. The frontend reads escrow state directly from the contract via ethers.js; this endpoint is provided for completeness.

### `GET /streams/:id`

Stream status stub — same as above for streams.

---

## Testing

```bash
npm test
```

61/61 tests across 4 files:

| File | Tests | What's covered |
|------|-------|----------------|
| `test/circleClient.test.ts` | 15 | Chain mapping, CCTP domain IDs, auth headers, stub/live branching, cross-chain flag |
| `test/eventDecoding.test.ts` | 4 | `PayoutInstruction` ABI encoding/decoding, bytes32 chain labels, wei formatting |
| `test/payoutStore.test.ts` | 25 | set/get/has, sorted getBatch, secondary-index correctness, overwrite semantics, cross-batch isolation; 8 persistence tests: ENOENT first-run, round-trip reload, Date deserialization, batchIndex rebuild, transferIndex rebuild, update persistence, debounce coalescing, no-filePath guard |
| `test/batchSummary.test.ts` | 17 | `amountToMicro`, `formatMicro`, BigInt-vs-float divergence proof, `computeBatchSummary` correctness, performance benchmark |

Type-check (0 errors):

```bash
npx tsc --noEmit
```

## How It Works

### Event flow

```
1. User calls ArcFlowPayoutRouter.createBatchPayout() on-chain
   ↓
2. Contract transfers tokens, emits BatchCreated + one PayoutInstruction per recipient
   ↓
3. PayoutWorker detects PayoutInstruction event
   • Decodes: batchId, index, recipient, amount (wei), destinationChain (bytes32)
   • Maps bytes32 chain label → Circle chain name (e.g. BASE → BASE-SEPOLIA)
   • Formats amount: wei (bigint) → human string (e.g. "100.000000")
   • Generates idempotency key: arcflow_{batchId}-{index}_{txHash}
   ↓
4. circleClient.createTransfer() called
   • CIRCLE_API_KEY absent → stub (logs, returns fake ID)
   • CIRCLE_API_KEY set   → POST api.circle.com/v1/w3s/wallets/{id}/transfers (same-chain)
   ↓
5. PayoutStore.set() records status as QUEUED
   • batchIndex updated (batch → Set<key>)
   • transferIndex updated (circleTransferId → key)
   • scheduleSave() debounces JSON write (200 ms) if PAYOUT_STORE_PATH set
   ↓
6. Circle webhook POST /webhooks/circle
   • HMAC verified if CIRCLE_WEBHOOK_SECRET set
   • PayoutStore.updateByCircleTransferId() → O(1) lookup via transferIndex
   • Status updated to PROCESSING / COMPLETED / FAILED
```

### Circle integration

The client (`src/services/circleClient.ts`) gates on `CIRCLE_API_KEY`:

**Stub mode (no API key):**
- Logs request parameters
- Returns `circle_transfer_{timestamp}_{random}` as `circleTransferId`
- No HTTP calls — safe for local dev without credentials

**Live mode (API key set) — same-chain:**
- `POST api.circle.com/v1/w3s/wallets/{walletId}/transfers`
- Bearer auth with `CIRCLE_API_KEY`
- Idempotency key in request body

**Cross-chain (stub):**
- BurnIntent / CCTP path not yet wired
- Reference implementation: `circlefin/arc-multichain-wallet/lib/circle/gateway-sdk.ts → transferGatewayBalanceWithEOA`

To go live with cross-chain:
1. Implement EIP-712 BurnIntent signing
2. `POST gateway-api-testnet.circle.com/v1/transfer` with signed intent
3. Poll `GET /v1/transfers/{id}` or handle via webhook until confirmed

### Chain identifier mapping

| Contract bytes32 | Circle chain name | CCTP domain |
|-----------------|-------------------|-------------|
| `ARC` | `ARC-TESTNET` | 5 |
| `BASE` | `BASE-SEPOLIA` | 6 |
| `AVAX` | `AVAX-FUJI` | 1 |
| `ETH` | `ETH-SEPOLIA` | 0 |
| `ARB` | `ARB-SEPOLIA` | 3 |
| (unknown) | `ARC-TESTNET` | 5 (default) |

Naming follows `circlefin/arc-multichain-wallet` conventions.

### PayoutStore persistence

When `PAYOUT_STORE_PATH` is set:
- On startup: reads JSON file, deserialises entries, rebuilds `batchIndex` and `transferIndex`
- On write: 200 ms debounce coalesces burst writes into a single `fs.promises.writeFile` call
- On `ENOENT` (first run): starts with empty store, creates file on first write

## Logging

Logs written to:
- **Console** — colorised, human-readable (development)
- **combined.log** — all levels (JSON format)
- **error.log** — errors only (JSON format)

Set log level via `LOG_LEVEL` env var (default: `info`).

## Troubleshooting

**Worker not starting:**
- Check `ARC_TESTNET_RPC_URL` is reachable: `curl <YOUR_RPC_URL>`
- Verify `ARC_PAYOUT_ROUTER_ADDRESS` is correct (matches deployed contract)

**No events detected:**
- Confirm batch payout transaction was mined (check `testnet.arcscan.app`)
- Confirm router address in `.env` matches deployed address

**API returning 404 for a batch:**
- Worker must be running when the batch is created (events are not replayed after worker restart unless historical range covers them)
- Check worker logs for `PayoutInstruction` event processing

**Circle webhook rejected (401):**
- Verify `CIRCLE_WEBHOOK_SECRET` matches the secret configured in the Circle Developer Console
- Leave blank to accept webhooks without verification (dev only)

## Related Packages

- **Root** — Smart contracts (`ArcFlowEscrow`, `ArcFlowStreams`, `ArcFlowPayoutRouter`)
- **arcflow-frontend** — React SPA wired to real contracts via ethers v6

## License

MIT
