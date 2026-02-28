# ArcFlow Treasury — Deployment Guide

Complete step-by-step guide to deploy and run ArcFlow Treasury on Arc Testnet.

## Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Arc testnet wallet funded with USDC (gas token on Arc)
- [ ] Arc testnet RPC URL
- [ ] USDC and EURC token addresses on Arc Testnet

---

## Step 1: Initial Setup

### Clone the repository

```bash
git clone https://github.com/MasteraSnackin/ArcFlow-Treasury.git
cd ArcFlow-Treasury
```

### Install all dependencies

```bash
npm install                                    # contracts (root)
cd arcflow-backend && npm install && cd ..     # backend
cd arcflow-frontend && npm install && cd ..    # frontend
```

### Verify setup

```bash
npm run verify-setup
```

---

## Step 2: Configure Root Environment (Contracts)

Create `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env`:

```env
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PRIVATE_KEY=0xYourPrivateKeyWithTestFunds   # 0x + 64 hex chars
ARC_FEE_COLLECTOR=0xYourFeeCollectorAddress     # address that receives protocol fees
ARC_FEE_BPS=0                                   # 0 = no fee; 100 = 1%
```

> **Never commit your `.env` file.** It is in `.gitignore`.

---

## Step 3: Compile Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 4 Solidity files successfully (evm target: paris).
```

Verify TypeScript types were generated:
```bash
ls typechain-types/
```

---

## Step 4: Run Contract Tests

```bash
npm test
```

Expected output:
```
  31 passing (2s)
```

All 31 tests must pass before deploying.

---

## Step 5: Deploy to Arc Testnet

```bash
npm run deploy:arc
```

Expected output:
```
Deploying contracts with: 0xYourAddress
Escrow feeCollector: 0xYourAddress
Escrow feeBps: 0

ArcFlowEscrow deployed to:      0xABCD...1234
ArcFlowStreams deployed to:     0xEF56...7890
ArcFlowPayoutRouter deployed to: 0x1234...ABCD

Env values for frontend/backend:
VITE_ARC_ESCROW_ADDRESS=  0xABCD...1234
VITE_ARC_STREAMS_ADDRESS= 0xEF56...7890
VITE_ARC_PAYOUT_ROUTER_ADDRESS= 0x1234...ABCD
```

**Save these addresses.** You need them in the next two steps.

---

## Step 6: Configure Backend

```bash
cd arcflow-backend
cp .env.example .env
```

Edit `arcflow-backend/.env`:

```env
# Arc Testnet
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PAYOUT_ROUTER_ADDRESS=0x1234...ABCD       # from Step 5

# Server
PORT=3000

# Circle API
# Leave blank → stub mode (prints fake IDs, good for local dev)
# Set a real key → live same-chain routing via Circle Wallets API
CIRCLE_API_KEY=
CIRCLE_WALLET_ID=                              # required when CIRCLE_API_KEY is set
CIRCLE_ENTITY_SECRET=                          # Developer Controlled Wallets SDK (optional)
CIRCLE_WEBHOOK_SECRET=                         # HMAC key for webhook verification (optional)

# Persistence
# Leave blank → payouts are lost on restart (fine for dev/demo)
# Set a path → payouts survive restarts; directory must exist
PAYOUT_STORE_PATH=./data/payouts.json
```

---

## Step 7: Configure Frontend

```bash
cd arcflow-frontend
cp .env.example .env
```

Edit `arcflow-frontend/.env`:

```env
VITE_ARC_ESCROW_ADDRESS=0xABCD...1234          # from Step 5
VITE_ARC_STREAMS_ADDRESS=0xEF56...7890         # from Step 5
VITE_ARC_PAYOUT_ROUTER_ADDRESS=0x1234...ABCD  # from Step 5
VITE_USDC_ADDRESS=0x...                        # USDC on Arc Testnet
VITE_EURC_ADDRESS=0x...                        # EURC on Arc Testnet
```

---

## Step 8: Run Backend Tests

```bash
cd arcflow-backend
npm test
```

Expected output:
```
Test Files  4 passed (4)
Tests       61 passed (61)
```

---

## Step 9: Start Backend

### Option A: Server + Worker (recommended)

```bash
cd arcflow-backend
npm run dev:server
```

Expected output:
```
2026-02-28 10:00:00 [info]: PayoutWorker initialized {...}
2026-02-28 10:00:00 [info]: Connected to network {"chainId":"5042002"}
2026-02-28 10:00:00 [info]: Fetching historical events {...}
2026-02-28 10:00:00 [info]: Found 0 historical PayoutInstruction events
2026-02-28 10:00:00 [info]: PayoutWorker: Listening for new events...
2026-02-28 10:00:00 [info]: Server running on port 3000
```

### Option B: Worker only (no HTTP API)

```bash
npm run dev:worker
```

---

## Step 10: Verify Backend is Running

```bash
curl http://localhost:3000/status
```

Expected:
```json
{ "status": "ok", "network": "arc-testnet" }
```

---

## Step 11: Start Frontend

```bash
cd arcflow-frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

1. Click **Connect Wallet** — MetaMask will prompt.
2. If your wallet is not on Arc Testnet (Chain ID 5042002) the UI will warn and offer to switch.
3. Use the USDC faucet at [faucet.circle.com](https://faucet.circle.com/) (select Arc Testnet) to fund your wallet.

---

## Step 12: End-to-End Test

### Create a batch payout via UI

1. Navigate to **Payout Batches** → **New Batch Payout**.
2. Add recipients, amounts, and destination chains (`ARC`, `BASE`, `AVAX`, `ETH`, `ARB`).
3. Confirm the ERC-20 approval + `createBatchPayout` MetaMask transactions.
4. Note the batch ID shown in the **My Batches** panel.

### Check backend logs

You should see:
```
2026-02-28 10:05:00 [info]: Processing PayoutInstruction event {batchId:"0",index:0,...}
2026-02-28 10:05:00 [info]: Circle API (STUB): Creating transfer {...}
2026-02-28 10:05:00 [info]: Payout created successfully {payoutKey:"0-0",circleTransferId:"circle_transfer_...",status:"QUEUED"}
```

### Query batch status via API

```bash
curl http://localhost:3000/payouts/0/status
```

Expected response:
```json
{
  "batchId": "0",
  "totalPayouts": 3,
  "totalAmount": "600.000000",
  "ready": true,
  "summary": { "queued": 3, "processing": 0, "completed": 0, "failed": 0 },
  "payouts": [
    {
      "index": 0,
      "recipient": "0xRecipient1Address",
      "amount": "100.000000",
      "destinationChain": "ARC-TESTNET",
      "status": "QUEUED",
      "circleTransferId": "circle_transfer_..."
    }
  ]
}
```

---

## Troubleshooting

### "Invalid account: private key too short"

`ARC_PRIVATE_KEY` must be `0x` + 64 hex characters (66 chars total). Re-export from MetaMask.

### "Cannot find module 'hardhat'"

Run `npm install` in the project root.

### "Worker not starting / Connection failed"

1. Check `ARC_TESTNET_RPC_URL` is valid: `curl <YOUR_RPC_URL>`
2. Check RPC allows WebSocket connections (worker uses WSS for real-time events)

### "No events detected"

1. Verify the batch payout transaction was mined on-chain (check `testnet.arcscan.app`)
2. Confirm `ARC_PAYOUT_ROUTER_ADDRESS` in `arcflow-backend/.env` matches the deployed address

### "Port 3000 already in use"

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Frontend shows "No wallet detected"

Install [MetaMask](https://metamask.io/) browser extension.

### Contract call reverts with "token address not configured"

Ensure `VITE_USDC_ADDRESS` and `VITE_EURC_ADDRESS` are set in `arcflow-frontend/.env` and the dev server was restarted after editing.

---

## Enabling Live Circle Routing (Same-Chain)

Set in `arcflow-backend/.env`:

```env
CIRCLE_API_KEY=<your-circle-api-key>
CIRCLE_WALLET_ID=<your-circle-wallet-id>
```

The Circle client will switch from stub mode to live mode automatically. Same-chain transfers (ARC → ARC) call `api.circle.com/v1/w3s/wallets/{walletId}/transfers`.

**Cross-chain transfers** (ARC → BASE, ETH, etc.) still use the stub path. Full cross-chain routing requires EIP-712 BurnIntent signing (see `arcflow-backend/src/services/circleClient.ts` comments and `circlefin/arc-multichain-wallet/lib/circle/gateway-sdk.ts`).

---

## Production Considerations

Before going to mainnet:

- [ ] Smart contract security audit
- [ ] Replace `PAYOUT_STORE_PATH` JSON with PostgreSQL/MongoDB
- [ ] Add API authentication (JWT or API keys)
- [ ] Add rate limiting middleware
- [ ] Enable HTTPS + configure CORS
- [ ] Set up secret management (AWS Secrets Manager / HashiCorp Vault)
- [ ] Wire cross-chain Circle routing (BurnIntent + CCTP polling)
- [ ] Add retry logic with exponential backoff for Circle API calls
- [ ] Set up monitoring (Prometheus + Grafana or DataDog)
- [ ] Configure CI/CD pipeline

---

## Success Checklist

- [ ] All 31 contract tests passing
- [ ] Contracts deployed; addresses saved
- [ ] Frontend `.env` filled with contract + token addresses
- [ ] Backend `.env` filled with router address
- [ ] All 61 backend tests passing
- [ ] Backend server running; `curl http://localhost:3000/status` returns `ok`
- [ ] Frontend running at `http://localhost:5173`
- [ ] Wallet connects to Arc Testnet (Chain ID 5042002)
- [ ] Test escrow created → MetaMask prompt shown → ID returned
- [ ] Test batch created → backend logs show `PayoutInstruction` event → status queryable

---

## Resources

- **Arc Testnet Explorer**: [testnet.arcscan.app](https://testnet.arcscan.app/)
- **USDC/EURC Faucet**: [faucet.circle.com](https://faucet.circle.com/) — select **Arc Testnet**
- **Circle Developer Docs**: [developers.circle.com](https://developers.circle.com/)
- **Hardhat Docs**: [hardhat.org/docs](https://hardhat.org/docs)
- **ethers.js v6 Docs**: [docs.ethers.org](https://docs.ethers.org/)
- **arc-multichain-wallet reference**: [github.com/circlefin/arc-multichain-wallet](https://github.com/circlefin/arc-multichain-wallet)
