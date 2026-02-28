<h1 class="code-line" data-line-start=0 data-line-end=1 ><a id="Nanopayments_for_ArcFlow_Treasury_0"></a>Nanopayments for ArcFlow Treasury</h1>
<h2 class="code-line" data-line-start=2 data-line-end=3 ><a id="Overview_2"></a>Overview</h2>
<p class="has-line-data" data-line-start="4" data-line-end="5">This document explains how adding an HTTP‑native nanopayment layer (via x402‑style HTTP 402 and Circle Gateway‑style batching) improves <strong>ArcFlow Treasury</strong>, a stablecoin treasury platform for escrow, payroll streams, and batch payouts on Arc.</p>
<p class="has-line-data" data-line-start="6" data-line-end="7">Nanopayments turn ArcFlow from a purely macro‑scale, human‑driven treasury application into a full‑spectrum treasury and infrastructure product that can serve both humans and autonomous agents at any value scale.</p>
<hr>
<h2 class="code-line" data-line-start=10 data-line-end=11 ><a id="1_Current_ArcFlow_Capabilities_10"></a>1. Current ArcFlow Capabilities</h2>
<p class="has-line-data" data-line-start="12" data-line-end="13">ArcFlow Treasury today:</p>
<ul>
<li class="has-line-data" data-line-start="14" data-line-end="15">Provides on‑chain <strong>Escrow</strong>, <strong>Payroll &amp; Vesting Streams</strong>, and <strong>Batch Payouts</strong> in USDC, EURC, and USYC on Arc.</li>
<li class="has-line-data" data-line-start="15" data-line-end="16">Targets <strong>crypto‑native companies and technical founders</strong> managing payroll, contractor payments, and bulk transfers.</li>
<li class="has-line-data" data-line-start="16" data-line-end="17">Integrates deeply with Circle Wallets, Circle Gateway, and CCTP for cross‑chain settlement, so users never manage bridging.</li>
<li class="has-line-data" data-line-start="17" data-line-end="18">Exposes a <strong>REST Status API</strong> (<code>/escrows/:id</code>, <code>/streams/:id</code>, <code>/payouts/:id/status</code>) backed by indexed stores and workers for fast lookups.</li>
<li class="has-line-data" data-line-start="18" data-line-end="20">Is optimised for <strong>human‑scale</strong>, relatively low‑frequency operations (escrows, vesting schedules, payout batches) where gas is negligible relative to the transaction size.</li>
</ul>
<p class="has-line-data" data-line-start="20" data-line-end="21">Assumptions baked into the current design:</p>
<ul>
<li class="has-line-data" data-line-start="22" data-line-end="23">Payment amounts are typically $10–$1,000,000+.</li>
<li class="has-line-data" data-line-start="23" data-line-end="24">Interactions are initiated by humans via the dashboard.</li>
<li class="has-line-data" data-line-start="24" data-line-end="26">The REST API is a convenience layer and is currently free to call.</li>
</ul>
<h3 class="code-line" data-line-start=26 data-line-end=27 ><a id="11_Current_Architecture_Before_Nanopayments_26"></a>1.1 Current Architecture (Before Nanopayments)</h3>
<pre><code class="has-line-data" data-line-start="29" data-line-end="380" class="language-text">BEFORE

+--------------------+       +---------------------+
|  Frontend UI       |       |  ArcFlow Backend    |
|  - Escrow / Stream |  ---&gt; |  - REST status API  |
|  - Batches         |       |  - Event workers    |
+--------------------+       +---------------------+
                                   |
                                   | on-chain reads / Circle payouts
                                   v
                            +---------------------+
                            |  Arc + Circle       |
                            |  - Contracts        |
                            |  - Wallets/Gateway  |
                            +---------------------+
2. What Nanopayments Add
The nanopayment layer introduces:

An HTTP 402 “Payment Required” protocol (x402‑style), where API calls can declare price, asset, and recipient and be paid per request.

Off‑chain batching and gasless user experience, where payers sign authorisations off‑chain and a facilitator batches them into on‑chain stablecoin transfers.

Ultra‑small price points (e.g. $0.001 per status query; $0.000001 per second of streaming pay).

A natural fit for AI agents, bots, and backend services that need pay‑as‑you‑go access without human billing flows.

This is layered on top of the existing ArcFlow stack rather than replacing any of it.

2.1 High‑Level Architecture (After Nanopayments)
text
AFTER

+-------------------------------+
|        Clients / Callers      |
|  - Dashboard (browser)        |
|  - External tools             |
|  - AI agents / bots           |
+---------------+---------------+
                |
                | HTTP (402 + X-PAYMENT)
                v
+-----------------------------------------------------------+
|                 ArcFlow Backend (Express)                 |
|                                                           |
|  /api/v1/* (free)     /api/v2/* (paid)                    |
|  ------------------   ------------------------------      |
|  - status, payouts    - nanopaymentMiddleware             |
|  - demo routes        - x402 verification hook            |
|                       - route-specific pricing (USDC)     |
+-------------------------------+---------------------------+
                                |
                                | verify + settle RPC
                                v
+-----------------------------------------------------------+
|           Nanopayment Facilitator (Gateway-style)         |
|                                                           |
|  - Verify signed payment authorisations                   |
|  - Track nonces / validity windows                        |
|  - Accumulate off-chain batches                           |
|  - Submit batched transfers on-chain                      |
+-------------------------------+---------------------------+
                                |
                                | batched on-chain tx
                                v
+-----------------------------------------------------------+
|                 Arc &amp; Other EVM Chains                    |
|                                                           |
|  - USDC / EURC / USYC contracts                           |
|  - ArcFlowEscrow / ArcFlowStreams / PayoutRouter          |
|  - NANOPAYMENTS_RECIPIENT treasury wallet                 |
+-----------------------------------------------------------+
3. High‑Level Improvements
3.1 From “App” to “Infrastructure”
Before:

ArcFlow is primarily a web app plus contracts for a specific org’s treasury.

The REST API is effectively a free internal service.

Revenue is implicit (e.g. future SaaS plans) rather than protocol‑native.

After nanopayments:

ArcFlow becomes metered infrastructure: its indexed view of escrow, stream, and payout state is a paid service.

/api/v2/* routes are pay‑per‑call, while /api/v1/* remain free for the dashboard and light use.

Every status query or analytic aggregation can be priced and settled in USDC without building a separate billing system.

3.2 Human‑Scale + Machine‑Scale
Before:

Great for “macro” treasury operations (escrows, vesting, batch payouts).

No native support for micro‑scale, high‑frequency, machine‑to‑machine flows.

After nanopayments:

Macro flows remain as they are (escrow, vesting, payouts).

Micro flows are added:

Pay‑per‑query API access at $0.001.

Per‑second NanoStream payroll around $0.000001 per tick.

Nano‑escrow for $0.50–$5 tasks where on‑chain gas would otherwise dominate.

ArcFlow now covers the full value spectrum: from $500k vesting to $0.001 status checks.

4. Changes by Layer
4.1 API Layer: /api/v2 Pay‑Per‑Call
Introduce a new namespace:

/api/v1/* – current, free routes for UI and basic integrations.

/api/v2/* – x402‑gated routes with per‑call pricing.

Examples:

Route   Price   Behaviour
GET /api/v2/escrows/:id $0.001  Escrow status via existing stores
GET /api/v2/streams/:id $0.001  Stream status, including vested/withdrawable
GET /api/v2/payouts/:id/status  $0.001  Batch payout status with Circle IDs
GET /api/v2/treasury/summary    $0.005  Aggregate obligations and balances
Flow:

Client calls /api/v2/... with no payment → gets 402 Payment Required and a JSON description of price, network, token, and recipient.

Client signs an off‑chain transfer‑authorisation payload (EIP‑3009‑style).

Client retries with an X-PAYMENT header.

Backend verifies via facilitator; if valid, returns the data and queues the payment for batched settlement.

4.1.1 /api/v2 Request Flow Diagram
text
Client                 ArcFlow Backend           Facilitator          Chain
  |                          |                        |                 |
  |-- GET /api/v2/escrows/1 -&gt;|                        |                 |
  |                          |-- 402 Payment Required -&gt;|               |
  |&lt;- 402 + price JSON ------|                        |                 |
  |                          |                        |                 |
  |   [client signs          |                        |                 |
  |    authorisation]        |                        |                 |
  |                          |                        |                 |
  |-- GET /api/v2/escrows/1  |                        |                 |
  |   X-PAYMENT: payload ----&gt;                        |                 |
  |                          |-- /verify(payload) ---&gt;|                 |
  |                          |&lt;- 200 OK (valid) ------|                 |
  |&lt;- 200 + escrow JSON -----|                        |                 |
  |                          |-- /settle(payload) ---&gt;|                 |
  |                          |&lt;- 200 queued ----------|                 |
  |                          |                        |-- batched tx --&gt;|
  |                          |                        |&lt;- confirmed ----|
Impact on ArcFlow:

The REST Status API becomes a revenue‑generating service.

High‑frequency users (bots, monitoring systems, agents) automatically fund the protocol treasury.

No need to build user accounts, invoices, or subscription logic.

4.2 Contracts and Flows: Nano‑Escrow and NanoStream
You keep:

ArcFlowEscrow for large escrows with on‑chain disputes and finality.

ArcFlowStreams for token vesting with cliffs, revocation, and explicit withdrawals.

You add:

Nano‑Escrow (off‑chain held authorisations):

Payer signs an authorisation for a small amount.

ArcFlow backend holds it effectively “in escrow”.

On success: it is settled via the facilitator and batched on‑chain.

On failure/expiry: the authorisation is discarded with no gas.

NanoStream payroll:

Employer pre‑funds a Circle/Gateway wallet.

A worker emits tiny authorisations at high frequency (e.g. one per second).

The employee’s wallet balance increments continuously, without manual withdraw.

4.2.1 Nano‑Escrow Flow Diagram
text
+-------------+      +----------------+      +-------------------------+
|   Payer     |      |   ArcFlow      |      |  Facilitator / Chain    |
+------+------+      +--------+-------+      +------------+------------+
       |                      |                           |
       | 1. Create small job  |                           |
       |    (e.g. $2 escrow)  |                           |
       |---------------------&gt;|                           |
       |                      | 2. Return escrow terms    |
       |                      |    &amp; payment requirements |
       |&lt;---------------------|                           |
       |                      |                           |
       | 3. Sign authorisation|                           |
       |    (off-chain)       |                           |
       |---------------------&gt;| 4. Store payload &quot;in      |
       |                      |    escrow&quot; (no gas yet)   |
       |                      |                           |
 [Worker completes task]      |                           |
       |                      | 5. On success:            |
       |                      |    /settle(payload) -----&gt;|
       |                      |                           | 6. Batch +
       |                      |                           |    transfer
       |                      |                           v
       |                      |                      Recipient paid
       |                      |                           |
       |                      | 7. Mark escrow complete   |
       |                      |                           |
Failure path: if the task fails or expires, ArcFlow discards the payload; no on‑chain transaction occurs.

4.2.2 NanoStream Per‑Second Payroll Diagram
text
+------------------------+       +-----------------+       +-----------------+
| Employer Treasury      |       | NanoStream      |       | Employee Wallet |
| (Circle / Gateway)     |       | Worker          |       | (Arc or L2)     |
+-----------+------------+       +--------+--------+       +--------+--------+
            |                             |                         |
            | 1. Fund streaming balance   |                         |
            |----------------------------&gt;|                         |
            |                             |                         |
            |                             | 2. Every second:        |
            |                             |    - build tiny auth    |
            |                             |    - send to facilitator|
            |                             |------------------------&gt;|
            |                             |                         |
            |                             |                 +-------+------+
            |                             |                 | Facilitator  |
            |                             |                 | + Chain      |
            |                             |                 +-------+------+
            |                             |                         |
            |                             | 3. Batch many tiny auths|
            |                             |    into on-chain tx ----|
            |                             |                         v
            |                             |                   USDC credited
            |                             |                         |
            |                             | 4. Update local view    |
            |                             |    of &quot;streamed so far&quot; |
            |                             |                         |
Trade‑offs:

Nano‑flows emphasise real‑time UX and cost efficiency over on‑chain, per‑step auditability.

They are best suited for operating expenses and micro‑work, while vesting and large escrows remain on‑chain.

4.3 Frontend: Payment‑Aware Client
The React frontend already:

Connects to Arc via MetaMask.

Calls the backend for status and dashboard views.

You add:

A payment‑aware fetch helper (e.g. nanoClient) that:

Detects HTTP 402 responses.

Prompts or uses a configured wallet to sign the authorisation.

Retries the request with X-PAYMENT automatically.

A Nanopayments demo page to visualise:

The 402 challenge.

The signed payment payload (redacted).

The returned data and settlement receipt.

The main dashboard can then gradually move high‑value status views over to /api/v2 behind this helper, without large UX changes.

4.4 Backend: Middleware and Facilitator Integration
The backend already:

Uses Express routes for status endpoints.

Integrates with Circle Wallets and Gateway for payouts.

Runs workers that index events into in‑memory (or JSON‑persisted) stores.

You add:

Payment middleware wrapping selected routes:

Declares fixed prices, accepted assets, and recipient.

Dispatches verification and settlement requests to a facilitator.

A facilitator client that:

Accepts signed payloads from the backend.

Verifies signatures and nonces.

Batches and submits authorisations as on‑chain stablecoin transfers via Gateway.

This reuses the existing Circle trust boundary instead of introducing a new vendor.

5. AI Agent Using ArcFlow with Nanopayments
text
+------------------------+
|   AI Treasury Agent    |
+-----------+------------+
            |
            | 1. Periodic check:
            |    GET /api/v2/streams/:id
            v
+------------------------+          +------------------------+
|   ArcFlow Backend      |          | Nanopayment Facilitator|
|   (/api/v2/*)          |          +-----------+------------+
+-----------+------------+                      |
            | 2. 402 + price JSON               |
            |&lt;----------------------------------+
            |
            | 3. Sign auth with agent wallet
            |    (USDC on some chain)
            |
            | 4. Retry with X-PAYMENT
            |----------------------------------&gt; verify + queue
            |                                   +--------------&gt;
            |                                   | batched tx
            | 5. 200 + stream JSON              v
            |&lt;----------------------------------+
            |
            | 6. Decide: withdraw / revoke /
            |    trigger payout based on state
            |
This shows ArcFlow as agent‑native infrastructure: agents pay a tiny fee to read state and can then execute higher‑value actions (escrow, revoke, batch payout) through the existing flows.

6. Summary
Adding an x402/Circle‑style nanopayment layer:

Gives ArcFlow a clear, protocol‑native business model: pay‑per‑call access to its indexed treasury data.

Extends its coverage from macro treasury operations to micro, high‑frequency, machine‑scale flows.

Makes ArcFlow agent‑native, allowing AI agents and bots to pay directly in USDC for each interaction.

Reuses and deepens the Circle Wallets/Gateway integration that is already central to the project.

ArcFlow remains what it is today – a strong Arc‑native treasury system – but gains a second identity as a metered, nanopayment‑powered financial infrastructure layer for both humans and autonomous agents.</code></pre>
