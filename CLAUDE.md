\# CLAUDE.md



\## Project Context



ArcFlow Treasury is an Arc‑native web application that lets businesses manage stablecoin-based treasury operations from a single interface. The website provides flows for escrow, payroll/vesting streams, and batch payouts in USDC/EURC, with Arc as the primary execution and state hub.



---



\## Problem Statement



\*\*Primary user pain\*\*



Finance, operations, and engineering teams who pay contractors, employees, and vendors in stablecoins currently juggle multiple wallets, chains, and ad‑hoc spreadsheets. They waste time reconciling escrows, vesting schedules, and payouts, and have no unified view of obligations, balances, and upcoming payments.



Key problems:



\- Fragmented workflows:

&nbsp; - Escrows are handled one‑off (e.g. direct transfers, manual agreements).

&nbsp; - Payroll/vesting is tracked in spreadsheets or HR tools without on‑chain integration.

&nbsp; - Payout batches are assembled manually in wallets or CSV imports.

\- Poor visibility:

&nbsp; - No central dashboard showing “locked vs liquid” balances, active escrows, streams, and payout batches.

&nbsp; - Hard to see what is due when, and on which chain.

\- Operational risk:

&nbsp; - Manual processes lead to missed payments, inconsistent handling of disputes, and difficulty in proving the state of payments.

\- Cross‑chain complexity:

&nbsp; - Teams want to pay recipients on different chains but do not want to manage liquidity and bridging logic themselves.



\*\*What this project solves\*\*



ArcFlow Treasury provides:



\- A single web interface to:

&nbsp; - Create and manage on‑chain escrows with clear dispute and auto‑release rules.

&nbsp; - Create and manage vesting streams for payroll / token‑like vesting.

&nbsp; - Create and track multi‑recipient payout batches.

\- A treasury-oriented view over these flows, with Arc as the main “cash ledger” and Circle infrastructure as the future routing and cross‑chain settlement layer.



---



\## Website Scope \& Specifications



\### Target Users



\- Finance and operations teams at crypto‑native or stablecoin‑friendly companies.

\- Technical founders and treasurers managing USDC/EURC on Arc.

\- Hackathon judges evaluating:

&nbsp; - Smart contract design on Arc.

&nbsp; - Chain‑abstracted USDC design.

&nbsp; - Global payout / treasury workflows.



\### Site Type



\- Authenticated application dashboard (primary).

\- Simple public landing content embedded in the app (secondary).



No public marketing site is required beyond minimal context in the main app.



---



\## Core Pages \& Flows



\### 1. Global Layout \& Navigation



\*\*Requirements\*\*



\- Top‑level navigation with at least:

&nbsp; - Dashboard

&nbsp; - Escrow \& Disputes

&nbsp; - Payroll \& Vesting

&nbsp; - Payout Batches

\- Wallet connect button:

&nbsp; - Shows current connected address and network (Arc).

&nbsp; - Provides clear error/warning if the wallet is on the wrong network.

\- Basic status indicator:

&nbsp; - Shows backend availability (e.g. “Backend: OK / Offline” based on `/status`).



\*\*Open questions\*\*



\- Do we need multiple organisation support (e.g. “org switcher”), or is “one wallet = one org” enough for now?



---



\### 2. Dashboard



\*\*Goal\*\*



Give users a concise overview of their treasury state on Arc.



\*\*Functional requirements\*\*



\- Display:

&nbsp; - “USDC locked in escrows” (sum of active, unreleased escrows where payer = connected wallet).

&nbsp; - “USDC locked in streams” (sum of `totalAmount - withdrawn` for active employer streams).

&nbsp; - “USDC in pending payout batches” (sum of batch totals for recent batches created by connected wallet; “pending” can be defined as “still tracked by backend, not manually marked completed”).

\- Show a small list of “Recent activity”:

&nbsp; - Last N escrows created or updated.

&nbsp; - Last N streams created.

&nbsp; - Last N payout batches created.



\*\*Non‑goals (for MVP)\*\*



\- No historical charts.

\- No multi‑currency display or PnL.



\*\*Open questions\*\*



\- Should values be shown only in token units (USDC) or also converted to a fiat estimate?



---



\### 3. Escrow \& Disputes Page



\*\*Goal\*\*



Allow users to create, inspect, and manage escrows.



\*\*Functional requirements\*\*



1\. \*\*Create escrow form\*\*

&nbsp;  - Inputs:

&nbsp;    - Payee address.

&nbsp;    - Token selector (USDC/EURC; for MVP can be a preconfigured ERC‑20 address).

&nbsp;    - Amount (human‑readable, e.g. 1.5).

&nbsp;    - Expiry (relative time, e.g. “minutes/hours from now”).

&nbsp;    - Arbitrator address (optional but recommended).

&nbsp;  - Behaviour:

&nbsp;    - Shows required ERC‑20 approval status; if not approved, prompts to approve before creating.

&nbsp;    - On submit, sends a transaction to `ArcFlowEscrow.createEscrow`.

&nbsp;    - On success, displays the escrow ID and a link to view it.



2\. \*\*View / manage escrow by ID\*\*

&nbsp;  - Input: escrow ID.

&nbsp;  - Displays:

&nbsp;    - Payer, payee, token, amount (converted to human format).

&nbsp;    - Expiry timestamp and “time remaining” if before expiry.

&nbsp;    - Arbitrator address.

&nbsp;    - Status: `OPEN`, `DISPUTED`, `RELEASED`, `REFUNDED`.

&nbsp;  - Actions (depending on role/state):

&nbsp;    - As payer or payee:

&nbsp;      - “Raise dispute” if escrow is open and not disputed.

&nbsp;    - As arbitrator:

&nbsp;      - “Resolve – pay payee”.

&nbsp;      - “Resolve – refund payer”.

&nbsp;    - As anyone:

&nbsp;      - “Auto release” after expiry if no dispute.



\*\*Edge cases\*\*



\- Escrow not found → show clear “not found” message.

\- User not a participant/arbitrator → actions disabled with explanation.



\*\*Open questions\*\*



\- Do we need a list view (e.g. “My escrows”) or is “view by ID + recent activity” sufficient?



---



\### 4. Payroll \& Vesting Page



\*\*Goal\*\*



Allow employers to create streams and employees to monitor and withdraw.



\*\*Functional requirements\*\*



1\. \*\*Create stream (employer)\*\*

&nbsp;  - Inputs:

&nbsp;    - Employee address.

&nbsp;    - Token (USDC/EURC).

&nbsp;    - Total amount.

&nbsp;    - Start time (now vs future).

&nbsp;    - Cliff (offset from start, e.g. minutes/hours).

&nbsp;    - End time (offset from start).

&nbsp;  - Behaviour:

&nbsp;    - Shows required ERC‑20 approval status for `ArcFlowStreams`.

&nbsp;    - On submit, calls `createStream` with start, cliff, end.

&nbsp;    - On success, shows stream ID.



2\. \*\*View/withdraw (employee)\*\*

&nbsp;  - Input: stream ID.

&nbsp;  - Displays:

&nbsp;    - Employer, employee, token, totalAmount.

&nbsp;    - Start, cliff, end, and current time with clear labels.

&nbsp;    - Vested amount vs total.

&nbsp;    - Withdrawn amount.

&nbsp;    - Withdrawable amount.

&nbsp;  - Actions:

&nbsp;    - “Withdraw now” for employee if withdrawable > 0.



3\. \*\*Revoke (employer) \[if UI supports it now]\*\*

&nbsp;  - As employer:

&nbsp;    - “Revoke stream” button that calls `revoke`.

&nbsp;  - After revoke:

&nbsp;    - Show final split: sent to employee vs refunded to employer.



\*\*Open questions\*\*



\- Should the page support listing multiple streams (e.g. “All streams for this employer/employee”), or is “lookup by ID” enough for MVP?



---



\### 5. Payout Batches Page



\*\*Goal\*\*



Allow users to create batch payouts and monitor their status via the backend.



\*\*Functional requirements\*\*



1\. \*\*Create batch form\*\*

&nbsp;  - Inputs:

&nbsp;    - Token (USDC/EURC).

&nbsp;    - List of recipients:

&nbsp;      - Each row: recipient address, amount, destination chain label (e.g. ARC, BASE, POLYGON).

&nbsp;  - Behaviour:

&nbsp;    - Add/remove rows dynamically.

&nbsp;    - Validate addresses and amounts client‑side.

&nbsp;    - Show total amount.

&nbsp;    - Check ERC‑20 approval for `ArcFlowPayoutRouter`.

&nbsp;    - On submit, call `createBatchPayout`.

&nbsp;    - Show resulting `batchId`.



2\. \*\*Batch status viewer\*\*

&nbsp;  - Input: batch ID.

&nbsp;  - Behaviour:

&nbsp;    - Call `GET /payouts/:batchId/status` on backend.

&nbsp;    - Render table:

&nbsp;      - index, recipient, amount, destination chain, status (QUEUED / COMPLETED / FAILED).

&nbsp;    - Optionally show aggregate:

&nbsp;      - total amount.

&nbsp;      - `ready` flag (e.g. meets minimum batch size rule).



\*\*Open questions\*\*



\- Should the client periodically poll for status, or only fetch on manual “Refresh”?

\- Do we need any manual override actions for statuses in the UI for now?



---



\## Tech Stack



\- \*\*Frontend\*\*

&nbsp; - Next.js / React (App Router) – single-page app with sections described above.

&nbsp; - TypeScript.

&nbsp; - Styling: Tailwind CSS (or similar utility‑first CSS).

\- \*\*Backend\*\*

&nbsp; - Node.js + Express (or equivalent).

&nbsp; - TypeScript.

&nbsp; - In‑memory store for payouts (MVP).

\- \*\*Blockchain\*\*

&nbsp; - Arc (EVM) with smart contracts:

&nbsp;   - `ArcFlowEscrow`

&nbsp;   - `ArcFlowStreams`

&nbsp;   - `ArcFlowPayoutRouter`

\- \*\*Future external integrations\*\*

&nbsp; - Circle Wallets / Gateway / CCTP (off‑chain payouts and cross‑chain routing).



If any of these are wrong or incomplete, please adjust and confirm.



---



\## Key Directories



\- `arcflow-contracts/` — Smart contracts and Hardhat project.

\- `arcflow-backend/` — Backend API and event listener worker.

\- `arcflow-frontend/` — Web UI for escrow, streams, and payout batches.

\- `docs/` — Documentation (README, ARCHITECTURE, demo script, environment notes, testing).



---



\## Commands



Adjust to match your actual scripts:



\- `cd arcflow-contracts \&\& npm run dev` — Local dev / testing (if applicable).

\- `cd arcflow-contracts \&\& npm run deploy:arc` — Deploy contracts to Arc.

\- `cd arcflow-backend \&\& npm run dev:server` — Start backend API.

\- `cd arcflow-backend \&\& npm run dev:worker` — Start event listener worker.

\- `cd arcflow-frontend \&\& npm run dev` — Start frontend dev server.

\- `cd arcflow-contracts \&\& npm test` — Run contract tests (when present).



---



\## How I Want You to Work



\### Before Coding



\- Ask clarifying questions whenever a requirement from the sections above is ambiguous.

\- For any new feature (e.g. new dashboard metric, new batch status rule), draft a short plan:

&nbsp; - What data you need.

&nbsp; - Which contracts/endpoints you’ll use.

&nbsp; - What UI states you will add.

\- Never assume token addresses, RPC URLs, or environment variables; expect them to be provided or configured separately.



\### While Coding



\- Write complete, working code — no placeholders, no TODOs in core flows.

\- Keep components and functions small and focused.

\- Follow existing patterns (contracts access via shared helpers, React components in `pages` or `components`).

\- Always handle:

&nbsp; - Loading states.

&nbsp; - Error states.

&nbsp; - Empty states (no escrows/streams/batches yet).



\### After Coding



\- Run at least:

&nbsp; - Type checks.

&nbsp; - Linter (if configured).

&nbsp; - Manual test in the browser for the flow you touched.

\- Summarise:

&nbsp; - What changed.

&nbsp; - Which flows you manually tested.

&nbsp; - Any known limitations or follow‑ups.



---



\## Code Style



\- Use ES modules (`import` / `export`) everywhere.

\- Use TypeScript with explicit types; avoid `any`.

\- Use functional React components and hooks.

\- Prefer clear naming based on domain:

&nbsp; - `escrowId`, `streamId`, `batchId`, `payoutStatus`, etc.

\- Avoid commented‑out code; remove unused code instead.

\- Prefer async/await with proper try/catch.



---



\## Do Not



\- Edit generated build artefacts or dependencies.

\- Hardcode secrets (RPC URLs, private keys, API keys).

\- Change smart contract behaviour without updating documentation and frontend expectations.

\- Introduce breaking changes to core flows without clear justification.



---



\## Verification Loop



After each task:



1\. Confirm contracts/clients compile and type‑check.

2\. Confirm there are no linter errors (where configured).

3\. Run the relevant flow end‑to‑end in the browser.

4\. Ensure behaviour matches the specification in this document.

5\. If something is unclear or seems inconsistent, raise it instead of guessing.



---



\## Success Criteria



A change is complete when:



\- \[ ] The implemented behaviour matches the problem and scope described above.

\- \[ ] The flow works end‑to‑end (contract + backend + frontend where relevant).

\- \[ ] Types and lint pass.

\- \[ ] UI handles success, loading, error, and empty states gracefully.

\- \[ ] Documentation comments or doc files are updated if behaviour changed.

\- \[ ] Any unresolved ambiguities are listed explicitly as open questions.



---



\## Open Questions / Gaps



Please clarify:



1\. Do you need multi‑organisation support (more than “one wallet = one org”) in this MVP?

2\. Do you want a list view (“My escrows/streams/batches”) or is “lookup by ID + recent activity” sufficient for now?

3\. Should the dashboard show fiat equivalents (e.g. approximate USD) or only token amounts?

4\. For payout statuses, is `QUEUED/COMPLETED/FAILED` enough, or do you need finer‑grained states (e.g. `IN\_PROGRESS`, `CANCELLED`)?

5\. Are there any regulatory or jurisdictional constraints (e.g. users in specific regions, KYC requirements) that should influence the design?



Once you answer these, I can refine this document further so there is effectively zero ambiguity in the scope.



