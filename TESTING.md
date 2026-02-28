# Testing — ArcFlow Treasury

This document describes the testing approach, current coverage, and how to run tests for each package.

---

## 1. Contract Tests (Hardhat + Chai)

**31 tests — all passing**

```bash
# From project root
npm test
# or
npx hardhat test
```

### Coverage

| Suite | Tests | Scenarios |
|-------|-------|-----------|
| `ArcFlowEscrow` | 10 | Create escrow; revert on zero address / zero amount / past expiry; auto-release after expiry; auto-release reverts before expiry; raise dispute (payer and payee); reject dispute from non-participant; resolve → payee; resolve → refund payer; reject non-arbitrator resolution; fee deduction (feeCollector receives correct amount) |
| `ArcFlowStreams` | 12 | Create stream; revert on invalid params; vesting at 0% (before cliff); vesting at 50% (mid-stream); vesting at 100% (after end); employee withdrawal; reject non-employee withdrawal; reject withdrawal when nothing vested; employer revocation with pro-rata split; reject non-employer revocation; withdrawn tracking; revoke after partial withdrawal |
| `ArcFlowPayoutRouter` | 9 | Create batch successfully; emit `PayoutInstruction` events (3 recipients); batch ID increments; revert on empty recipients; revert on array length mismatch; revert on zero total; handle large batch (10 recipients); return correct batch ID; verify event count matches recipients |

---

## 2. Backend Tests (Vitest)

**61 tests — all passing**

```bash
cd arcflow-backend
npm test
```

### Coverage

| File | Tests | What's covered |
|------|-------|----------------|
| `test/circleClient.test.ts` | 15 | Chain identifier mapping (`ARC→ARC-TESTNET`, `BASE→BASE-SEPOLIA`, etc.); CCTP domain IDs; cross-chain flag detection; stub mode response shape; auth header injection; unknown chain default |
| `test/eventDecoding.test.ts` | 4 | `PayoutInstruction` ABI event encoding and decoding; bytes32 chain label round-trip; amount formatting (wei → 6-decimal string); event signature validation |
| `test/payoutStore.test.ts` | 25 | `set()` / `get()` / `has()`; `getBatch()` returns entries sorted by index; secondary-index correctness (`batchIndex` + `transferIndex`); overwrite semantics; cross-batch isolation; `updateByCircleTransferId()` happy path, not-found, PROCESSING clear; index invalidation on overwrite; **+8 file-persistence tests**: ENOENT first-run (no crash), round-trip reload (values preserved), `Date` fields deserialised as `Date` objects, `batchIndex` rebuilt on load, `transferIndex` rebuilt on load, status changes persist and reload correctly, rapid `set()` calls coalesce into one file write, no file write when `PAYOUT_STORE_PATH` not set |
| `test/batchSummary.test.ts` | 17 | `amountToMicro()` exact integer parsing; `formatMicro()` round-trip; BigInt vs float divergence proof (shows why float arithmetic drifts on large totals); `computeBatchSummary()` correctness (status counts, total, ready flag); edge cases (empty batch, all-failed, mixed); performance benchmark (single-pass integer ~1.9× faster than 5-pass float for N=5 000 × 200 runs) |

### Type check

```bash
cd arcflow-backend
npx tsc --noEmit
```

0 errors.

---

## 3. Frontend Type Check

```bash
cd arcflow-frontend
npx tsc --noEmit
```

0 errors. The frontend does not currently have a component or E2E test suite.

---

## 4. Manual Testing Checklist

For hackathon/demo validation, run through each flow manually with MetaMask connected to Arc Testnet (Chain ID 5042002).

### Escrow flow

- [ ] Create an escrow (fill payee, token, amount, expiry, optional arbitrator) → MetaMask prompts ERC-20 approval then `createEscrow`
- [ ] Created escrow appears in **My Escrows** list; click to auto-load
- [ ] Load escrow by ID; verify payer, payee, amount, expiry, status display correctly
- [ ] As payer or payee: click **Raise Dispute** → 2-step confirmation → status updates to `DISPUTED`
- [ ] As arbitrator: **Resolve → Pay Payee** and **Resolve → Refund Payer** both work
- [ ] After expiry: **Auto Release** button visible and functional

### Payroll / Vesting flow

- [ ] Create a stream (employee address, amount, start/cliff/end offsets) → MetaMask approval + `createStream`
- [ ] Created stream appears in **My Streams** list
- [ ] Load stream by ID; verify vesting progress bar and withdrawable amount displayed
- [ ] As employee: **Withdraw Now** sends transaction; withdrawn balance updates
- [ ] As employer: **Revoke Stream** → 2-step confirmation → `revoke()` called on-chain

### Payout Batches flow

- [ ] Create a batch (token, multiple recipients each with amount + chain) → MetaMask approval + `createBatchPayout`
- [ ] Created batch appears in **My Batches** list with real on-chain batch ID
- [ ] Backend logs show `PayoutInstruction` event detected → Circle stub called → status `QUEUED`
- [ ] Load batch by ID in status viewer; payout table shows all recipients with correct status
- [ ] Status refreshes automatically every 30 s (or manually via Refresh button)

### Dashboard

- [ ] Locked-in-escrows metric reflects escrows created in session
- [ ] Locked-in-streams metric reflects streams created in session
- [ ] Pending batches metric reflects batches created in session
- [ ] Recent Activity lists most-recent items across all three types

### Network + wallet

- [ ] Connecting a wallet on the wrong network shows warning + "Switch to Arc Testnet" prompt
- [ ] Backend offline → API health indicator shows "Offline" in topbar
- [ ] Backend online → indicator shows "API: OK"

---

## 5. Running Everything

```bash
# Terminal 1 — contracts
npm test

# Terminal 2 — backend
cd arcflow-backend && npm test

# Terminal 3 — frontend type check
cd arcflow-frontend && npx tsc --noEmit

# Terminal 4 — backend server (for manual testing)
cd arcflow-backend && npm run dev:server

# Terminal 5 — frontend dev server
cd arcflow-frontend && npm run dev
```

Total automated: **31 + 61 = 92 tests**, 0 TypeScript errors.
