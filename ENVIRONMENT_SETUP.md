# Environment Setup — ArcFlow Treasury

This document describes how to configure local environments for all three packages: contracts (root), backend, and frontend.

---

## Common Requirements

- Node.js LTS (18.x or 20.x recommended)
- npm 9+
- A MetaMask wallet configured for Arc Testnet:
  - **Network name**: Arc Testnet
  - **RPC URL**: your Arc Testnet RPC endpoint
  - **Chain ID**: `5042002`
  - **Currency symbol**: USDC (gas is paid in USDC on Arc)
- USDC and/or EURC test tokens — obtain from [faucet.circle.com](https://faucet.circle.com/) (select **Arc Testnet**)

> Replace `<PLACEHOLDER>` values below with your actual URLs, keys, or addresses.

---

## 1. Contracts Environment (root package)

### Install

```bash
# From project root
npm install
```

### Configure `.env`

Create `.env` at the project root (or copy from `.env.example`):

```env
# Arc Testnet
ARC_TESTNET_RPC_URL=https://<your-arc-testnet-rpc>
ARC_PRIVATE_KEY=0x<64-hex-chars>   # Must be exactly 0x + 64 hex characters

# Protocol fee configuration for ArcFlowEscrow
ARC_FEE_COLLECTOR=0x<fee-collector-address>  # Leave empty to use the deployer address
ARC_FEE_BPS=0                                 # Basis points: 0 = no fee, 100 = 1%
```

### Compile and Deploy

```bash
# Compile Solidity
npm run compile

# Deploy all three contracts to Arc Testnet
npm run deploy:arc
```

The deploy script prints the three contract addresses and suggested environment variable values for the frontend and backend. **Save these addresses.**

---

## 2. Backend Environment (`arcflow-backend/`)

### Install

```bash
cd arcflow-backend
npm install
```

### Configure `.env`

```bash
cd arcflow-backend
cp .env.example .env
```

`arcflow-backend/.env`:

```env
# Arc Testnet (required for event worker)
ARC_TESTNET_RPC_URL=https://<your-arc-testnet-rpc>
ARC_PAYOUT_ROUTER_ADDRESS=0x...   # ArcFlowPayoutRouter from deployment

# Server
PORT=3000

# Circle API
# Leave blank → stub mode (returns fake transfer IDs; good for local dev)
# Set CIRCLE_API_KEY → live same-chain routing via Circle Wallets API
CIRCLE_API_KEY=
CIRCLE_WALLET_ID=                 # required when CIRCLE_API_KEY is set
CIRCLE_ENTITY_SECRET=             # Developer Controlled Wallets SDK (optional)
CIRCLE_WEBHOOK_SECRET=            # HMAC-SHA256 key for webhook verification (optional)

# Payout state persistence
# Leave blank → payout state is lost on restart (fine for demos)
# Set a path → payout state is written to JSON and reloaded on startup
PAYOUT_STORE_PATH=./data/payouts.json
```

### Run

```bash
# Terminal 1 — HTTP API + event worker
npm run dev:server

# Terminal 2 — event worker only (no HTTP API)
npm run dev:worker
```

Verify: `GET http://localhost:3000/status` → `{ "status": "ok" }`

---

## 3. Frontend Environment (`arcflow-frontend/`)

### Install

```bash
cd arcflow-frontend
npm install
```

### Configure `.env`

```bash
cd arcflow-frontend
cp .env.example .env
```

`arcflow-frontend/.env`:

```env
# Contract addresses (from deployment step)
VITE_ARC_ESCROW_ADDRESS=0x...           # ArcFlowEscrow address
VITE_ARC_STREAMS_ADDRESS=0x...          # ArcFlowStreams address
VITE_ARC_PAYOUT_ROUTER_ADDRESS=0x...    # ArcFlowPayoutRouter address

# Token addresses on Arc Testnet
VITE_USDC_ADDRESS=0x...                 # USDC ERC-20 on Arc Testnet
VITE_EURC_ADDRESS=0x...                 # EURC ERC-20 on Arc Testnet
```

> **Note**: All `VITE_` variables are baked into the build at compile time. After editing `.env`, restart `npm run dev` for changes to take effect.

### Run

```bash
npm run dev
# → http://localhost:5173
```

### Type check

```bash
npx tsc --noEmit   # must return 0 errors
```

---

## 4. Environment Variable Reference

### Root `.env` (Hardhat / Contracts)

| Variable | Required | Description |
|----------|----------|-------------|
| `ARC_TESTNET_RPC_URL` | Yes | JSON-RPC HTTP endpoint for Arc Testnet |
| `ARC_PRIVATE_KEY` | Yes | Deployer wallet private key (`0x` + 64 hex chars) |
| `ARC_FEE_COLLECTOR` | Optional | Address receiving protocol fees; defaults to deployer if omitted |
| `ARC_FEE_BPS` | Optional | Fee in basis points; `0` = no fee |

### `arcflow-backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `ARC_TESTNET_RPC_URL` | Yes (worker) | JSON-RPC endpoint for Arc Testnet |
| `ARC_PAYOUT_ROUTER_ADDRESS` | Yes (worker) | Deployed `ArcFlowPayoutRouter` address |
| `PORT` | Optional | HTTP server port (default: `3000`) |
| `CIRCLE_API_KEY` | Optional | Set to enable live same-chain Circle routing |
| `CIRCLE_WALLET_ID` | Required if API key set | Circle wallet to fund transfers from |
| `CIRCLE_ENTITY_SECRET` | Optional | Developer Controlled Wallets SDK init secret |
| `CIRCLE_WEBHOOK_SECRET` | Optional | HMAC-SHA256 secret for webhook verification |
| `PAYOUT_STORE_PATH` | Optional | File path for JSON payout state (e.g. `./data/payouts.json`) |

### `arcflow-frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ARC_ESCROW_ADDRESS` | After deploy | `ArcFlowEscrow` contract address |
| `VITE_ARC_STREAMS_ADDRESS` | After deploy | `ArcFlowStreams` contract address |
| `VITE_ARC_PAYOUT_ROUTER_ADDRESS` | After deploy | `ArcFlowPayoutRouter` contract address |
| `VITE_USDC_ADDRESS` | Yes | USDC ERC-20 address on Arc Testnet |
| `VITE_EURC_ADDRESS` | Yes | EURC ERC-20 address on Arc Testnet |

---

## 5. Known Pitfalls

- **ERC-20 approvals**: Each contract (`ArcFlowEscrow`, `ArcFlowStreams`, `ArcFlowPayoutRouter`) requires a separate ERC-20 allowance. The frontend's `approveIfNeeded()` handles this automatically, checking the allowance before calling `approve()`.
- **Chain ID mismatch**: If MetaMask is on the wrong network, the UI will warn and offer to auto-switch to Arc Testnet (Chain ID `5042002`).
- **Wrong USDC address**: Using a wrong token address causes transfers to fail silently or revert. Always use the official USDC/EURC addresses for Arc Testnet.
- **VITE_ variable not loaded**: If a contract address appears blank in the UI, restart the Vite dev server after editing `.env`.
- **Private key format**: `ARC_PRIVATE_KEY` must be exactly `0x` followed by 64 hex characters (66 total). Keys exported from MetaMask as a plain hex string need `0x` prepended.
