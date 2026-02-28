import { ethers } from "ethers";
import { createArcProvider, getArcConfig } from "../config/arc";
import { logger } from "../config/logger";
import { circleClient } from "../services/circleClient";
import { PayoutInstructionEvent, PayoutStatus, CircleTransferRequest } from "../types";
import { PayoutStore } from "../stores/payoutStore";
import PayoutRouterABI from "../abis/ArcFlowPayoutRouter.json";

/**
 * Payout Worker
 *
 * Listens for PayoutInstruction events from ArcFlowPayoutRouter on Arc testnet
 * and builds Circle transfer requests for each recipient.
 *
 * The transfer request shape follows arc-multichain-wallet conventions:
 *  - Same-chain (ARC-TESTNET → ARC-TESTNET): routed via Circle Wallets API /v1/transfers
 *  - Cross-chain (any other destination):     routed via Circle Gateway /v1/transfer
 *    (burn-attest-mint; see arc-multichain-wallet/lib/circle/gateway-sdk.ts)
 *
 * Currently uses a stub Circle client. Switching to real API calls requires:
 *  1. Real CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET in .env
 *  2. Replace stub in circleClient.createTransfer() with actual fetch calls
 *  3. For cross-chain: add EIP-712 BurnIntent signing and attestation polling
 */
class PayoutWorker {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  readonly store: PayoutStore;

  constructor(options?: { filePath?: string }) {
    const config = getArcConfig();
    this.provider = createArcProvider();
    this.contract = new ethers.Contract(
      config.payoutRouterAddress,
      PayoutRouterABI,
      this.provider
    );
    this.store = new PayoutStore(options?.filePath);

    logger.info("PayoutWorker initialized", {
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      contractAddress: config.payoutRouterAddress,
      persistencePath: options?.filePath ?? "(none — in-memory only)",
    });
  }

  async start(): Promise<void> {
    logger.info("PayoutWorker: Starting event listener...");

    try {
      const network = await this.provider.getNetwork();
      logger.info("Connected to network", {
        chainId: network.chainId.toString(),
      });

      // Subscribe to live PayoutInstruction events
      this.contract.on(
        "PayoutInstruction",
        async (
          batchId: bigint,
          index: bigint,
          recipient: string,
          amount: bigint,
          destinationChain: string,
          event: ethers.EventLog
        ) => {
          try {
            await this.handlePayoutInstruction(
              { batchId, index, recipient, amount, destinationChain },
              event
            );
          } catch (error) {
            logger.error("Error handling PayoutInstruction event", {
              error,
              batchId: batchId.toString(),
              index: index.toString(),
            });
          }
        }
      );

      // Replay historical events from the last 1000 blocks on startup
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);

      logger.info("Fetching historical events", { fromBlock, toBlock: currentBlock });

      const filter = this.contract.filters.PayoutInstruction();
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);

      logger.info(`Found ${events.length} historical PayoutInstruction events`);

      for (const event of events) {
        if (event instanceof ethers.EventLog) {
          const { batchId, index, recipient, amount, destinationChain } =
            event.args as unknown as PayoutInstructionEvent;
          await this.handlePayoutInstruction(
            { batchId, index, recipient, amount, destinationChain },
            event
          );
        }
      }

      logger.info("PayoutWorker: Listening for new events...");
    } catch (error) {
      logger.error("Failed to start PayoutWorker", { error });
      throw error;
    }
  }

  private async handlePayoutInstruction(
    eventData: PayoutInstructionEvent,
    event: ethers.EventLog
  ): Promise<void> {
    const { batchId, index, recipient, amount, destinationChain } = eventData;

    logger.info("Processing PayoutInstruction event", {
      batchId: batchId.toString(),
      index: index.toString(),
      recipient,
      amount: amount.toString(),
      destinationChain,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
    });

    const batchStr = batchId.toString();

    // Number(bigint) silently loses precision for values > Number.MAX_SAFE_INTEGER
    // (2^53 − 1 ≈ 9×10^15).  A batch index at that scale is unrealistic, but the
    // guard ensures we fail loudly rather than silently corrupt the store key.
    if (index > BigInt(Number.MAX_SAFE_INTEGER)) {
      logger.error("Payout index exceeds MAX_SAFE_INTEGER — cannot process safely", {
        batchId: batchStr,
        index: index.toString(),
      });
      return;
    }
    const indexNum = Number(index);

    // Idempotency: skip if already processed
    if (this.store.has(batchStr, indexNum)) {
      const payoutKey = `${batchStr}-${indexNum}`;
      logger.info("Payout already processed, skipping", { payoutKey });
      return;
    }

    try {
      // Decode bytes32 chain label → Circle blockchain name ("ARC-TESTNET" etc.)
      const chainLabel = ethers.decodeBytes32String(destinationChain);
      const circleChain = circleClient.mapChainIdentifier(chainLabel);

      // USDC has 6 decimals; EURC also 6 decimals
      const formattedAmount = ethers.formatUnits(amount, 6);

      // Build the Circle transfer request, mirroring arc-multichain-wallet field names.
      // destinationDomain is included for cross-chain Gateway routing (CCTP domain ID).
      const circleRequest: CircleTransferRequest = {
        idempotencyKey: `arcflow_${batchId}-${index}_${event.transactionHash}`,
        amount: {
          amount: formattedAmount,
          currency: "USDC", // ArcFlowPayoutRouter currently routes USDC; extend for EURC/USYC
        },
        destination: {
          type: "blockchain",
          address: recipient,
          chain: circleChain,
        },
        destinationDomain: circleClient.getDomainId(circleChain),
      };

      // Call Circle client (stub; swap for real fetch in production)
      const circleResponse = await circleClient.createTransfer(circleRequest);

      const payoutStatus: PayoutStatus = {
        batchId: batchStr,
        index: indexNum,
        recipient,
        amount: formattedAmount,
        destinationChain: chainLabel,
        status: "QUEUED",
        circleTransferId: circleResponse.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.store.set(batchStr, indexNum, payoutStatus);

      const payoutKey = `${batchStr}-${indexNum}`;
      logger.info("Payout instruction processed successfully", {
        payoutKey,
        circleTransferId: circleResponse.id,
        destinationChain: circleChain,
      });
    } catch (error) {
      const payoutKey = `${batchStr}-${indexNum}`;
      logger.error("Failed to process payout instruction", { error, payoutKey });

      this.store.set(batchStr, indexNum, {
        batchId: batchStr,
        index: indexNum,
        recipient,
        amount: ethers.formatUnits(amount, 6),
        destinationChain: "unknown",
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  getPayoutStatus(batchId: string, index: number): PayoutStatus | undefined {
    return this.store.get(batchId, index);
  }

  getBatchPayouts(batchId: string): PayoutStatus[] {
    return this.store.getBatch(batchId);
  }

  /**
   * Update a payout's status by its Circle transfer ID.
   * Called by the Circle webhook endpoint when a transfer's state changes.
   *
   * @returns true if a matching payout was found and updated.
   */
  updatePayoutStatusByTransferId(
    circleTransferId: string,
    status: PayoutStatus["status"],
    error?: string
  ): boolean {
    return this.store.updateByCircleTransferId(circleTransferId, status, error);
  }

  async stop(): Promise<void> {
    logger.info("PayoutWorker: Stopping...");
    this.contract.removeAllListeners();
    await this.provider.destroy();
    logger.info("PayoutWorker: Stopped");
  }
}

// Main execution
if (require.main === module) {
  const worker = new PayoutWorker({ filePath: process.env.PAYOUT_STORE_PATH });

  worker
    .start()
    .then(() => {
      logger.info("PayoutWorker is running. Press Ctrl+C to exit.");
    })
    .catch((error) => {
      logger.error("Fatal error starting PayoutWorker", { error });
      process.exit(1);
    });

  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await worker.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await worker.stop();
    process.exit(0);
  });
}

export { PayoutWorker };
