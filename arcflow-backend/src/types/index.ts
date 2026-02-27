// ---------------------------------------------------------------------------
// Chain identifiers
// Matches the naming convention in circlefin/arc-multichain-wallet
// (lib/circle/gateway-sdk.ts CIRCLE_CHAIN_NAMES / SupportedChain).
// ---------------------------------------------------------------------------

export type CircleBlockchainId =
  | "ARC-TESTNET"
  | "BASE-SEPOLIA"
  | "AVAX-FUJI"
  | "ETH-SEPOLIA"
  | "ARB-SEPOLIA";

// Stablecoins that Circle routes natively.
// USYC (Hashnote tokenized US Treasury yield token, available on Arc at
// usyc.dev.hashnote.com) is accepted as a source token by ArcFlowPayoutRouter
// but Circle's cross-chain routes use USDC/EURC as the settlement asset.
export type CircleCurrency = "USDC" | "EURC";

// ---------------------------------------------------------------------------
// Circle CCTP domain IDs
// Sourced from arc-multichain-wallet/lib/circle/gateway-sdk.ts DOMAIN_IDS.
// These are required when constructing cross-chain Gateway transfer requests.
// ---------------------------------------------------------------------------
export const CIRCLE_DOMAIN_IDS: Record<CircleBlockchainId, number> = {
  "ARC-TESTNET": 5,    // Arc testnet — verify against Circle docs if this changes
  "BASE-SEPOLIA": 6,   // Base Sepolia
  "AVAX-FUJI":    1,   // Avalanche Fuji
  "ETH-SEPOLIA":  0,   // Ethereum Sepolia
  "ARB-SEPOLIA":  3,   // Arbitrum Sepolia
};

// ---------------------------------------------------------------------------
// Circle API base URLs (testnet defaults, overridable via .env)
// ---------------------------------------------------------------------------
export const CIRCLE_GATEWAY_BASE_URL_DEFAULT =
  "https://gateway-api-testnet.circle.com/v1";
export const CIRCLE_WALLETS_BASE_URL_DEFAULT = "https://api.circle.com/v1";

// ---------------------------------------------------------------------------
// On-chain event type (from ArcFlowPayoutRouter)
// ---------------------------------------------------------------------------
export interface PayoutInstructionEvent {
  batchId: bigint;
  index: bigint;
  recipient: string;
  amount: bigint;
  destinationChain: string;
}

// ---------------------------------------------------------------------------
// Off-chain payout tracking
// ---------------------------------------------------------------------------
export interface PayoutStatus {
  batchId: string;
  index: number;
  recipient: string;
  amount: string;
  destinationChain: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  circleTransferId?: string;  // was circlePayoutId — renamed to match Circle's /v1/transfers
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchStatus {
  batchId: string;
  totalPayouts: number;
  totalAmount: string;
  ready: boolean;
  payouts: PayoutStatus[];
}

// ---------------------------------------------------------------------------
// Circle API request/response shapes
//
// CircleTransferRequest mirrors the Circle Wallets API /v1/transfers body
// for same-chain transfers, and carries the fields needed to build a Gateway
// /v1/transfer (BurnIntent) request for cross-chain transfers.
//
// See arc-multichain-wallet/lib/circle/gateway-sdk.ts for the full
// burn-intent → attest → mint implementation this stub is designed to slot into.
// ---------------------------------------------------------------------------
export interface CircleTransferRequest {
  // Prevents duplicate submissions across retries.
  idempotencyKey: string;

  amount: {
    amount: string;          // human-readable, e.g. "100.00"
    currency: CircleCurrency; // "USDC" | "EURC"
  };

  destination: {
    type: "blockchain";
    address: string;
    chain: CircleBlockchainId; // Circle's chain name, e.g. "ARC-TESTNET"
  };

  // CCTP domain ID for the destination chain.
  // Required for cross-chain Gateway transfers; omit for same-chain Wallets transfers.
  // Use circleClient.getDomainId(chain) to resolve.
  destinationDomain?: number;
}

export interface CircleTransferResponse {
  id: string;
  status: "pending" | "complete" | "failed";
  amount: {
    amount: string;
    currency: CircleCurrency;
  };
  destination: {
    type: "blockchain";
    address: string;
    chain: CircleBlockchainId;
  };
  createDate: string;
}
