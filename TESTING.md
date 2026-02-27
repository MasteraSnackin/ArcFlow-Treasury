# Testing – ArcFlow Treasury

This document outlines the testing approach for the ArcFlow Treasury project.

## 1. Contract Tests (Hardhat)

Smart contract tests are written using Hardhat’s Mocha/Chai test runner.

### 1.1 Running Tests

From the `arcflow-contracts` directory:

```bash
npm test
```

or explicitly:

```bash
npx hardhat test
```

### 1.2 Suggested Test Coverage

- **ArcFlowEscrow**
  - Create escrow with valid inputs.
  - Reject invalid inputs (zero amount, past expiry, zero addresses).
  - Auto‑release after expiry transfers funds to payee.
  - Dispute and resolve in favour of payee.
  - Dispute and resolve in favour of payer (refund).
  - Fee logic: verify feeCollector receives the correct fraction.

- **ArcFlowStreams**
  - Create stream with valid parameters (start, cliff, end).
  - Vesting behaviour before cliff (0), between cliff and end (partial), and after end (full).
  - Withdraw once and ensure `withdrawn` is updated.
  - Revoke: vested portion to employee, unvested refunded to employer.

- **ArcFlowPayoutRouter**
  - Revert on mismatched array lengths.
  - Revert on zero‑total batches.
  - Successful batch: total transferred and `PayoutInstruction` events emitted.

> Note: You can use a simple test token (e.g. `TestUSDC.sol`) for unit tests.

---

## 2. Backend Tests

The backend currently focuses on:

- Event ingestion from the router contract.
- HTTP endpoints for status and payout queries.

### 2.1 Approaches

- Unit tests (Jest or Mocha) for:
  - `GET /status`
  - `GET /payouts/:batchId/status` with mock in‑memory data.
- Integration tests (future):
  - Simulate `PayoutInstruction` events and assert payout store updates.
  - Mock Circle webhooks to verify status changes.

> At present, backend tests are not fully implemented; they are recommended as follow‑up work.

---

## 3. Frontend Tests

The React SPA can be tested with:

- Component/unit tests (e.g. Vitest + React Testing Library).
- Basic E2E tests (e.g. Playwright or Cypress) for the three main flows.

### 3.1 Suggested Tests

- EscrowPage:
  - Renders form and handles basic validation.
  - Calls contract methods correctly when creating an escrow (with contract calls mocked).

- StreamsPage:
  - Displays withdrawable amounts correctly when provided with mock data.
  - Calls `withdraw` handler when clicking the button.

- PayoutsPage:
  - Renders dynamic list of recipients.
  - Calls backend `GET /payouts/:batchId/status` and renders statuses.

---

## 4. Manual Testing Checklist

For hackathon/demo scenarios, validate the following manually:

- Escrow:
  - Create an escrow, view it by ID, and verify status transitions.
  - Dispute and resolve flows.
  - Auto‑release after expiry.

- Streams:
  - Create a stream, wait for some vesting, and withdraw as employee.
  - Optionally, revoke as employer and confirm split.

- Payouts:
  - Create a small batch and verify a `QUEUED` status in the UI from the backend.

Capture screenshots or a short video of each flow for documentation and debugging.
