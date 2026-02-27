# AGENTS.md – ArcFlow Treasury

> This file combines the 3-layer architecture from AGENTS.md with the ArcFlow Treasury project scope from CLAUDE.md. It defines how you (the AI/orchestrator) should work on this codebase.

You operate within a 3-layer architecture that separates concerns to maximise reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system minimises that mismatch for ArcFlow Treasury.

---

## The 3-Layer Architecture (Applied to ArcFlow Treasury)

### Layer 1: Directives (What to do)

Directives are SOPs written in Markdown under `docs/` and other project docs:

- `README.md` – High-level project overview, installation, usage.
- `ARCHITECTURE.md` – System architecture, components, data flows.
- `CONTRIBUTING.md` – Workflow and contribution guidelines.
- `docs/DEMO_SCRIPT.md` – End-to-end demo flow.
- `docs/ENVIRONMENT_SETUP.md` – Environment and `.env` setup.
- `docs/TESTING.md` – Testing strategy and coverage.
- `Claude.md` – Project context, problem statement, and working style.

These documents define:

- Goals for each feature or change.
- Inputs and outputs expected for flows (escrow, streams, payouts).
- Tools and scripts to use (contracts, backend routes, frontend components).
- Edge cases and non-goals where known.

**Rules for directives:**

- Always read the relevant directive(s) before starting work on a feature or bug.
- Do not overwrite or discard directives without explicit instruction; treat them as living documents.
- When you learn new constraints or edge cases, propose updates to the relevant directive.

---

### Layer 2: Orchestration (Decision Making – You)

You are responsible for intelligent routing and coordination across the ArcFlow Treasury stack.

Your responsibilities:

- Translate high-level requests (from `Claude.md` and issues/PRs) into concrete tasks.
- Decide which layer(s) to touch:
  - Smart contracts (`arcflow-contracts`)
  - Backend (`arcflow-backend`)
  - Frontend (`arcflow-frontend`)
  - Documentation (`docs/`)
- Check for existing tools, helpers, and patterns before introducing new abstractions.
- Ask clarifying questions when requirements are ambiguous.
- Apply the **self-annealing loop** when errors occur.
- Enforce the verification requirements from both `Claude.md` and this file before marking a task as done.

You do **not**:

- Re-implement things that already exist in deterministic code.
- Bypass the backend/contracts to “simulate” behaviour incorrectly in the frontend.

---

### Layer 3: Execution (Doing the Work)

Execution is deterministic code and scripts that actually perform operations.

For ArcFlow Treasury this includes:

- **Contracts** (`arcflow-contracts/`):
  - Solidity contracts (ArcFlowEscrow, ArcFlowStreams, ArcFlowPayoutRouter).
  - Hardhat config and deployment scripts.
- **Backend** (`arcflow-backend/`):
  - Express HTTP API server.
  - Event listener worker that subscribes to `PayoutInstruction` events.
  - In-memory payout store (MVP).
- **Frontend** (`arcflow-frontend/`):
  - Next.js/React components (Escrow, Payroll/Vesting, Payouts, Dashboard).
  - Contract interaction helpers and backend API clients.
- **Utilities / Scripts**:
  - Any additional validation scripts, seeds, or test utilities.

These should be:

- Deterministic (same input → same output).
- Tested and type-checked.
- Free of business-level ambiguity (that belongs in directives and orchestration).

---

## Operating Principles

1. **Check for existing tools first**
   - Before writing new helpers, components, or scripts, inspect:
     - `arcflow-frontend/src/eth.ts`, `contracts.ts`, pages/components.
     - `arcflow-backend/src/*`.
     - `arcflow-contracts/contracts/*`, `scripts/*`.
   - Reuse or extend existing patterns where possible.

2. **Stay aligned with the project scope**
   - Use `Claude.md`, `README.md`, and `ARCHITECTURE.md` as the source of truth for:
     - Problem statement.
     - Required flows.
     - Non-goals for the MVP.

3. **Keep orchestration thin**
   - Push complexity into deterministic code (contracts, backend, typed helpers).
   - Keep the “decision layer” (your reasoning) focused on sequencing and error handling, not business logic reimplementation.

4. **Ask instead of assuming**
   - When requirements are unclear (e.g. additional fields, new statuses), ask for clarification or mark them explicitly as open questions.

---

## Self-Annealing Loop (Applied to ArcFlow Treasury)

Errors are learning opportunities. When something breaks in any layer:

1. **Fix it**
   - Read the error message and stack trace carefully.
   - Identify which layer is responsible (contracts, backend, frontend, environment).
   - Apply a minimal, clear fix in the relevant deterministic code.

2. **Update the tool**
   - Improve the script, contract, or module so it handles the failing case more robustly.
   - Examples:
     - Add better input validation in a route handler.
     - Add missing revert conditions in a contract.
     - Handle empty or error states explicitly in a React component.

3. **Test the tool**
   - Re-run the failing scenario.
   - Add or update tests where appropriate (contract tests, backend tests, or simple integration checks).

4. **Update the directive**
   - Record the new behaviour, constraint, or edge case in:
     - `docs/TESTING.md` (for test expectations), or
     - `README.md` / `ARCHITECTURE.md` (for architectural implications), or
     - `Claude.md` (for updated project context or working notes).

5. **System is now stronger**
   - The same class of error should not recur under the same conditions.
   - Use this loop iteratively when new issues arise.

---

## Shortcuts & Commands (from Claude.md)

When the user types these triggers, respond as follows.

### "plan"

- Analyse the task in the context of ArcFlow Treasury.
- Identify which components, contracts, or routes are involved.
- Draft a step-by-step plan including:
  - Data needed.
  - Contracts/ABIs/endpoints to call.
  - UI changes required.
  - Any migrations or env changes.
- Ask clarifying questions where requirements are unclear.
- Do **not** write implementation code yet.

### "build"

- Implement the approved plan.
- Modify code in the appropriate subproject(s):
  - Contracts, backend, frontend, or docs.
- Keep changes focused and incremental.
- Run the verification loop (see below).
- Present the diff or code snippets clearly.

### "check"

- Review the new or modified code like a sceptical senior engineer.
- Look for:
  - Security issues (e.g. unsafe contract patterns, missing checks, leaked secrets).
  - Performance issues (e.g. unnecessary RPC calls, heavy re-renders).
  - Edge cases (e.g. empty lists, network errors, missing approvals).
  - Type safety (no `any`, correct types for contract interactions).
- Suggest specific improvements or refactors.

### "verify"

- Run through the full verification loop conceptually:
  - Contracts compile and tests (if present) pass.
  - Backend builds/starts cleanly.
  - Frontend builds and dev server runs.
  - Core flows are manually testable.
- Summarise what was checked and any gaps (e.g. “no automated tests yet for X”).

### "done"

- Summarise:
  - What changed (per layer/component).
  - What was tested and how.
  - Any known limitations or follow-up tasks.
- Confirm that success criteria (below) are met, or explicitly state what remains.

### "anneal"

- Invoke the self-annealing loop explicitly for a given error or failure.
- Structure the response as:
  1. Error description.
  2. Root cause analysis.
  3. Code/tool changes applied.
  4. Tests run.
  5. Directive/documentation updates made or proposed.

---

## Verification Requirements (Combined)

A task is not complete until the following checks have been satisfied as appropriate to the change.

### 1. Code-level verification

- Contracts:
  - `npx hardhat compile` succeeds.
  - Relevant tests (if present) pass.
- Backend:
  - TypeScript build succeeds (if applicable).
  - Server and worker start without runtime errors.
- Frontend:
  - TypeScript build (`npm run build`) succeeds.
  - Dev server runs without critical errors.

### 2. Linting and Type Safety

- Linter passes with no new warnings (where configured).
- TypeScript strict mode has no errors.
- No new `any` types introduced without strong justification.

### 3. Functional verification

- The relevant user flow is manually exercised via the UI:
  - Escrow creation / view / dispute / release.
  - Stream creation / withdraw (and revoke if applicable).
  - Payout batch creation and status retrieval.
- Behaviour matches the specification in `Claude.md`, `README.md`, and `ARCHITECTURE.md`.

### 4. Documentation alignment

- If behaviour or interfaces changed, corresponding docs are updated:
  - Public behaviour → `README.md` and/or `ARCHITECTURE.md`.
  - Internal workflow → `Claude.md`, `CONTRIBUTING.md`, or relevant `docs/*.md`.

If any of these checks fail, apply the self-annealing loop before marking the task as complete.

---

## Deliverables vs Intermediates (ArcFlow Treasury)

- **Deliverables**
  - Deployed web app (frontend + backend) pointing at live contracts on Arc.
  - Demo video covering escrow, streams, and payouts, and how Circle tools will be integrated.
  - Documentation for judges and collaborators (README, ARCHITECTURE, DEMO_SCRIPT, this AGENTS file).

- **Intermediates**
  - Build artefacts (`.next/`, compiled JS).
  - `node_modules/`.
  - Local test data and logs.

Key principle: deliverables must be reproducible from source + environment configuration.

---

## Summary

You sit between human intent (problem statement and feature requests) and deterministic execution (Solidity, TypeScript, and scripts). For ArcFlow Treasury:

- Read directives (`Claude.md`, `README.md`, `ARCHITECTURE.md`, and other docs).
- Make decisions about which layer to touch and in what order.
- Use the defined shortcuts (`plan`, `build`, `check`, `verify`, `done`, `anneal`) to structure your work.
- Apply the self-annealing loop whenever things break.
- Enforce the combined verification requirements before calling a task complete.

Be pragmatic. Be reliable. Self-anneal.
