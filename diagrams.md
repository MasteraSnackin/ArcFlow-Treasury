# ArcFlow Treasury – Architecture Diagrams

## 1. System Context / Container Diagram

```mermaid
flowchart LR
  User["User Wallet & Browser"] --> UI["ArcFlow Treasury UI (React SPA)"]
  UI -->|EVM tx & calls via wallet| Contracts["Arc Smart Contracts\nArcFlowEscrow / ArcFlowStreams / ArcFlowPayoutRouter"]
  UI -->|HTTP REST| API["Backend API (Express)"]
  Contracts -->|Events: PayoutInstruction| Worker["Event Listener Worker (Node + ethers)"]
  Worker -->|Update payout state| API
  API -->|Future: USDC payouts| Circle["Circle Wallets / Gateway (External Services)"]
```

## 2. Component-Level Diagram

```mermaid
flowchart TB
  subgraph Frontend["Frontend (React SPA)"]
    EscrowPage["EscrowPage.tsx"]
    StreamsPage["StreamsPage.tsx"]
    PayoutsPage["PayoutsPage.tsx"]
    ContractsTS["contracts.ts"]
  end

  subgraph Contracts["Arc Contracts"]
    Escrow["ArcFlowEscrow"]
    Streams["ArcFlowStreams"]
    Router["ArcFlowPayoutRouter"]
  end

  subgraph Backend["Backend"]
    API["Express Server (server.ts)"]
    Worker["Event Listener (worker.ts)"]
    Store[("In-memory Payout Store")]
  end

  subgraph Circle["Circle Infrastructure (Future)"]
    Wallets["Circle Wallets"]
    Gateway["Circle Gateway / CCTP"]
  end

  EscrowPage --> ContractsTS
  StreamsPage --> ContractsTS
  PayoutsPage --> ContractsTS
  ContractsTS --> Escrow
  ContractsTS --> Streams
  ContractsTS --> Router
  PayoutsPage --> API
  Router -->|PayoutInstruction events| Worker
  Worker --> Store
  API --> Store
  Worker --> Wallets
  Wallets --> Gateway
```

## 3. Escrow Flow – Sequence Diagram

```mermaid
sequenceDiagram
  participant U as User (Payer)
  participant UI as Frontend UI
  participant W as Wallet
  participant E as ArcFlowEscrow (Contract)

  U->>UI: Open Escrow tab, fill form
  UI->>W: Request signature for createEscrow(...)
  W->>E: createEscrow(payee, token, amount, expiry, arbitrator)
  E-->>W: tx receipt (escrowId)
  W-->>UI: tx hash & escrowId
  UI->>E: escrows(escrowId)
  E-->>UI: Escrow struct (payer, payee, amount, etc.)
  UI-->>U: Show escrow details & status

  note over U,E: After issue arises
  U->>UI: Click "Raise dispute"
  UI->>W: Request signature for raiseDispute(escrowId)
  W->>E: raiseDispute(escrowId)
  E-->>UI: updated state (disputed = true)

  note over E: Arbitrator resolves
  U->>UI: Arbitrator clicks "Resolve"
  UI->>W: Request signature for resolveDispute(escrowId, releaseToPayee)
  W->>E: resolveDispute(escrowId, releaseToPayee)
  E-->>UI: updated state (released or refunded)
```

## 4. Vesting Stream Flow – Sequence Diagram

```mermaid
sequenceDiagram
  participant Emp as Employer
  participant UIEmp as UI (Employer)
  participant WEmp as Wallet (Employer)
  participant S as ArcFlowStreams
  participant EE as Employee
  participant UIEE as UI (Employee)
  participant WEE as Wallet (Employee)

  Emp->>UIEmp: Configure stream (employee, amount, times)
  UIEmp->>WEmp: Request signature for createStream(...)
  WEmp->>S: createStream(employee, token, totalAmount, start, cliff, end)
  S-->>WEmp: tx receipt (streamId)
  WEmp-->>UIEmp: tx hash & streamId

  note over S,EE: Time passes, some amount vests
  EE->>UIEE: Open Payroll/Vesting, enter streamId
  UIEE->>S: getWithdrawable(streamId)
  S-->>UIEE: withdrawableAmount
  UIEE-->>EE: Display withdrawable amount
  EE->>UIEE: Click "Withdraw"
  UIEE->>WEE: Request signature for withdraw(streamId)
  WEE->>S: withdraw(streamId)
  S-->>WEE: tx receipt
  WEE-->>UIEE: update balance
```

## 5. Payout Batch Flow – Sequence Diagram

```mermaid
sequenceDiagram
  participant U as User (Treasury)
  participant UI as Frontend UI
  participant W as Wallet
  participant R as ArcFlowPayoutRouter
  participant WK as Worker
  participant API as Backend API
  participant C as Circle (Future)

  U->>UI: Configure payout batch (recipients, amounts, chains)
  UI->>W: Request signature for createBatchPayout(...)
  W->>R: createBatchPayout(token, recipients[], amounts[], destinationChains[])
  R-->>W: tx receipt & batchId
  R-->>WK: emit PayoutInstruction events
  WK->>API: Update payouts[batchId] with QUEUED records

  par Future: initiate payouts
    WK->>C: Call Circle Wallets/Gateway for each payout
    C-->>API: Webhook callback with result
    API->>API: Update payout status to COMPLETED/FAILED
  end

  U->>UI: Check batch status
  UI->>API: GET /payouts/:batchId/status
  API-->>UI: JSON with payouts and statuses
  UI-->>U: Render per-recipient status
```

## 6. Escrow Contract Internal Logic – Flowchart

```mermaid
flowchart TD
  A["createEscrow()"] --> B{valid inputs?}
  B -- no --> E["revert InvalidEscrow"]
  B -- yes --> C["store Escrow struct"]
  C --> D["transferFrom(payer -> contract)"]
  D --> F["emit EscrowCreated"]

  subgraph AutoRelease
    G["autoRelease(id)"] --> H{exists and open?}
    H -- no --> I[revert]
    H -- yes --> J{now >= expiry?}
    J -- no --> K["revert TooEarly"]
    J -- yes --> L{disputed?}
    L -- yes --> M["revert AlreadyDisputed"]
    L -- no --> N["mark released = true"]
    N --> O["_payout(token, payee, amount)"]
    O --> P["emit EscrowReleased"]
  end
```

## 7. Streams Vesting Logic – Flowchart

```mermaid
flowchart TD
  S["Time t, Stream s"] --> A{t <= cliff?}
  A -- yes --> B["vested = 0"]
  A -- no --> C{t >= end?}
  C -- yes --> D["vested = totalAmount"]
  C -- no --> E["elapsed = t - cliff"]
  E --> F["duration = end - cliff"]
  F --> G["vested = totalAmount * elapsed / duration"]
  G --> H["withdrawable = vested - withdrawn"]
```
