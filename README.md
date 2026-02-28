# ArcFlow Treasury

> Stablecoin treasury operations — escrow, payroll streams, and batch payouts on Arc.

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Contract Tests](https://img.shields.io/badge/contract%20tests-31%20passing-brightgreen)
![Backend Tests](https://img.shields.io/badge/backend%20tests-61%20passing-brightgreen)
![Solidity](https://img.shields.io/badge/solidity-0.8.20-blue)
![Network](https://img.shields.io/badge/network-Arc%20Testnet-purple)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Description

ArcFlow Treasury is an Arc-native web application that gives finance and operations teams a single interface for stablecoin treasury workflows. It replaces fragmented spreadsheets, manual wallet operations, and ad-hoc escrow agreements with fully on-chain, auditable primitives — conditional escrows with dispute resolution, linear vesting streams with cliff support, and multi-recipient batch payouts — all denominated in USDC or EURC.

The system runs on **Arc**, a Layer-1 blockchain built by Circle for stablecoin-native finance. Arc provides sub-second finality, USDC-denominated gas, and predictable fees. For cross-chain settlement, the architecture routes through **Circle Wallets**, **Circle Gateway**, and **CCTP** so users never manage bridging or liquidity themselves.

**Target users:** Crypto-native companies and technical founders who pay contractors, run payroll, and execute bulk transfers in stablecoins.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Screenshots / Demo](#screenshots--demo)
- [API Reference](#api-reference)
- [Tests](#tests)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact / Support](#contact--support)

---

## Features

- **On-chain Escrow** — Lock USDC/EURC with configurable expiry, optional arbitrator, and automatic release. Either party can raise a dispute; the arbitrator resolves it on-chain.
- **Payroll & Vesting Streams** — Employer-funded linear vesting with a cliff period. Employees withdraw at any time; employers can revoke with an automatic pro-rata split.
- **Batch Payouts** — Create multi-recipient payout batches in a single transaction. Each recipient specifies a destination chain (`ARC`, `BASE`, `AVAX`, `ETH`, `ARB`) aligned to Circle's supported chain set.
- **My Escrows / Streams / Batches** — localStorage-persisted list views on each page. Created items appear instantly and survive page refresh; click any item to auto-load it.
- **Treasury Dashboard** — Real-time overview of USDC locked in escrows, streams, and pending payout batches, with Quick Actions and Recent Activity.
- **USYC Support** — Hashnote tokenized US Treasury yield token (USYC) accepted alongside USDC and EURC across all three flows.
- **Live Circle Integration** — Same-chain payouts call Circle Wallets API live when `CIRCLE_API_KEY` is set; cross-chain routes use Circle Gateway/CCTP (BurnIntent stubs to live with env var).
- **Backend Event Indexer** — `EscrowStreamWorker` replays last 1 000 blocks and subscribes to all escrow + stream lifecycle events, maintaining in-memory indexes for instant O(1) lookups.
- **Payout Event Worker** — `PayoutWorker` subscribes to `PayoutInstruction` events and dispatches to Circle Wallets/Gateway for off-chain settlement.
- **REST Status API** — Query escrow, stream, and payout batch status instantly without re-querying the chain. Batch totals use exact BigInt arithmetic (single-pass, 1.67× faster than multi-pass float).
- **Indexed Stores** — `EscrowStore`, `StreamStore`, and `PayoutStore` each use secondary indexes for O(1)/O(k) lookups. `PayoutStore` optionally persists to JSON for restarts.
- **HMAC Webhook Security** — Circle webhook endpoint verifies `x-circle-signature` using `crypto.timingSafeEqual` to prevent timing attacks and forged status updates.
- **Interactive Demo Page** — `/demo` route walks through all three flows with simulated delays — no MetaMask or testnet tokens required. Ideal for hackathon judging.
- **MetaMask Integration** — One-click wallet connect with Arc Testnet chain detection and live API health indicator.
- **Glassmorphism UI** — Dark dashboard with skeleton loading, consistent empty/error/success states, and toast notifications throughout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, Hardhat 2.x, OpenZeppelin Contracts 5.x |
| Contract Testing | Hardhat + Chai + `@nomicfoundation/hardhat-chai-matchers` |
| Backend API | Node.js 18+, Express 4.x, TypeScript 5.x, ethers.js v6 |
| Backend Testing | Vitest 1.x |
| Logging | Winston 3.x |
| Frontend | Vite 7, React 18, TypeScript 5.x |
| Styling | Tailwind CSS 3.x + `@tailwindcss/forms` |
| Routing | react-router-dom v6 |
| Web3 | ethers.js v6 |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Network | Arc EVM Testnet — Chain ID `5042002` |
| Token support | USDC, EURC, USYC (Hashnote tokenized US Treasury) |
| Circle SDK (live) | Circle Wallets API (same-chain live) + Circle Gateway/CCTP (cross-chain) |
| Circle reference | [`circlefin/arc-multichain-wallet`](https://github.com/circlefin/arc-multichain-wallet) — chain names, domain IDs, and dual-endpoint routing |

---

## Architecture Overview

```mermaid
flowchart LR
  User["User / Finance Team\n(MetaMask Wallet)"]
  UI["ArcFlow Frontend\nVite + React SPA\nlocalhost:5173"]
  API["ArcFlow Backend API\nExpress + TypeScript\nlocalhost:3000"]
  PayoutW["PayoutWorker\nBatchCreated events"]
  EscrowW["EscrowStreamWorker\n1000-block replay + live"]
  PayoutStore["PayoutStore\nbatchIndex + transferIndex"]
  EscrowStore["EscrowStore + StreamStore\nO(1) indexed lookups"]
  Arc["Arc EVM Testnet\nChain ID 5042002"]
  Escrow["ArcFlowEscrow"]
  Streams["ArcFlowStreams"]
  Router["ArcFlowPayoutRouter"]
  CircleW["Circle Wallets API\n(same-chain, live)"]
  CircleG["Circle Gateway\nCCTP (cross-chain)"]

  User -->|"sign transactions"| UI
  UI -->|"read state"| Arc
  UI -->|"write: createEscrow\ncreateStream\ncreateBatch"| Escrow & Streams & Router
  UI -->|"REST: /escrows/:id\n/streams/:id\n/payouts/:id/status"| API
  Router -->|"emit BatchCreated\nPayoutInstruction"| Arc
  Escrow -->|"emit Escrow events"| Arc
  Streams -->|"emit Stream events"| Arc
  PayoutW -->|"subscribe events"| Arc
  EscrowW -->|"queryFilter + on()"| Arc
  PayoutW -->|"createTransfer"| CircleW
  PayoutW -->|"createTransfer"| CircleG
  PayoutW -->|"write"| PayoutStore
  EscrowW -->|"write"| EscrowStore
  API -->|"read"| PayoutStore
  API -->|"read"| EscrowStore
  CircleW -->|"POST /webhooks/circle\nHMAC-SHA256"| API
  CircleG -->|"POST /webhooks/circle"| API
  API -->|"updateByCircleTransferId"| PayoutStore
```

The **frontend** connects directly to Arc EVM via the user's injected wallet for all transaction signing and contract reads. The **backend worker** independently listens for `PayoutInstruction` events emitted by `ArcFlowPayoutRouter`, decodes each recipient's chain and amount, and calls the Circle API stub to initiate off-chain settlement. The **PayoutStore** maintains two secondary indexes — `batchIndex` (O(k) batch retrieval) and `transferIndex` (O(1) webhook lookups) — so no linear scans are needed. The **REST API** surfaces stored payout status and accepts HMAC-SHA256–signed Circle webhook callbacks to keep status up-to-date in real time.

### Circle integration alignment

The Circle client (`arcflow-backend/src/services/circleClient.ts`) is modelled directly on [`circlefin/arc-multichain-wallet`](https://github.com/circlefin/arc-multichain-wallet):

| What | Value adopted from arc-multichain-wallet |
|---|---|
| Chain identifiers | `ARC-TESTNET`, `BASE-SEPOLIA`, `AVAX-FUJI`, `ETH-SEPOLIA`, `ARB-SEPOLIA` |
| CCTP domain IDs | ARC-TESTNET=5, BASE-SEPOLIA=6, AVAX-FUJI=1, ETH-SEPOLIA=0, ARB-SEPOLIA=3 |
| Same-chain endpoint | Circle Wallets API — `api.circle.com/v1/transfers` |
| Cross-chain endpoint | Circle Gateway API — `gateway-api-testnet.circle.com/v1/transfer` |
| SDK | `@circle-fin/developer-controlled-wallets` (initialized with `apiKey` + `entitySecret`) |
| Method name | `createTransfer()` (maps to `circleClient.createTransfer` in the reference app) |

**Same-chain payouts are live when `CIRCLE_API_KEY` is set** — `circleClient.createTransfer()` calls the Circle Wallets API (`api.circle.com/v1/w3s/wallets/{walletId}/transfers`) with real HTTP. When the key is absent the client operates in stub mode (dev-friendly default). **Cross-chain payouts** (non-ARC destinations) still use a stub path; live routing requires EIP-712 `BurnIntent` signing (see `arc-multichain-wallet/lib/circle/gateway-sdk.ts → transferGatewayBalanceWithEOA`).

---

## Installation

### Prerequisites

- **Node.js** 18 or later (`node --version`)
- **npm** 9 or later
- A wallet funded on Arc Testnet (get testnet USDC/EURC from [faucet.circle.com](https://faucet.circle.com/) — select **Arc Testnet**)

### 1. Clone the repository

```bash
git clone https://github.com/MasteraSnackin/ArcFlow-Treasury.git
cd ArcFlow-Treasury
```

### 2. Install contract dependencies (root)

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd arcflow-backend && npm install && cd ..
```

### 4. Install frontend dependencies

```bash
cd arcflow-frontend && npm install && cd ..
```

### 5. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values — see Configuration section
```

### 6. Verify your setup

```bash
npm run verify-setup
```

---

## Usage

### Compile and deploy contracts

```bash
# Compile Solidity
npm run compile

# Deploy to Arc Testnet
npm run deploy:arc
```

The deploy script prints the addresses of `ArcFlowEscrow`, `ArcFlowStreams`, and `ArcFlowPayoutRouter`. Copy these into your `.env`.

### Start the backend

```bash
# Terminal 1 — API server (port 3000)
cd arcflow-backend
npm run dev:server

# Terminal 2 — Payout event worker (optional, for batch payout tracking)
cd arcflow-backend
npm run dev:worker
```

### Start the frontend

```bash
cd arcflow-frontend
npm run dev
# → http://localhost:5173
```

### End-to-end example: create an escrow

1. Open `http://localhost:5173` and click **Connect Wallet**.
2. Navigate to **Escrow & Disputes**.
3. Click **New Escrow** → fill in payee address, token (USDC/EURC), amount, expiry hours, and optional arbitrator.
4. Approve the ERC-20 spend when prompted, then confirm the `createEscrow` transaction.
5. The new escrow appears instantly in the **My Escrows** panel. Click it to auto-load details.
6. Use the lookup panel to raise disputes, auto-release after expiry, or resolve as arbitrator.

### End-to-end example: create a batch payout

1. Navigate to **Payout Batches** → click **New Batch Payout**.
2. Select token (USDC/EURC), add recipient rows (address, amount, destination chain).
3. Confirm the `createBatchPayout` transaction.
4. The batch appears in the **My Batches** panel. Click it to fetch live Circle payout status from the backend API.

---

## Configuration

Configuration is split across three `.env` files. Copy each `.env.example` → `.env` and fill in the values.

**Root `.env`** — contract deployment (Hardhat):

| Variable | Required | Description |
|---|---|---|
| `ARC_TESTNET_RPC_URL` | Yes | JSON-RPC endpoint for Arc Testnet |
| `ARC_PRIVATE_KEY` | Yes | Deployer private key (`0x` + 64 hex chars) |
| `ARC_FEE_COLLECTOR` | Yes | Address that receives protocol fees |
| `ARC_FEE_BPS` | Yes | Fee in basis points — use `0` for no fee |

**`arcflow-frontend/.env`** — frontend contract addresses (Vite build-time):

| Variable | Required | Description |
|---|---|---|
| `VITE_ARC_ESCROW_ADDRESS` | After deploy | Deployed `ArcFlowEscrow` address |
| `VITE_ARC_STREAMS_ADDRESS` | After deploy | Deployed `ArcFlowStreams` address |
| `VITE_ARC_PAYOUT_ROUTER_ADDRESS` | After deploy | Deployed `ArcFlowPayoutRouter` address |
| `VITE_USDC_ADDRESS` | After deploy | USDC token contract address on Arc Testnet |
| `VITE_EURC_ADDRESS` | After deploy | EURC token contract address on Arc Testnet |

**`arcflow-backend/.env`** — backend runtime:

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | Backend API port (default: `3000`) |
| `CIRCLE_API_KEY` | Optional | Circle API key — enables live same-chain payout routing |
| `CIRCLE_WALLET_ID` | Required if `CIRCLE_API_KEY` set | Circle wallet ID for source funds |
| `CIRCLE_ENTITY_SECRET` | Optional | Circle entity secret (Developer Controlled Wallets SDK) |
| `CIRCLE_WEBHOOK_SECRET` | Optional | HMAC-SHA256 secret for webhook verification |
| `PAYOUT_STORE_PATH` | Optional | File path for persistent payout state (e.g. `./data/payouts.json`) |
| `ARC_TESTNET_RPC_URL` | Yes (worker) | JSON-RPC endpoint for Arc Testnet |
| `ARC_PAYOUT_ROUTER_ADDRESS` | Yes (worker) | Deployed `ArcFlowPayoutRouter` address |

**Example `.env`:**

```env
ARC_TESTNET_RPC_URL=https://rpc.arc-testnet.example.com
ARC_PRIVATE_KEY=0xabc123...def456
ARC_FEE_COLLECTOR=0xYourFeeCollectorAddress
ARC_FEE_BPS=0
```

> **Never commit your `.env` file.** It is included in `.gitignore`.

---

## Screenshots / Demo

> No live deployment is available for this MVP. Run locally using the steps above.

| View | Description |
|---|---|
| **Dashboard** | 4-metric bento grid — USDC locked in escrow, locked in streams, pending batches, total obligations + Quick Actions |
| **Escrow & Disputes** | My Escrows list, lookup by ID, 2-step dispute confirmation, arbitrator resolve |
| **Payroll & Vesting** | My Streams list, vesting progress bar, cliff/end timeline, withdraw and 2-step revoke |
| **Payout Batches** | My Batches list, dynamic recipient grid with per-chain destination, batch status table with Circle transfer IDs |

```markdown
![Dashboard](./docs/screenshots/dashboard.png)
![Escrow](./docs/screenshots/escrow.png)
![Payroll](./docs/screenshots/payroll.png)
![Payouts](./docs/screenshots/payouts.png)
```

---

## API Reference

Base URL: `http://localhost:3000`

### `GET /status`

Returns backend health.

```bash
curl http://localhost:3000/status
```

```json
{ "status": "ok", "network": "arc-testnet" }
```

---

### `GET /payouts/:batchId/status`

Returns a single-pass aggregated summary and the full payout list for a batch.

```bash
curl http://localhost:3000/payouts/1/status
```

```json
{
  "batchId": "1",
  "totalPayouts": 3,
  "totalAmount": "5000.000000",
  "ready": true,
  "summary": { "queued": 1, "processing": 1, "completed": 1, "failed": 0 },
  "payouts": [
    {
      "index": 0,
      "recipient": "0xabc...def",
      "amount": "2500.000000",
      "destinationChain": "BASE-SEPOLIA",
      "status": "COMPLETED",
      "circleTransferId": "circle_transfer_1234_5678"
    }
  ]
}
```

> `totalAmount` is computed with exact BigInt arithmetic (no floating-point drift), always formatted to 6 decimal places.

---

### `GET /payouts/:batchId/:index/status`

Returns status for a single recipient within a batch.

```bash
curl http://localhost:3000/payouts/1/0/status
```

**Status values:** `QUEUED` · `PROCESSING` · `COMPLETED` · `FAILED`

---

### `POST /webhooks/circle`

Receives Circle transfer status callbacks. Requires `Content-Type: application/json` and, when `CIRCLE_WEBHOOK_SECRET` is configured, the `x-circle-signature` HMAC-SHA256 hex header.

```bash
curl -X POST http://localhost:3000/webhooks/circle \
  -H "Content-Type: application/json" \
  -H "x-circle-signature: <hmac-hex>" \
  -d '{"transfer":{"id":"circle_transfer_123","status":"complete"}}'
```

```json
{ "received": true, "updated": true }
```

---

### `GET /escrows/:id`

Returns escrow details from the in-memory `EscrowStore` (populated by `EscrowStreamWorker`). Falls back to a direct on-chain read if not yet indexed. Returns 404 if the escrow does not exist or contracts are not deployed.

```bash
curl http://localhost:3000/escrows/1
```

```json
{
  "id": "1",
  "payer": "0xAlice...",
  "payee": "0xBob...",
  "token": "0xUsdc...",
  "amount": "5000.000000",
  "expiry": 1740000000,
  "arbitrator": "0xArbiter...",
  "status": "OPEN",
  "updatedAt": "2026-02-28T12:00:00.000Z"
}
```

**Status values:** `OPEN` · `DISPUTED` · `RELEASED` · `REFUNDED`

---

### `GET /streams/:id`

Returns stream details from the in-memory `StreamStore`. Falls back to a direct on-chain read if not yet indexed. Returns 404 if the stream does not exist.

```bash
curl http://localhost:3000/streams/1
```

```json
{
  "id": "1",
  "employer": "0xAlice...",
  "employee": "0xBob...",
  "token": "0xUsdc...",
  "totalAmount": "12000.000000",
  "start": 1740000000,
  "cliff": 1742678400,
  "end": 1771536000,
  "withdrawn": "1000.000000",
  "revoked": false,
  "updatedAt": "2026-02-28T12:00:00.000Z"
}
```

---

## Tests

### Smart contract tests — 31 tests

```bash
# From project root
npm test
```

Covers `ArcFlowEscrow`, `ArcFlowStreams`, and `ArcFlowPayoutRouter` using Hardhat + Chai matchers. Scenarios include happy paths, zero-address and zero-amount reverts, time-based auto-release, dispute resolution, stream vesting at 0%/50%/100%, revoke with pro-rata split, and large multi-recipient batches.

### Backend tests — 61 tests

```bash
cd arcflow-backend
npm test
```

| File | Tests | Coverage |
|---|---|---|
| `test/circleClient.test.ts` | 15 | Chain mapping, CCTP domain IDs, auth headers, stub responses |
| `test/eventDecoding.test.ts` | 4 | `PayoutInstruction` ABI event encoding and decoding |
| `test/payoutStore.test.ts` | 25 | set/get/has, sorted getBatch, secondary-index correctness, overwrite semantics, cross-batch isolation; **+8 file-persistence tests**: ENOENT first-run, round-trip reload, Date deserialization, batchIndex rebuild, transferIndex rebuild, update persistence, debounce coalescing, no-filePath guard |
| `test/batchSummary.test.ts` | 17 | `amountToMicro` (exact parsing), `formatMicro` (round-trip), BigInt vs float divergence proof, `computeBatchSummary`, performance benchmark |

Notable: `batchSummary.test.ts` includes a documented benchmark showing the single-pass `Number`-integer approach is **1.67× faster** than 5 separate `filter`/`reduce` float passes for N = 5 000 payouts × 200 runs.

### Type checking (all packages)

```bash
# Contracts
npx tsc --noEmit

# Backend
cd arcflow-backend && npx tsc --noEmit

# Frontend
cd arcflow-frontend && npx tsc --noEmit
```

---

## Roadmap

- [x] Wire frontend to real contract calls via ethers.js — `contracts.ts` helper with full approval flow
- [x] My Escrows / My Streams / My Batches list views — localStorage-persisted, click-to-load
- [x] Live Circle same-chain payout routing — `circleClient.ts` calls Circle Wallets API live when `CIRCLE_API_KEY` is set
- [x] Circle Gateway cross-chain routing — `createCrossChainTransfer()` calls CCTP Gateway (stubs if `CIRCLE_BURN_TOKEN_ADDRESS` unset)
- [x] Persist payout state across restarts — optional JSON file via `PAYOUT_STORE_PATH`; 200 ms debounced writes, full index rebuild on load
- [x] EscrowStreamWorker — 1 000-block history replay + live subscriptions for all 8 escrow/stream event types
- [x] EscrowStore + StreamStore — O(1) indexed lookups backing real `/escrows/:id` and `/streams/:id` endpoints
- [x] USYC (Hashnote) token support across all three primitives
- [x] Interactive Demo page — `/demo` with all three flows, no wallet required
- [x] Network mismatch detection — warn and prompt auto-switch to Arc Testnet
- [ ] CCTP EIP-712 BurnIntent full sign-and-mint flow (cross-chain live completion)
- [ ] Persistent database (replace in-memory stores for production restarts)
- [ ] Historical obligation charts on the dashboard
- [ ] Multi-organisation support (org switcher for teams managing multiple wallets)
- [ ] Fiat equivalent display (USDC → USD estimate via price oracle)
- [ ] Mainnet deployment and production security audit

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a branch from `main`.
2. Make your changes — ensure all tests pass (`npm test` at root, `npm test` in `arcflow-backend/`).
3. Run type checks across all packages before opening a PR.
4. Open a Pull Request with a clear description of what changed and why.
5. For bugs, open an issue first to align on the fix before submitting a PR.

**Please do not:**
- Hardcode secrets, RPC URLs, or private keys anywhere in source.
- Change smart contract behaviour without updating documentation and frontend expectations.
- Introduce breaking API changes without a migration note in the PR description.

---

## License

This project is licensed under the **MIT License**. See the [`LICENSE`](./LICENSE) file for details.

---

## Contact / Support

| | |
|---|---|
| **Issues / Bugs** | [Open an issue on GitHub](https://github.com/MasteraSnackin/ArcFlow-Treasury/issues) |
| **Repository** | [github.com/MasteraSnackin/ArcFlow-Treasury](https://github.com/MasteraSnackin/ArcFlow-Treasury) |
| **Maintainer** | `<ADD MAINTAINER NAME>` |
| **Email** | `<ADD CONTACT EMAIL>` |

> Built for the Arc + Circle hackathon.
> Arc Testnet block explorer: [testnet.arcscan.app](https://testnet.arcscan.app/)
> Testnet USDC/EURC faucet: [faucet.circle.com](https://faucet.circle.com/) → select **Arc Testnet**
