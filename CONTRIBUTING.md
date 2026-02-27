# Contributing to ArcFlow Treasury

Thank you for your interest in contributing to ArcFlow Treasury. This document explains how to set up the project, the basic workflow for contributions, and how to report issues.

## Project Layout

- `arcflow-contracts/` – Solidity contracts and Hardhat configuration.
- `arcflow-backend/` – Node/Express API server and event listener worker.
- `arcflow-frontend/` – React/Vite single-page application.

## Getting Started

### Prerequisites

- Node.js (LTS: 18.x or 20.x)
- npm
- Arc testnet RPC endpoint
- Arc testnet wallet with test funds and USDC (or a test ERC‑20 token used as USDC)

### Setup

Clone the repository:

```bash
git clone <YOUR_REPO_URL_HERE>
cd <YOUR_REPO_FOLDER>
```

Install dependencies:

```bash
cd arcflow-contracts && npm install
cd ../arcflow-backend && npm install
cd ../arcflow-frontend && npm install
```

Configure `.env` files for each subproject as described in `README.md`.

## Development Workflow

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/my-change
   ```

2. Make your changes in the appropriate subproject(s).

3. Run checks before committing:

   - Contracts:

     ```bash
     cd arcflow-contracts
     npx hardhat compile
     npm test   # when tests are present
     ```

   - Backend:

     ```bash
     cd arcflow-backend
     npm run lint   # if configured
     npm test       # when tests are present
     ```

   - Frontend:

     ```bash
     cd arcflow-frontend
     npm run build
     ```

4. Commit changes with a clear message:

   ```bash
   git commit -m "feat: add XYZ capability to escrow"
   ```

5. Push your branch and open a Pull Request describing:

   - What you changed
   - Why it is useful
   - Any configuration or migration steps required

## Coding Guidelines

- Prefer TypeScript for backend and frontend code.
- Keep contracts small and focused; avoid unnecessary inheritance and complexity.
- Validate inputs thoroughly in smart contracts and backend handlers.
- Write small, composable React components and avoid heavy global state.

## Reporting Issues

If you find a bug or have a feature request:

- Check existing issues to see if it is already tracked.
- Open a new issue with:
  - Clear title
  - Steps to reproduce (if a bug)
  - Expected vs actual behaviour
  - Environment details (Arc network, browser, OS)

## Security

If you discover a security vulnerability in the smart contracts or backend, please do **not** open a public issue immediately. Instead, contact the maintainer directly (see README Contact section) so we can assess and patch the issue responsibly.
