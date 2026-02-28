import { logger } from "../config/logger";
import {
  CircleBlockchainId,
  CircleCurrency,
  CircleTransferRequest,
  CircleTransferResponse,
  CIRCLE_DOMAIN_IDS,
  CIRCLE_GATEWAY_BASE_URL_DEFAULT,
  CIRCLE_WALLETS_BASE_URL_DEFAULT,
} from "../types";

// ---------------------------------------------------------------------------
// Static mapping: on-chain chain label → Circle blockchain identifier.
// Extracted as a module-level constant so mapChainIdentifier() does not
// allocate a new Record object on every invocation.
// ---------------------------------------------------------------------------
const CHAIN_MAP: Record<string, CircleBlockchainId> = {
  ARC:       "ARC-TESTNET",
  BASE:      "BASE-SEPOLIA",
  AVAX:      "AVAX-FUJI",
  AVALANCHE: "AVAX-FUJI",
  ETH:       "ETH-SEPOLIA",
  ETHEREUM:  "ETH-SEPOLIA",
  ARB:       "ARB-SEPOLIA",
  ARBITRUM:  "ARB-SEPOLIA",
};

/**
 * Circle API client stub.
 *
 * Modelled after the patterns in circlefin/arc-multichain-wallet:
 *  - Initialises with CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET (both validated at startup).
 *  - Routes requests to two separate base URLs:
 *      • Circle Wallets API  (CIRCLE_WALLETS_BASE_URL)  → same-chain /v1/transfers
 *      • Circle Gateway API  (CIRCLE_GATEWAY_BASE_URL)  → cross-chain /v1/transfer
 *  - Chain identifiers use Circle's naming convention: "ARC-TESTNET", "BASE-SEPOLIA", etc.
 *  - In production, replacing the stub logic in createTransfer() with real fetch calls
 *    and adding EIP-712 BurnIntent signing (see gateway-sdk.ts in arc-multichain-wallet)
 *    is sufficient to go live — no structural changes required.
 *
 * USYC note:
 *  ArcFlowPayoutRouter also accepts USYC (Hashnote tokenized US Treasury yield token,
 *  available on Arc at usyc.dev.hashnote.com). USYC holders can subscribe/redeem to
 *  convert between USDC ↔ USYC on Arc testnet. Circle's cross-chain routes settle in
 *  USDC/EURC; USYC is a source-chain token only in the current integration design.
 */
class CircleClient {
  private readonly apiKey: string;
  private readonly entitySecret: string;
  private readonly gatewayBaseUrl: string;
  private readonly walletsBaseUrl: string;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY ?? "";
    this.entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? "";
    this.gatewayBaseUrl =
      process.env.CIRCLE_GATEWAY_BASE_URL ?? CIRCLE_GATEWAY_BASE_URL_DEFAULT;
    this.walletsBaseUrl =
      process.env.CIRCLE_WALLETS_BASE_URL ?? CIRCLE_WALLETS_BASE_URL_DEFAULT;

    if (!this.apiKey) {
      logger.warn(
        "CIRCLE_API_KEY is not set — Circle client running in stub mode"
      );
    }
    if (!this.entitySecret) {
      logger.warn(
        "CIRCLE_ENTITY_SECRET is not set — Developer Controlled Wallets SDK cannot be initialised"
      );
    }
  }

  /**
   * Creates a USDC/EURC transfer with Circle.
   *
   * Same-chain (destination == ARC-TESTNET):
   *   Production: POST {walletsBaseUrl}/transfers
   *   Auth header: Authorization: Bearer {apiKey}
   *
   * Cross-chain (any other destination):
   *   Production: sign an EIP-712 BurnIntent, POST {gatewayBaseUrl}/transfer,
   *   poll GET {gatewayBaseUrl}/transfers/{id} until attestation is ready,
   *   then call executeMint() on the destination chain.
   *   Full reference: arc-multichain-wallet/lib/circle/gateway-sdk.ts
   *
   * @param request The transfer request (see CircleTransferRequest)
   * @returns A stub CircleTransferResponse with status "pending"
   */
  async createTransfer(
    request: CircleTransferRequest
  ): Promise<CircleTransferResponse> {
    const isCrossChain = request.destination.chain !== "ARC-TESTNET";
    const endpoint = isCrossChain
      ? `${this.gatewayBaseUrl}/transfer`  // Gateway: burn-attest-mint
      : `${this.walletsBaseUrl}/transfers`; // Wallets: direct on-chain send

    logger.info("Circle API (STUB): Creating transfer", {
      idempotencyKey: request.idempotencyKey,
      amount: request.amount.amount,
      currency: request.amount.currency,
      destinationChain: request.destination.chain,
      destinationAddress: request.destination.address,
      destinationDomain: request.destinationDomain,
      isCrossChain,
      endpoint,
    });

    // Simulate network round-trip
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stubTransferId = `circle_transfer_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    const response: CircleTransferResponse = {
      id: stubTransferId,
      status: "pending",
      amount: request.amount,
      destination: request.destination,
      createDate: new Date().toISOString(),
    };

    logger.info("Circle API (STUB): Transfer created", {
      transferId: stubTransferId,
      status: response.status,
    });

    return response;
  }

  /**
   * Gets the status of a transfer from Circle.
   *
   * Production:
   *   Cross-chain: GET {gatewayBaseUrl}/transfers/{id}
   *   Same-chain:  GET {walletsBaseUrl}/transfers/{id}
   *
   * @param transferId The Circle transfer ID returned by createTransfer
   */
  async getTransferStatus(
    transferId: string
  ): Promise<CircleTransferResponse> {
    logger.info("Circle API (STUB): Getting transfer status", { transferId });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const isComplete = Math.random() > 0.5;

    const response: CircleTransferResponse = {
      id: transferId,
      status: isComplete ? "complete" : "pending",
      amount: { amount: "100.00", currency: "USDC" },
      destination: {
        type: "blockchain",
        address: "0x0000000000000000000000000000000000000000",
        chain: "ARC-TESTNET",
      },
      createDate: new Date().toISOString(),
    };

    logger.info("Circle API (STUB): Transfer status retrieved", {
      transferId,
      status: response.status,
    });

    return response;
  }

  /**
   * Maps a bytes32 chain label (as stored by ArcFlowPayoutRouter) to Circle's
   * blockchain chain identifier, following arc-multichain-wallet conventions.
   *
   * Testnet mappings:
   *   ARC / (default) → "ARC-TESTNET"   (home chain — was incorrectly "ETH")
   *   BASE            → "BASE-SEPOLIA"
   *   AVAX/AVALANCHE  → "AVAX-FUJI"
   *   ETH/ETHEREUM    → "ETH-SEPOLIA"
   *   ARB/ARBITRUM    → "ARB-SEPOLIA"
   *
   * @param bytes32Chain Raw string from ethers.decodeBytes32String (may contain null bytes)
   */
  mapChainIdentifier(bytes32Chain: string): CircleBlockchainId {
    const chainName = bytes32Chain.replace(/\0/g, "").toUpperCase().trim();
    const mapped = CHAIN_MAP[chainName];
    if (!mapped) {
      logger.warn(
        `Unknown chain identifier "${chainName}", defaulting to ARC-TESTNET`,
        { chainName }
      );
      return "ARC-TESTNET";
    }

    return mapped;
  }

  /**
   * Returns the Circle CCTP domain ID for a chain.
   * Required when building Gateway cross-chain transfer requests.
   * Sourced from arc-multichain-wallet/lib/circle/gateway-sdk.ts DOMAIN_IDS.
   */
  getDomainId(chain: CircleBlockchainId): number {
    return CIRCLE_DOMAIN_IDS[chain];
  }

  /**
   * Returns the auth header value for Circle API requests.
   * Used by the production implementation; exposed here for transparency.
   */
  getAuthHeader(): string {
    return `Bearer ${this.apiKey}`;
  }
}

export const circleClient = new CircleClient();
