Project Name

ArcFlow Treasury



Description (Optional)

ArcFlow Treasury is an Arc‑native web application that lets businesses manage stablecoin treasury operations from a single interface, including escrow, vesting streams, and multi‑recipient USDC/EURC payouts, with Arc as the primary execution hub.



Project Image (Optional)

Use a simple banner that visually conveys “stablecoin treasury console on Arc”. For now you can use a placeholder like:

./docs/screenshots/dashboard.png (ArcFlow Treasury dashboard screenshot).







Track 1: Best Smart Contracts on Arc with Advanced Stablecoin Logic

What they want



Conditional escrow with on‑chain dispute + automatic release.



Programmable payroll / vesting in USDC/EURC.



Cross‑chain conditional transfer via Circle Forwarder (escrow on source, release on destination).



What you have



ArcFlowEscrow:



On‑chain escrow in an ERC‑20 (USDC/EURC).



Dispute flow and auto‑release after expiry.



Optional fee logic.



ArcFlowStreams:



Linear vesting, with start, cliff, end, withdraw, and revoke.



ArcFlowPayoutRouter:



Batch payout contract emitting PayoutInstruction events (multi‑step settlement logic: on‑chain batch definition, off‑chain settlement).



Gap



You do not currently implement a Circle Forwarder‑style cross‑chain conditional transfer (escrow on Arc → release on remote chain). That is OK; you’re still a strong fit for this track based on escrow + vesting + multi‑step settlement on Arc, but you are not hitting the “cross‑chain conditional transfer” bullet literally.



Conclusion: You satisfy the core “advanced stablecoin logic” part convincingly; you just don’t have the optional Circle Forwarder pattern yet.



Track 2: Best Chain Abstracted USDC Apps Using Arc as a Liquidity Hub

What they want



Apps that treat multiple chains as one liquidity surface.



Capital sourced/routed/settled across chains through a single app.



Not locked to a single chain, with a seamless user experience.



Tools: Arc, USDC, Circle Wallets, Circle Gateway.



What you have



Design:



Arc as the hub: all obligations (escrows, streams, batches) are on Arc.



Destination chain labels in batches; backend worker can map these to actual chains and, in future, call Circle Gateway / Wallets.



UX:



User interacts with ArcFlow’s Arc‑based app; does not manually bridge or switch chains.



Actual implementation:



You are not currently calling Circle Gateway or doing live cross‑chain settlement.



Conclusion: Architecturally you are aligned with this track (Arc as hub, batch events, chain labels), but you haven’t implemented the Circle Wallets/Gateway calls that would prove actual chain‑abstracted routing. For judging, you must make this clear in the video and docs: the design is present; the integration is the next step.



Track 3: Build Global Payouts and Treasury Systems with USDC

What they want



Automated or agent‑driven payout logic.



Multi‑recipient, multi‑chain settlement.



Treasury systems backed by RWAs.



Policy‑based or condition‑based payouts.



Tools: Circle Gateway, Arc Bridge Kit, Circle Wallets.



What you have



Global payouts \& treasury:



Multi‑recipient payout batches with status tracking.



Treasury console UI showing obligations and (optionally) locked balances.



Automation/policy (MVP):



Simple policy flags (e.g. minimum batch size) can be implemented on the backend; you already sketched that design.



RWAs:



No USYC / RWA integration yet.



Circle tooling:



Same as track 2: you have a designed integration point, not a live one.



Conclusion: You clearly meet the “multi‑recipient payout” and “treasury system” parts. You do not yet implement real RWA backing or live Circle Gateway/Wallets integration, but you can present this as the next iteration.





circle integration



1\. Video voiceover: Circle integration section (30–60 seconds)

Use this after you’ve already shown the core flows (escrow, vesting, payouts):



In this hackathon version, ArcFlow Treasury runs fully on Arc. Escrows, vesting streams, and payout batches are all native USDC smart contracts deployed on Arc, so treasuries can manage obligations in one place with sub‑second finality and predictable USDC gas fees.



For global payouts and chain‑abstracted liquidity, we designed ArcFlow so that Arc is the liquidity hub and Circle is the settlement engine. When a treasury creates a batch payout on Arc, our PayoutRouter contract emits events describing each instruction. A backend worker consumes those events and is designed to call Circle Wallets and Circle Gateway to execute payouts on whatever destination chains the treasury needs, without users ever manually bridging or switching networks.



In other words, ArcFlow separates obligation management from settlement. Arc keeps the canonical record of who is owed what, and Circle’s APIs are responsible for moving USDC across chains and accounts, using tools like Gateway and CCTP to maintain unified liquidity instead of fragmented, wrapped assets.



The next step after the hackathon is to turn those designed integration points into live Circle API calls and webhook handlers, so each on‑chain payout instruction maps directly to a real USDC transfer in production.

​



That will cleanly tick “core functions” plus “how you use Circle’s tools / where they plug in”.



2\. Circle product feedback – answer skeleton

You’ll probably see 3–4 questions. Use something like this and edit to fit their exact wording.



A. Why you chose these Circle products

We chose Circle Wallets, Circle Gateway, and CCTP because ArcFlow Treasury is explicitly about real‑world treasury operations and global payouts, not just DeFi for its own sake.



Arc already gives us sub‑second settlement and USDC as native gas, but we still need a way to treat liquidity across multiple chains as a single surface area. Gateway and Wallets are a good fit for that: they provide unified USDC balances and wallet infrastructure while abstracting away per‑chain pre‑funding and rebalancing.



CCTP gives us a standards‑based way to move USDC natively when we do need explicit cross‑chain transfers, without wrapped tokens or fragmented liquidity.



B. What worked well during development

The main strength was the clarity of the product mental models. The documentation makes it straightforward to understand when to use Wallets versus CCTP versus Gateway, and how they fit together in a real application.



From a design perspective it was easy to align ArcFlow’s architecture with Circle’s: Arc holds the canonical obligations on‑chain; a backend worker consumes events and then uses Circle APIs as the execution layer. The docs provide enough detail to design that split even before we wrote any integration code.



C. What could be improved

The main friction was stitching together the “happy path” across products. The docs are strong individually, but it would help to have a single, end‑to‑end reference architecture specifically for “multi‑chain treasury and payouts” that shows Wallets + Gateway + CCTP + webhooks as one coherent flow.



For hackathon‑style builds, clearer sandbox quick‑start bundles would also help: one page with test credentials workflow, example environment variables, and minimal reference code for a payout + status callback loop.



D. Recommendations to improve developer experience

Two main recommendations:



Provide a “Treasury \& Payouts Starter Kit” repo that includes: a sample backend worker that listens to on‑chain events, calls Circle Wallets/Gateway, and handles webhooks, plus a minimal frontend dashboard. This would accelerate real‑world finance projects like ArcFlow that want to focus on business logic rather than wiring.

​



Offer more explicit guidance on how to model responsibilities between a project’s own smart contracts and Circle’s contracts/APIs. For example: patterns for treating a chain like Arc as the obligation ledger while letting Circle handle cross‑chain settlement and custody behind a clean interface.





short feedback

Why you chose these Circle products

ArcFlow Treasury is about real businesses running payroll, escrows and batch payouts in USDC, not just a neat DeFi demo. We use Arc as the place where all the obligations live – who is owed what, on which schedule – and we look to Circle’s products for the “move real money around the world” part.



In our design, the treasury operator creates escrows, vesting streams and payout batches on Arc. The contracts on Arc are the source of truth: they define things like “pay this contractor 5,000 USDC if the dispute window passes” or “stream this salary over 12 months”. That gives us sub‑second finality and predictable USDC‑denominated gas on Arc, which is ideal for a treasury console.



Where Circle comes in is everything beyond that hub. We picked Wallets and Gateway because they give us a way to treat multiple chains as one liquidity surface. From the operator’s perspective, they just say “pay this batch” in the ArcFlow UI; behind the scenes, our backend is designed to fan those instructions out to Circle, which can then route USDC to the right chain and address without the user ever thinking about bridges, rebalancing, or which network is currently funded.



CCTP fits as the native bridge when we do need explicit cross‑chain transfers. For example, if a company holds its core treasury on one chain but wants to pay a contractor on another, we can keep the canonical “you are owed X” on Arc, and use CCTP under the hood to move USDC natively rather than minting and burning wrapped tokens. That combination – Arc as obligation ledger, Circle as cross‑chain execution layer – is exactly what we were optimising for.



What worked well during development

One thing that worked surprisingly well was designing the split between “on‑chain obligations” and “off‑chain execution” just from Circle’s high‑level docs and product descriptions.



In ArcFlow we have a PayoutRouter contract that emits a PayoutInstruction event for each item in a batch. It was straightforward to say: “this event is the hand‑off point to Circle”. From there, the mental model is clear – a backend worker listens to those events, looks at the destination chain label and amount, and turns that into a call to Circle’s APIs. The documentation gives you enough of a picture to be confident that this is the right boundary, even before you plug in real API keys.



It also helped that Circle’s products map cleanly onto concepts we already needed. We were always going to have:



A place to hold and route USDC balances for payouts.



A way to move USDC between chains without confusing the user.



A webhook‑style mechanism to bring settlement status back into the app.



Wallets, Gateway and CCTP slot into those roles quite naturally, so we didn’t have to twist our architecture to make them fit.



What could be improved

Where we felt more friction was in going from “we understand each product” to “we have a confident end‑to‑end design for a real payout loop”.



For example, in ArcFlow the story is:



A user creates a multi‑recipient payout batch on Arc.



The PayoutRouter contract emits one event per recipient.



A backend worker consumes those events and should call Circle.



Circle moves USDC and tells us what happened.



We surface the status back in the ArcFlow dashboard.



Individually, the pieces exist – Wallets, Gateway, CCTP, webhooks – but we had to stitch that flow together ourselves from several different mental models. There wasn’t a single “if your app looks like ArcFlow, here is the recommended way to wire all of this” reference, so we spent time reasoning through failure modes, idempotency and status synchronisation that could have been guided more directly.



For a hackathon project in particular, setting up the sandbox felt like another area where a bit more hand‑holding would help. A single quick‑start that walks through: “here is how you get test credentials, here is a minimal payout example, here is how to see the webhook come back and update a row in your UI” would have shaved a lot of design time off our side.



Recommendations to improve the product and developer experience

Two concrete things would have made building ArcFlow faster and given us more confidence about scaling it beyond the hackathon.



First, a “Global Treasury \& Payouts Starter Kit”. In our case, we built a small worker process that listens for on‑chain PayoutInstruction events, turns them into payouts, and updates the status so the dashboard can show which payments are queued, completed or failed. A reference implementation that already does something like this – with example schemas, retry logic, and webhook handling – would be incredibly valuable. Projects like ours could plug in their own business rules (escrow conditions, vesting policies) instead of reinventing the plumbing for every app.



Second, more opinionated reference architectures for patterns you clearly care about: chain‑abstracted USDC apps and policy‑based payouts. In ArcFlow we had to decide, for example, “what exactly lives in the Arc contracts, what belongs in our backend, and what should we rely on Circle to do?” Clear guidance such as “keep obligations and access control on‑chain; let an off‑chain coordinator batch and sign; treat Circle as the execution engine and source of truth for balances on external chains” would reduce that ambiguity. Alongside that, some guidance on observability and scaling – say, how to handle very large batches or many concurrent webhooks – would make the path from hackathon MVP to production feel much more straightforward.



WHY?

ArcFlow Treasury is designed so Arc is the single source of truth for obligations, and Circle is the execution layer that moves real funds. In the app, a treasury operator creates escrows, vesting streams and multi‑recipient payout batches directly on Arc, using USDC as native gas so fees stay predictable and the system benefits from sub‑second finality. Each payout batch is recorded in our PayoutRouter contract, which emits a structured event per recipient. Our backend architecture is built around those events: a worker service consumes them and is designed to translate each one into a call to Circle Wallets and Circle Gateway, so USDC can be routed to the correct chain and address without the user worrying about bridges, rebalancing, or which network is funded. Where a native cross‑chain transfer is required, the design uses CCTP so that USDC can move between chains without wrapped tokens or fragmented liquidity. This whole flow is documented in our architecture diagrams and markdown docs: they show how the Arc contracts define obligations, how the backend maps on‑chain events to Circle API payloads, and how settlement status returns to ArcFlow so the dashboard can show which payouts are queued, completed or failed.

