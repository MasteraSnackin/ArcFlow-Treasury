# ArcFlow Treasury – Demo Script

This document provides a structured script for demonstrating ArcFlow Treasury, covering the three core flows and how they map to Arc and Circle.

## 1. Intro (30–45 seconds)

- "Hi, this is ArcFlow Treasury, built for the Encode × Arc hackathon."
- "Global teams paying contractors and suppliers in USDC still juggle multiple wallets, networks, and custom tools for escrow, payroll, and payouts."
- "ArcFlow Treasury uses Arc as a USDC‑native execution hub to combine conditional escrow, programmable vesting, and multi‑recipient payout batches into a single treasury interface."

## 2. Escrow Flow (1–1.5 minutes)

1. Navigate to the **Escrow** tab.
2. Explain fields: payee, amount (USDC), expiry, arbitrator.
3. Say: "When I click 'Create escrow', ArcFlowEscrow pulls USDC from my wallet into an escrow on Arc. Gas is paid in USDC, so all costs are dollar‑denominated."
4. Show the transaction confirmation on the Arc explorer.
5. Load the escrow by ID and show payer, payee, amount, expiry, and status.
6. Trigger a dispute:
   - "If something goes wrong, either party can raise a dispute."
   - Click **Raise dispute** and show the updated state.
7. Resolve the dispute as arbitrator:
   - "As the arbitrator, I can resolve on chain: either release to the seller or refund the buyer."
   - Click **Resolve** and show the new state.
8. Mention auto‑release:
   - "If there is no dispute and the expiry passes, anyone can call auto‑release to pay the seller automatically."

## 3. Payroll / Vesting Flow (1–1.5 minutes)

1. Navigate to the **Payroll / Vesting** tab.
2. As employer wallet:
   - Enter employee address, total amount, and time parameters (start, cliff, end).
   - Create a stream.
   - Explain: "This funds a vesting stream in USDC. The contract holds the full amount and releases linearly after the cliff until the end."
3. Switch to the employee wallet:
   - Enter the stream ID.
   - Click **Check withdrawable**.
   - Explain: "This shows the amount vested so far."
4. After a short wait, click **Withdraw**:
   - "When I withdraw, the contract transfers the vested USDC to the employee and updates the withdrawn balance."
5. Optionally demonstrate revoke (if implemented in the UI):
   - "The employer can revoke the stream: vested but unpaid goes to the employee, the rest is refunded to the employer."

## 4. Payout Batch Flow (1.5–2 minutes)

1. Navigate to the **Payouts** tab.
2. Configure a small batch:
   - 1–3 recipients.
   - Clear amounts.
   - Destination chain labels (e.g. ARC, BASE, AVAX, ETH, ARB).
3. Explain: "This creates a batch payout. Our ArcFlowPayoutRouter contract pulls the total USDC from my wallet and emits one PayoutInstruction event per recipient on Arc."
4. Create the batch and note the batch ID.
5. Show the backend status:
   - In the UI, enter the batch ID under **Batch status**.
   - Click **Refresh status**.
   - Explain: "The backend listens to PayoutInstruction events and stores payout records with a status. Here, they're queued and ready for execution." 
6. Tie to Circle:
   - "In a production system, this worker would call Circle Wallets or Gateway to route USDC to each destination chain, and update statuses when Circle confirms settlement."

## 5. Closing (30–45 seconds)

- "ArcFlow Treasury targets three tracks with one coherent product: advanced Arc smart contracts, chain‑abstracted USDC with Arc as a liquidity hub, and global payouts and treasury."
- "We use Arc’s USDC gas and fast finality for predictable, real‑time‑feeling operations, and design our payout router to integrate with Circle Wallets and Gateway for cross‑chain settlement."
- "This is ArcFlow Treasury – an Arc‑native treasury console for escrow, payroll, and payouts."
