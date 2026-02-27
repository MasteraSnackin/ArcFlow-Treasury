\# Demo Script – ArcFlow Treasury (Arc × Circle)



\## 1. Intro (30–45s)



\- “This is ArcFlow Treasury, an Arc‑native console for running real‑world treasury operations in USDC and EURC.”

\- “We’re deployed on Arc Testnet, a Layer‑1 blockchain built by Circle specifically for stablecoin finance. That means gas is paid in USDC, fees are predictable, and transactions finalise in under a second.”

\- “ArcFlow lets you manage escrows, vesting, and global payouts from a single interface, while using Circle’s infrastructure in the background to move funds across chains and accounts.”



\## 2. Network and setup (15–20s)



\- Show your wallet connected to Arc Testnet.

\- “We fund this wallet via Circle’s testnet faucet, selecting Arc Testnet and requesting USDC. That USDC is both our treasury asset and the gas token for interactions with ArcFlow contracts.”

\- Optionally flash the faucet URL: https://faucet.circle.com/ and the explorer: https://testnet.arcscan.app/.



\## 3. Escrow \& disputes (45–60s)



\- In the UI, create a new escrow:

&nbsp; - Enter payer/payee, amount, token (USDC/EURC), expiry, arbitrator if applicable.

\- Narrate:

&nbsp; - “We lock USDC into an escrow on Arc. The contract lives on Arc Testnet, and obligations are recorded on‑chain.”

&nbsp; - “Arc’s fast finality means this escrow becomes visible and reliable almost immediately.”

\- Click through to the transaction on `testnet.arcscan.app` from your UI link.



\## 4. Payroll / vesting (45–60s)



\- Create a vesting stream in the UI.

\- Narrate:

&nbsp; - “Here we set up a linear stream for payroll or token vesting. The stream is defined on Arc, with start, cliff, and end times captured in the contract.”

&nbsp; - “The UI reads the stream state from Arc and shows what is vested, what is withdrawable, and what remains locked.”

\- Trigger a withdraw if possible and briefly show the updated balances.



\## 5. Payout batches and Circle hand‑off (60–90s)



\- In the UI, create a payout batch with multiple recipients and destination chain labels.

\- Narrate:

&nbsp; - “Batches are defined on Arc via a `PayoutRouter` contract. For each recipient, the contract emits a `PayoutInstruction` event describing who should be paid, how much, and on which destination chain.”

&nbsp; - “A backend worker listens to these events via an Arc RPC endpoint. For each instruction, it’s designed to call Circle Wallets and Circle Gateway, and to use CCTP when a native cross‑chain transfer is required.”

&nbsp; - “In production, that means a treasury operator can work entirely in ArcFlow, while Circle handles moving USDC/EURC across chains and accounts under the hood.”

\- Show your batch status view:

&nbsp; - “Here we track each instruction as QUEUED, COMPLETED, or FAILED. Arc is the source of truth for obligations and batch definitions; Circle is the source of truth for settlement status, which we feed back into this dashboard.”



\## 6. Why Arc + Circle (30–45s)



\- “We chose Arc because it’s purpose‑built by Circle for stablecoin finance: USDC gas, low latency, and a design focused on real‑world finance like payroll, payouts, and treasury tools.”

\- “We integrate Circle Wallets, Gateway and CCTP as the multichain and off‑chain execution layer. ArcFlow’s contracts define who is owed what on Arc; Circle’s infrastructure is responsible for actually moving those stablecoins wherever they need to go.”



\## 7. Close (15–20s)



\- “ArcFlow Treasury shows how Arc and Circle can work together to power real‑world payouts and treasury management: Arc as the stablecoin‑native obligation ledger, Circle as the engine that moves USDC and EURC across chains and into the real economy.”

