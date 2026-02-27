# ArcFlow Treasury - Deployment Guide

Complete step-by-step guide to deploy and run ArcFlow Treasury on Arc testnet.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Git installed (optional)
- [ ] Arc testnet account created
- [ ] Arc testnet wallet funded with native tokens for gas
- [ ] Arc testnet RPC URL obtained
- [ ] Test USDC/EURC token addresses on Arc testnet

---

## Step 1: Initial Setup

### Clone/Download Project

```bash
cd "ArcFlow Treasury"
```

### Install Dependencies

```bash
# Install contract dependencies
npm install

# Install backend dependencies
cd arcflow-backend
npm install
cd ..
```

---

## Step 2: Configure Environment

### Root `.env` (Contracts)

Create/edit `.env` in the project root:

```bash
# Arc Testnet Configuration
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PRIVATE_KEY=0xYourPrivateKeyWithTestFunds

# Optional: Fee configuration for ArcFlowEscrow
ARC_FEE_COLLECTOR=0xYourFeeCollectorAddress  # Leave empty to use deployer
ARC_FEE_BPS=100  # 100 basis points = 1%
```

**Security Warning**: Never commit your `.env` file or share your private key!

---

## Step 3: Compile Contracts

```bash
npm run compile
```

**Expected Output:**
```
Compiled 4 Solidity files successfully (evm target: paris).
```

**Verify TypeScript types were generated:**
```bash
ls typechain-types/
```

---

## Step 4: Run Contract Tests

```bash
npm test
```

**Expected Output:**
```
  31 passing (2s)
```

If all tests pass, you're ready to deploy! ✅

---

## Step 5: Deploy to Arc Testnet

```bash
npm run deploy:arc
```

**Expected Output:**
```
Deploying contracts with: 0xYourAddress
Escrow feeCollector: 0xYourAddress
Escrow feeBps: 100

ArcFlowEscrow deployed to: 0xABCD...1234
ArcFlowStreams deployed to: 0xEF56...7890
ArcFlowPayoutRouter deployed to: 0x1234...ABCD

Env values for frontend/backend:
VITE_ARC_ESCROW_ADDRESS= 0xABCD...1234
VITE_ARC_STREAM_ADDRESS= 0xEF56...7890
VITE_ARC_PAYOUT_ROUTER_ADDRESS= 0x1234...ABCD
```

**⚠️ IMPORTANT: Save these addresses!** You'll need them for the backend.

---

## Step 6: Configure Backend

### Create Backend `.env`

```bash
cd arcflow-backend
cp .env.example .env
```

### Edit `arcflow-backend/.env`

```bash
# Arc Testnet Configuration
ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc-url
ARC_PAYOUT_ROUTER_ADDRESS=0x1234...ABCD  # From deployment step

# Server Configuration
PORT=3000
NODE_ENV=development

# Circle API Configuration (stubbed for now)
CIRCLE_API_KEY=stub_key_not_required_yet
CIRCLE_ENTITY_SECRET=stub_secret_not_required_yet

# Logging
LOG_LEVEL=info
```

---

## Step 7: Test Backend

```bash
# Still in arcflow-backend/
npm test
```

**Expected Output:**
```
✓ test/circleClient.test.ts (8 tests)
✓ test/eventDecoding.test.ts (4 tests)

Test Files  2 passed (2)
Tests  12 passed (12)
```

---

## Step 8: Start Backend

### Option A: Worker Only (Event Listener)

```bash
npm run dev:worker
```

**Expected Output:**
```
2026-02-27 10:00:00 [info]: PayoutWorker initialized {...}
2026-02-27 10:00:00 [info]: Connected to network {"chainId":"5042002"}
2026-02-27 10:00:00 [info]: Fetching historical events {...}
2026-02-27 10:00:00 [info]: Found 0 historical PayoutInstruction events
2026-02-27 10:00:00 [info]: PayoutWorker: Listening for new events...
```

### Option B: Server + Worker (API + Event Listener)

```bash
npm run dev:server
```

**Expected Output:**
```
2026-02-27 10:00:00 [info]: PayoutWorker initialized {...}
2026-02-27 10:00:00 [info]: Server running on port 3000
2026-02-27 10:00:00 [info]: Health check: http://localhost:3000/status
```

---

## Step 9: Verify Backend is Running

Open a new terminal and test the API:

```bash
# Health check
curl http://localhost:3000/status

# Should return:
{
  "status": "OK",
  "timestamp": "2026-02-27T10:00:00.000Z",
  "service": "arcflow-backend"
}
```

---

## Step 10: Test End-to-End Flow

### 10.1: Prepare Test Tokens

You'll need test USDC/EURC on Arc testnet. Options:
- Use Arc testnet faucet
- Deploy your own test token
- Use existing test token addresses

### 10.2: Create a Test Batch Payout

Using Hardhat console:

```bash
# From project root
npx hardhat console --network arcTestnet
```

```javascript
// In console:
const Router = await ethers.getContractFactory("ArcFlowPayoutRouter");
const router = Router.attach("0xYourDeployedRouterAddress");

// Approve tokens first
const TestToken = await ethers.getContractAt(
  "IERC20",
  "0xYourTestTokenAddress"
);
await TestToken.approve(router.address, ethers.parseUnits("1000", 6));

// Create batch payout
const recipients = [
  "0xRecipient1Address",
  "0xRecipient2Address",
  "0xRecipient3Address"
];
const amounts = [
  ethers.parseUnits("100", 6),
  ethers.parseUnits("200", 6),
  ethers.parseUnits("300", 6)
];
const chains = [
  ethers.encodeBytes32String("ARC"),
  ethers.encodeBytes32String("BASE"),
  ethers.encodeBytes32String("POLYGON")
];

const tx = await router.createBatchPayout(
  "0xYourTestTokenAddress",
  recipients,
  amounts,
  chains
);
await tx.wait();

console.log("Batch created! Check backend logs.");
```

### 10.3: Check Backend Logs

You should see:

```
2026-02-27 10:05:00 [info]: Processing PayoutInstruction event {
  batchId: "0",
  index: "0",
  recipient: "0xRecipient1Address",
  amount: "100000000",
  destinationChain: "ARC",
  ...
}
2026-02-27 10:05:00 [info]: Circle API (STUB): Creating payout instruction {...}
2026-02-27 10:05:00 [info]: Payout instruction created successfully {
  payoutKey: "0-0",
  circlePayoutId: "circle_payout_...",
  status: "QUEUED"
}
```

### 10.4: Query Batch Status via API

```bash
curl http://localhost:3000/payouts/0/status
```

**Expected Response:**
```json
{
  "batchId": "0",
  "totalPayouts": 3,
  "totalAmount": "600.000000",
  "ready": true,
  "summary": {
    "queued": 3,
    "processing": 0,
    "completed": 0,
    "failed": 0
  },
  "payouts": [
    {
      "index": 0,
      "recipient": "0xRecipient1Address",
      "amount": "100.000000",
      "destinationChain": "ARC",
      "status": "QUEUED",
      "circlePayoutId": "circle_payout_...",
      "createdAt": "2026-02-27T10:05:00.000Z",
      "updatedAt": "2026-02-27T10:05:00.000Z"
    },
    ...
  ]
}
```

---

## Troubleshooting

### "Invalid account: #0 for network: arcTestnet - private key too short"

**Solution**: Make sure your `ARC_PRIVATE_KEY` in `.env` is:
- 66 characters long (0x + 64 hex digits)
- A valid private key with funds

### "Cannot find module 'hardhat'"

**Solution**: Run `npm install` in the project root.

### "Worker not starting" or "Connection failed"

**Solution**:
1. Check `ARC_TESTNET_RPC_URL` is valid and accessible
2. Try: `curl <YOUR_RPC_URL>` to verify connectivity
3. Check RPC endpoint allows WebSocket or HTTP polling

### "No events detected"

**Solution**:
1. Verify you created a batch payout on-chain
2. Check the correct router address is in backend `.env`
3. Lower `fromBlock` in `payoutWorker.ts` if needed

### "Port 3000 already in use"

**Solution**: Change `PORT` in `arcflow-backend/.env` or kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

---

## Production Considerations

### Before Production Deployment

1. **Circle Integration**
   - [ ] Obtain Circle API keys
   - [ ] Replace stub in `circleClient.ts` with real HTTP calls
   - [ ] Implement webhook listener for status updates
   - [ ] Add retry logic with exponential backoff

2. **Database**
   - [ ] Replace in-memory storage with PostgreSQL/MongoDB
   - [ ] Add proper indexing for batch/payout lookups
   - [ ] Implement data retention policies

3. **Security**
   - [ ] Use environment variable management (e.g., AWS Secrets Manager)
   - [ ] Add rate limiting to API endpoints
   - [ ] Implement authentication/authorization
   - [ ] Enable HTTPS
   - [ ] Add CORS configuration

4. **Monitoring**
   - [ ] Set up Prometheus metrics
   - [ ] Add Grafana dashboards
   - [ ] Configure alerting (PagerDuty, Slack)
   - [ ] Add APM (e.g., New Relic, DataDog)

5. **Testing**
   - [ ] Add integration tests
   - [ ] Load testing
   - [ ] Security audit of smart contracts
   - [ ] Penetration testing

6. **Infrastructure**
   - [ ] Deploy to cloud (AWS, GCP, Azure)
   - [ ] Set up CI/CD pipeline
   - [ ] Configure auto-scaling
   - [ ] Add load balancer
   - [ ] Set up backup/disaster recovery

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       User / Frontend                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Arc Testnet (EVM)                         │
│  ┌────────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  ArcFlowEscrow │ │ ArcFlowStreams│ │ArcFlowPayoutRouter│  │
│  └────────────────┘ └──────────────┘ └─────────┬─────────┘  │
│                                                 │            │
│                                      Emits: PayoutInstruction│
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   ArcFlow Backend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PayoutWorker (Event Listener)            │  │
│  │  • Subscribes to PayoutInstruction events             │  │
│  │  • Decodes event parameters                           │  │
│  │  • Calls Circle API for each payout                   │  │
│  │  • Tracks status in-memory (MVP) / DB (production)    │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐  │
│  │             Express REST API Server                   │  │
│  │  • GET /status - Health check                         │  │
│  │  • GET /payouts/:batchId/status                       │  │
│  │  • GET /payouts/:batchId/:index/status                │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               Circle API (Wallets/Gateway/CCTP)              │
│  • STUB in MVP (logs only)                                  │
│  • REAL in production (actual cross-chain transfers)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Checklist

- [ ] Contracts compiled without errors
- [ ] All 31 contract tests passing
- [ ] Contracts deployed to Arc testnet
- [ ] Deployment addresses saved
- [ ] Backend `.env` configured
- [ ] All 12 backend tests passing
- [ ] Backend server running
- [ ] Health check endpoint responding
- [ ] Test batch payout created on-chain
- [ ] Events detected by worker
- [ ] Circle stub called successfully
- [ ] Batch status retrievable via API

---

## Resources

- **Arc Testnet Docs**: [Arc documentation URL]
- **Circle Docs**: https://developers.circle.com/
- **Hardhat Docs**: https://hardhat.org/docs
- **Ethers.js Docs**: https://docs.ethers.org/

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `arcflow-backend/combined.log` and `error.log`
3. Refer to individual READMEs in each package
4. Open an issue on GitHub (if applicable)

**Happy deploying! 🚀**
