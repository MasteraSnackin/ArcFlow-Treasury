#!/usr/bin/env node
/**
 * ArcFlow Treasury — Pre-deployment environment checker
 *
 * Run from the repo root:
 *   node scripts/check-deploy.js
 *
 * Checks all three .env files for required variables and
 * reports a clear pass/fail with actionable error messages.
 */

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ─── Colour helpers ──────────────────────────────────────────────────────────
const G  = (s) => `\x1b[32m${s}\x1b[0m`;  // green
const R  = (s) => `\x1b[31m${s}\x1b[0m`;  // red
const Y  = (s) => `\x1b[33m${s}\x1b[0m`;  // yellow
const B  = (s) => `\x1b[1m${s}\x1b[0m`;   // bold

// ─── Parse .env file into a plain object ─────────────────────────────────────
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l && !l.startsWith("#") && l.includes("="))
      .map(l => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

// ─── Check definitions ───────────────────────────────────────────────────────

const CHECKS = [
  {
    label:  "Root .env  (contract deployment)",
    file:   ".env",
    vars: [
      { key: "ARC_TESTNET_RPC_URL", required: true,  hint: "Arc Testnet JSON-RPC URL" },
      { key: "ARC_PRIVATE_KEY",     required: true,  hint: "Deployer private key (0x + 64 hex chars)" },
      { key: "ARC_FEE_COLLECTOR",   required: true,  hint: "Fee collector wallet address" },
      { key: "ARC_FEE_BPS",         required: false, hint: 'Basis points fee (use "0" for no fee)' },
    ],
  },
  {
    label:  "arcflow-backend/.env  (backend runtime)",
    file:   "arcflow-backend/.env",
    vars: [
      { key: "ARC_TESTNET_RPC_URL",       required: true,  hint: "Same RPC URL as root .env" },
      { key: "ARC_ESCROW_ADDRESS",        required: true,  hint: "Output of npm run deploy:arc" },
      { key: "ARC_STREAMS_ADDRESS",       required: true,  hint: "Output of npm run deploy:arc" },
      { key: "ARC_PAYOUT_ROUTER_ADDRESS", required: true,  hint: "Output of npm run deploy:arc" },
      { key: "CIRCLE_API_KEY",            required: false, hint: "Circle API key — blank = stub mode" },
      { key: "CIRCLE_WALLET_ID",          required: false, hint: "Required when CIRCLE_API_KEY is set" },
      { key: "CIRCLE_ENTITY_SECRET",      required: false, hint: "Circle entity secret" },
      { key: "CIRCLE_WEBHOOK_SECRET",     required: false, hint: "HMAC secret for webhook verification" },
      { key: "CIRCLE_BURN_TOKEN_ADDRESS", required: false, hint: "USDC address on Arc (for CCTP cross-chain)" },
      { key: "PAYOUT_STORE_PATH",         required: false, hint: 'E.g. "./data/payouts.json" for persistence' },
    ],
  },
  {
    label:  "arcflow-frontend/.env  (frontend build-time)",
    file:   "arcflow-frontend/.env",
    vars: [
      { key: "VITE_ARC_ESCROW_ADDRESS",        required: true,  hint: "Output of npm run deploy:arc" },
      { key: "VITE_ARC_STREAMS_ADDRESS",       required: true,  hint: "Output of npm run deploy:arc" },
      { key: "VITE_ARC_PAYOUT_ROUTER_ADDRESS", required: true,  hint: "Output of npm run deploy:arc" },
      { key: "VITE_USDC_ADDRESS",              required: true,  hint: "USDC token address on Arc Testnet" },
      { key: "VITE_EURC_ADDRESS",              required: false, hint: "EURC token address on Arc Testnet" },
      { key: "VITE_USYC_ADDRESS",              required: false, hint: "USYC (Hashnote) address on Arc Testnet" },
      { key: "VITE_BACKEND_URL",               required: false, hint: "Backend URL (defaults to localhost:3000)" },
    ],
  },
];

// ─── Run checks ──────────────────────────────────────────────────────────────

let totalErrors   = 0;
let totalWarnings = 0;

console.log("\n" + B("ArcFlow Treasury — Deployment Environment Check"));
console.log("─".repeat(60));

for (const { label, file, vars } of CHECKS) {
  const filePath = path.join(ROOT, file);
  const env      = parseEnv(filePath);
  const exists   = fs.existsSync(filePath);

  console.log("\n" + B(label));
  if (!exists) {
    console.log(`  ${R("✗")} ${file} not found — run: ${Y(`cp ${file.replace(".env", ".env.example")} ${file}`)}`);
    totalErrors += vars.filter(v => v.required).length;
    continue;
  }

  for (const { key, required, hint } of vars) {
    const val = env[key];
    const set = val !== undefined && val.trim() !== "";

    if (set) {
      console.log(`  ${G("✓")} ${key}`);
    } else if (required) {
      console.log(`  ${R("✗")} ${key}  ${Y("← required")}  (${hint})`);
      totalErrors++;
    } else {
      console.log(`  ${Y("○")} ${key}  (optional — ${hint})`);
      totalWarnings++;
    }
  }
}

// ─── Private key format check ────────────────────────────────────────────────
const rootEnv = parseEnv(path.join(ROOT, ".env"));
const pk = rootEnv["ARC_PRIVATE_KEY"] ?? "";
if (pk && !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  console.log("\n" + R("⚠  ARC_PRIVATE_KEY format error: must be 0x followed by exactly 64 hex characters."));
  totalErrors++;
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
if (totalErrors === 0) {
  console.log(G(`✓  All required variables are set. You're ready to deploy!\n`));
  console.log("  Next step: " + Y("npm run deploy:arc") + " (from repo root)\n");
} else {
  console.log(R(`✗  ${totalErrors} required variable(s) missing. Fix the issues above before deploying.\n`));
}
if (totalWarnings > 0) {
  console.log(Y(`○  ${totalWarnings} optional variable(s) not set (Circle live mode / USYC / persistence disabled).\n`));
}

process.exit(totalErrors > 0 ? 1 : 0);
