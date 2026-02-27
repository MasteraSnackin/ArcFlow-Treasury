1\. System context / container diagram



flowchart LR

&nbsp; User\[User Wallet \& Browser] --> UI\[ArcFlow Treasury UI<br/>(React SPA)]

&nbsp; UI -->|EVM tx \& calls via wallet| Contracts\[Arc Smart Contracts<br/>ArcFlowEscrow / ArcFlowStreams / ArcFlowPayoutRouter]

&nbsp; UI -->|HTTP (REST)| API\[Backend API<br/>(Express)]

&nbsp; Contracts -->|Events: PayoutInstruction| Worker\[Event Listener Worker<br/>(Node + ethers)]

&nbsp; Worker -->|Update payout state| API

&nbsp; API -->|Future: USDC payouts| Circle\[Circle Wallets / Gateway<br/>(External Services)]



2\. Component-level diagram

flowchart TB

&nbsp; subgraph Frontend\[Frontend (React SPA)]

&nbsp;   EscrowPage\[EscrowPage.tsx]

&nbsp;   StreamsPage\[StreamsPage.tsx]

&nbsp;   PayoutsPage\[PayoutsPage.tsx]

&nbsp;   ContractsTS\[contracts.ts]

&nbsp; end



&nbsp; subgraph Contracts\[Arc Contracts]

&nbsp;   Escrow\[ArcFlowEscrow]

&nbsp;   Streams\[ArcFlowStreams]

&nbsp;   Router\[ArcFlowPayoutRouter]

&nbsp; end



&nbsp; subgraph Backend\[Backend]

&nbsp;   API\[Express Server<br/>(server.ts)]

&nbsp;   Worker\[Event Listener<br/>(worker.ts)]

&nbsp;   Store\[(In-memory Payout Store)]

&nbsp; end



&nbsp; subgraph Circle\[Circle Infrastructure (Future)]

&nbsp;   Wallets\[Circle Wallets]

&nbsp;   Gateway\[Circle Gateway / CCTP]

&nbsp; end



&nbsp; EscrowPage --> ContractsTS

&nbsp; StreamsPage --> ContractsTS

&nbsp; PayoutsPage --> ContractsTS



&nbsp; ContractsTS --> Escrow

&nbsp; ContractsTS --> Streams

&nbsp; ContractsTS --> Router



&nbsp; PayoutsPage --> API



&nbsp; Router -->|PayoutInstruction events| Worker

&nbsp; Worker --> Store

&nbsp; API --> Store



&nbsp; Worker --> Wallets

&nbsp; Wallets --> Gateway



3\. Escrow flow – sequence diagram

sequenceDiagram

&nbsp; participant U as User (Payer)

&nbsp; participant UI as Frontend UI

&nbsp; participant W as Wallet

&nbsp; participant E as ArcFlowEscrow (Contract)



&nbsp; U->>UI: Open Escrow tab, fill form

&nbsp; UI->>W: Request signature for createEscrow(...)

&nbsp; W->>E: createEscrow(payee, token, amount, expiry, arbitrator)

&nbsp; E-->>W: tx receipt (escrowId)

&nbsp; W-->>UI: tx hash \& escrowId

&nbsp; UI->>E: escrows(escrowId)

&nbsp; E-->>UI: Escrow struct (payer, payee, amount, etc.)

&nbsp; UI-->>U: Show escrow details \& status



&nbsp; note over U,E: After issue arises



&nbsp; U->>UI: Click "Raise dispute"

&nbsp; UI->>W: Request signature for raiseDispute(escrowId)

&nbsp; W->>E: raiseDispute(escrowId)

&nbsp; E-->>UI: updated state (disputed = true)



&nbsp; note over E: Arbitrator resolves



&nbsp; U->>UI: Arbitrator clicks "Resolve"

&nbsp; UI->>W: Request signature for resolveDispute(escrowId, releaseToPayee)

&nbsp; W->>E: resolveDispute(escrowId, releaseToPayee)

&nbsp; E-->>UI: updated state (released or refunded)





4\. Vesting stream flow – sequence diagram



sequenceDiagram

&nbsp; participant Emp as Employer

&nbsp; participant UIEmp as UI (Employer)

&nbsp; participant WEmp as Wallet (Employer)

&nbsp; participant S as ArcFlowStreams

&nbsp; participant EE as Employee

&nbsp; participant UIEE as UI (Employee)

&nbsp; participant WEE as Wallet (Employee)



&nbsp; Emp->>UIEmp: Configure stream (employee, amount, times)

&nbsp; UIEmp->>WEmp: Request signature for createStream(...)

&nbsp; WEmp->>S: createStream(employee, token, totalAmount, start, cliff, end)

&nbsp; S-->>WEmp: tx receipt (streamId)

&nbsp; WEmp-->>UIEmp: tx hash \& streamId



&nbsp; note over S,EE: Time passes, some amount vests



&nbsp; EE->>UIEE: Open Payroll/Vesting, enter streamId

&nbsp; UIEE->>S: getWithdrawable(streamId)

&nbsp; S-->>UIEE: withdrawableAmount

&nbsp; UIEE-->>EE: Display withdrawable amount



&nbsp; EE->>UIEE: Click "Withdraw"

&nbsp; UIEE->>WEE: Request signature for withdraw(streamId)

&nbsp; WEE->>S: withdraw(streamId)

&nbsp; S-->>WEE: tx receipt

&nbsp; WEE-->>UIEE: update balance





5\. Payout batch flow – sequence diagram

sequenceDiagram

&nbsp; participant U as User (Treasury)

&nbsp; participant UI as Frontend UI

&nbsp; participant W as Wallet

&nbsp; participant R as ArcFlowPayoutRouter

&nbsp; participant WK as Worker

&nbsp; participant API as Backend API

&nbsp; participant C as Circle (Future)



&nbsp; U->>UI: Configure payout batch (recipients, amounts, chains)

&nbsp; UI->>W: Request signature for createBatchPayout(...)

&nbsp; W->>R: createBatchPayout(token, recipients\[], amounts\[], destinationChains\[])

&nbsp; R-->>W: tx receipt \& batchId

&nbsp; R-->>WK: emit PayoutInstruction events



&nbsp; WK->>API: Update payouts\[batchId] with QUEUED records



&nbsp; par Future: initiate payouts

&nbsp;   WK->>C: Call Circle Wallets/Gateway for each payout

&nbsp;   C-->>API: Webhook callback with result

&nbsp;   API->>API: Update payout status to COMPLETED/FAILED

&nbsp; end



&nbsp; U->>UI: Check batch status

&nbsp; UI->>API: GET /payouts/:batchId/status

&nbsp; API-->>UI: JSON with payouts and statuses

&nbsp; UI-->>U: Render per‑recipient status





6\. Escrow contract internal logic – flowchart

flowchart TD

&nbsp; A\[createEscrow()] --> B{valid inputs?}

&nbsp; B -- no --> E\[revert InvalidEscrow]

&nbsp; B -- yes --> C\[store Escrow struct]

&nbsp; C --> D\[transferFrom(payer -> contract)]

&nbsp; D --> F\[emit EscrowCreated]



&nbsp; subgraph AutoRelease

&nbsp;   G\[autoRelease(id)] --> H{exists and open?}

&nbsp;   H -- no --> I\[revert]

&nbsp;   H -- yes --> J{now >= expiry?}

&nbsp;   J -- no --> K\[revert TooEarly]

&nbsp;   J -- yes --> L{disputed?}

&nbsp;   L -- yes --> M\[revert AlreadyDisputed]

&nbsp;   L -- no --> N\[mark released = true]

&nbsp;   N --> O\[\_payout(token, payee, amount)]

&nbsp;   O --> P\[emit EscrowReleased]

&nbsp; end





7\. Streams vesting logic – flowchart

flowchart TD

&nbsp; S\[Time t, Stream s] --> A{t <= cliff?}

&nbsp; A -- yes --> B\[vested = 0]

&nbsp; A -- no --> C{t >= end?}

&nbsp; C -- yes --> D\[vested = totalAmount]

&nbsp; C -- no --> E\[elapsed = t - cliff]

&nbsp; E --> F\[duration = end - cliff]

&nbsp; F --> G\[vested = totalAmount \* elapsed / duration]

&nbsp; G --> H\[withdrawable = vested - withdrawn]















