# ArcFlow Treasury - Quick Start

**30-Second Overview**: Smart contracts + backend for stablecoin treasury operations on Arc testnet.

---

## 🚀 Installation (5 minutes)

```bash
# 1. Install dependencies
npm install
cd arcflow-backend && npm install && cd ..
cd arcflow-frontend && npm install && cd ..

# 2. Verify setup
npm run verify-setup
```

---

## ⚙️ Configuration (2 minutes)

### Root `.env`
```bash
ARC_TESTNET_RPC_URL=https://your-arc-rpc
ARC_PRIVATE_KEY=0x...
ARC_FEE_BPS=100
```

### Backend `.env` (after deployment)
```bash
cd arcflow-backend
cp .env.example .env
# Edit with your values (ARC_TESTNET_RPC_URL, ARC_PAYOUT_ROUTER_ADDRESS, etc.)
# Optional: set CIRCLE_API_KEY + CIRCLE_WALLET_ID for live Circle routing
# Optional: set PAYOUT_STORE_PATH=./data/payouts.json for persistence across restarts
```

### Frontend `.env` (after deployment)
```bash
cd arcflow-frontend
cp .env.example .env
# Fill VITE_ARC_ESCROW_ADDRESS, VITE_ARC_STREAMS_ADDRESS, VITE_ARC_PAYOUT_ROUTER_ADDRESS
# Fill VITE_USDC_ADDRESS, VITE_EURC_ADDRESS
```

---

## 🧪 Testing (1 minute)

```bash
# Contract tests (31 tests)
npm test

# Backend tests (61 tests — 4 files)
cd arcflow-backend && npm test

# Frontend type check (0 errors)
cd arcflow-frontend && npx tsc --noEmit
```

---

## 🚢 Deployment (3 minutes)

```bash
# 1. Compile
npm run compile

# 2. Deploy to Arc testnet
npm run deploy:arc

# 3. Save the output addresses!
# Example:
# ArcFlowEscrow: 0xABCD...
# ArcFlowStreams: 0xEF56...
# ArcFlowPayoutRouter: 0x1234...

# 4. Update backend .env with router address
cd arcflow-backend
# Edit .env: ARC_PAYOUT_ROUTER_ADDRESS=0x1234...
```

---

## ▶️ Running (1 minute)

```bash
# Start backend (from arcflow-backend/)
npm run dev:server

# Or just the worker
npm run dev:worker
```

---

## 🧪 Testing E2E

```bash
# 1. Health check
curl http://localhost:3000/status

# 2. Create batch payout (via Hardhat console)
npx hardhat console --network arcTestnet
# See DEPLOYMENT_GUIDE.md for full example

# 3. Check batch status
curl http://localhost:3000/payouts/0/status
```

---

## 📚 Key Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts |
| `npm test` | Run contract tests |
| `npm run deploy:arc` | Deploy to Arc testnet |
| `npm run verify-setup` | Verify project setup |
| `npm run clean` | Clean build artifacts |

---

## 📁 Project Structure

```
├── contracts/              # Smart contracts (Escrow, Streams, Router)
├── scripts/               # Deployment scripts
├── test/                  # Contract tests (31 passing)
├── arcflow-backend/       # Backend worker + API
│   ├── src/
│   │   ├── config/        # Arc provider, logger
│   │   ├── services/      # Circle client (stub → live when CIRCLE_API_KEY set)
│   │   ├── stores/        # PayoutStore (in-memory + optional JSON file)
│   │   ├── workers/       # Event listener (PayoutWorker)
│   │   └── server.ts      # REST API + HMAC webhook
│   ├── data/              # Payout JSON snapshots (gitignored; needs PAYOUT_STORE_PATH)
│   └── test/              # Backend tests (61 passing)
├── arcflow-frontend/      # React SPA
│   ├── src/
│   │   ├── lib/contracts.ts  # ethers v6 helpers + approveIfNeeded
│   │   └── pages/         # Dashboard, EscrowPage, PayrollPage, PayoutsPage
│   └── .env.example       # VITE_ contract addresses
├── .env                   # Contract deployment config
└── DEPLOYMENT_GUIDE.md    # Full deployment docs
```

---

## 🎯 Key Features

### Smart Contracts
- **ArcFlowEscrow**: On-chain escrows with dispute resolution
- **ArcFlowStreams**: Vesting streams for payroll
- **ArcFlowPayoutRouter**: Batch payouts with Circle integration

### Backend
- **Event Listener**: Monitors `PayoutInstruction` events
- **Circle Integration**: Stub for Wallets/Gateway/CCTP
- **REST API**: Query payout and batch status

---

## 🔧 Troubleshooting

**Compilation fails?**
```bash
npm install
npm run compile
```

**Tests fail?**
```bash
# Make sure you're using Node 18+
node --version
npm test
```

**Backend won't start?**
```bash
# Check .env is configured
cd arcflow-backend
cat .env
# Verify router address is correct
```

**No events detected?**
```bash
# 1. Verify batch payout was created on-chain
# 2. Check router address in backend .env
# 3. Check RPC URL is accessible
curl <YOUR_RPC_URL>
```

---

## 📖 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment walkthrough
- **[CONTRACTS_README.md](./CONTRACTS_README.md)** - Contract documentation
- **[arcflow-backend/README.md](./arcflow-backend/README.md)** - Backend documentation
- **[CLAUDE.md](./CLAUDE.md)** - Project requirements and architecture

---

## ✅ Quick Checklist

- [ ] Dependencies installed (`npm install` in all three directories)
- [ ] Setup verified (`npm run verify-setup` passes)
- [ ] Tests passing (`npm test` — 31/31 contracts, 61/61 backend)
- [ ] Root `.env` configured with RPC URL and private key
- [ ] Contracts deployed (`npm run deploy:arc`)
- [ ] Frontend `.env` filled with deployed contract addresses + token addresses
- [ ] Backend `.env` configured with router address
- [ ] Backend running (`npm run dev:server`)
- [ ] Frontend running (`cd arcflow-frontend && npm run dev`)
- [ ] Health check works (`curl http://localhost:3000/status`)

---

## 🎉 Success Criteria

**You're ready when:**
1. ✅ All 92 tests passing (31 contract + 61 backend)
2. ✅ Contracts deployed to Arc testnet; addresses in frontend `.env`
3. ✅ Backend server running and responsive (`curl http://localhost:3000/status`)
4. ✅ Frontend running at `http://localhost:5173` — wallet connects, MetaMask prompts on create

---

## 🆘 Need Help?

1. Check **Troubleshooting** section above
2. Review **DEPLOYMENT_GUIDE.md** for detailed steps
3. Check logs: `arcflow-backend/combined.log` and `error.log`
4. Review contract tests for usage examples

---

**Total setup time: ~15 minutes** ⚡

Happy building! 🏗️
