import {
  BrowserProvider,
  Contract,
  parseUnits,
  formatUnits,
  encodeBytes32String,
  ZeroAddress,
} from "ethers";
import type { Eip1193Provider } from "ethers";

// ---------------------------------------------------------------------------
// Minimal ABIs — only the functions and events used by the frontend UI.
// ---------------------------------------------------------------------------

const ESCROW_ABI = [
  "function createEscrow(address payee, address token, uint256 amount, uint256 expiry, address arbitrator) returns (uint256)",
  "function escrows(uint256 id) view returns (address payer, address payee, address token, uint256 amount, uint256 expiry, address arbitrator, bool disputed, bool released, bool refunded)",
  "function raiseDispute(uint256 escrowId)",
  "function autoRelease(uint256 escrowId)",
  "function resolveDispute(uint256 escrowId, bool releaseToPayee)",
  "event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, address token, uint256 amount, uint256 expiry, address arbitrator)",
];

const STREAMS_ABI = [
  "function createStream(address employee, address token, uint256 totalAmount, uint256 start, uint256 cliff, uint256 end) returns (uint256)",
  "function streams(uint256 id) view returns (address employer, address employee, address token, uint256 totalAmount, uint256 start, uint256 cliff, uint256 end, uint256 withdrawn)",
  "function getVested(uint256 id) view returns (uint256)",
  "function getWithdrawable(uint256 id) view returns (uint256)",
  "function withdraw(uint256 id)",
  "function revoke(uint256 id)",
  "event StreamCreated(uint256 indexed id, address indexed employer, address indexed employee, address token, uint256 totalAmount, uint256 start, uint256 cliff, uint256 end)",
];

const PAYOUT_ABI = [
  "function createBatchPayout(address token, address[] recipients, uint256[] amounts, bytes32[] destinationChains) returns (uint256)",
  "event BatchCreated(uint256 indexed batchId, address indexed creator, address indexed token, uint256 totalAmount)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// ---------------------------------------------------------------------------
// Provider / Signer
// ---------------------------------------------------------------------------

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function getProvider(): BrowserProvider {
  const eth = (window as unknown as { ethereum?: EthProvider }).ethereum;
  if (!eth) throw new Error("No wallet detected. Install MetaMask to continue.");
  return new BrowserProvider(eth as unknown as Eip1193Provider);
}

export async function getSigner() {
  return getProvider().getSigner();
}

// ---------------------------------------------------------------------------
// Contract factories
// ---------------------------------------------------------------------------

export async function getEscrowContract() {
  const addr = import.meta.env.VITE_ARC_ESCROW_ADDRESS as string | undefined;
  if (!addr) throw new Error("VITE_ARC_ESCROW_ADDRESS not configured. Copy .env.example → .env and fill the address.");
  return new Contract(addr, ESCROW_ABI, await getSigner());
}

export async function getEscrowContractReadOnly() {
  const addr = import.meta.env.VITE_ARC_ESCROW_ADDRESS as string | undefined;
  if (!addr) throw new Error("VITE_ARC_ESCROW_ADDRESS not configured.");
  return new Contract(addr, ESCROW_ABI, getProvider());
}

export async function getStreamsContract() {
  const addr = import.meta.env.VITE_ARC_STREAMS_ADDRESS as string | undefined;
  if (!addr) throw new Error("VITE_ARC_STREAMS_ADDRESS not configured. Copy .env.example → .env and fill the address.");
  return new Contract(addr, STREAMS_ABI, await getSigner());
}

export async function getStreamsContractReadOnly() {
  const addr = import.meta.env.VITE_ARC_STREAMS_ADDRESS as string | undefined;
  if (!addr) throw new Error("VITE_ARC_STREAMS_ADDRESS not configured.");
  return new Contract(addr, STREAMS_ABI, getProvider());
}

export async function getPayoutContract() {
  const addr = import.meta.env.VITE_ARC_PAYOUT_ROUTER_ADDRESS as string | undefined;
  if (!addr) throw new Error("VITE_ARC_PAYOUT_ROUTER_ADDRESS not configured. Copy .env.example → .env and fill the address.");
  return new Contract(addr, PAYOUT_ABI, await getSigner());
}

export function getErc20Contract(tokenAddress: string, signerOrProvider: Awaited<ReturnType<typeof getSigner>>) {
  return new Contract(tokenAddress, ERC20_ABI, signerOrProvider);
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: (import.meta.env.VITE_USDC_ADDRESS as string | undefined) ?? "",
  EURC: (import.meta.env.VITE_EURC_ADDRESS as string | undefined) ?? "",
};

export const DECIMALS = 6;

export const parseToken = (amount: string): bigint => parseUnits(amount, DECIMALS);

export const formatToken = (raw: bigint): string => formatUnits(raw, DECIMALS);

/** Encode a chain label string (e.g. "ARC") as a bytes32 value for the contract. */
export const encodeChain = (label: string): string => encodeBytes32String(label);

export { ZeroAddress };

// ---------------------------------------------------------------------------
// ERC-20 approval helper
// ---------------------------------------------------------------------------

/**
 * Checks the token allowance for `spenderAddr`. If insufficient, calls
 * `approve(spenderAddr, amount)` and waits for the transaction to confirm.
 *
 * @param onStatus  Callback invoked with a human-readable status string during the flow.
 */
export async function approveIfNeeded(
  tokenAddr: string,
  spenderAddr: string,
  amount: bigint,
  onStatus: (msg: string) => void
): Promise<void> {
  if (!tokenAddr) {
    throw new Error(
      "Token address not configured. Set VITE_USDC_ADDRESS or VITE_EURC_ADDRESS in your .env file."
    );
  }
  const signer = await getSigner();
  const token = getErc20Contract(tokenAddr, signer);
  const owner = await signer.getAddress();
  const allowance = (await token.allowance(owner, spenderAddr)) as bigint;
  if (allowance >= amount) return;
  onStatus("Approving token spend…");
  const tx = await token.approve(spenderAddr, amount);
  await (tx as { wait: () => Promise<unknown> }).wait();
}
