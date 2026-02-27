# Environment Setup – ArcFlow Treasury

This document describes how to set up local environments for contracts, backend, and frontend.

## 1. Common Requirements

- Node.js LTS (18.x or 20.x)
- npm
- Git
- Access to an Arc testnet RPC URL
- Arc testnet wallet with:
  - Native gas (if required by the network)
  - USDC/EURC test tokens, or a custom ERC‑20 used as USDC

> Note: Replace `<PLACEHOLDER>` values below with real URLs, keys, or addresses.

---

## 2. Contracts Environment (`arcflow-contracts`)

### 2.1 Install Dependencies

```bash
cd arcflow-contracts
npm install
```

### 2.2 Configure `.env`

Create `arcflow-contracts/.env`:

```bash
ARC_RPC_URL=https://<your-arc-testnet-rpc>
ARC_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_WITH_TEST_FUNDS
```

### 2.3 Compile and Deploy

```bash
npx hardhat compile
npm run deploy:arc
```

Record the printed addresses for:

- `ArcFlowEscrow`
- `ArcFlowStreams`
- `ArcFlowPayoutRouter`

---

## 3. Backend Environment (`arcflow-backend`)

### 3.1 Install Dependencies

```bash
cd arcflow-backend
npm install
```

### 3.2 Configure `.env`

Create `arcflow-backend/.env`:

```bash
PORT=3000
ARC_RPC_URL=https://<your-arc-testnet-rpc>
ARC_PAYOUT_ROUTER_ADDRESS=0x...   # ArcFlowPayoutRouter from deployment
# CIRCLE_API_KEY=<OPTIONAL_CIRCLE_API_KEY_FOR_FUTURE_INTEGRATION>
```

### 3.3 Run Services

```bash
# Terminal 1 – HTTP API
npm run dev:server

# Terminal 2 – Event listener worker
npm run dev:worker
```

Verify:

- `GET http://localhost:3000/status` returns `{ "status": "ok", ... }`.

---

## 4. Frontend Environment (`arcflow-frontend`)

### 4.1 Install Dependencies

```bash
cd arcflow-frontend
npm install
```

### 4.2 Configure `.env`

Create `arcflow-frontend/.env` or `.env.local`:

```bash
VITE_ARC_ESCROW_ADDRESS=0x...           # ArcFlowEscrow address
VITE_ARC_STREAM_ADDRESS=0x...           # ArcFlowStreams address
VITE_ARC_PAYOUT_ROUTER_ADDRESS=0x...    # ArcFlowPayoutRouter address
VITE_USDC_ADDRESS=0x...                 # USDC (or test token) on Arc
VITE_BACKEND_URL=http://localhost:3000
```

Ensure your wallet is configured for Arc testnet and has USDC/EURC.

### 4.3 Run the Frontend

```bash
npm run dev
```

Open the printed URL (e.g. `http://localhost:5173`) in your browser.

---

## 5. Known Pitfalls

- **Approvals:** ERC‑20 allowances must be granted for each contract (Escrow, Streams, Router) before funding operations.
- **Chain ID mismatches:** Ensure your wallet network matches the Arc testnet RPC used in `.env`.
- **USDC address:** Use the correct USDC/EURC testnet address or a deployed test token; wrong addresses will cause transfers to fail.

