import { ethers } from "ethers";
import { createArcProvider, getArcConfig } from "../config/arc";
import { logger } from "../config/logger";
import { circleClient } from "../services/circleClient";
import { PayoutInstructionEvent, PayoutStatus, CircleTransferRequest } from "../types";
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
  private payoutStatuses: Map<string, PayoutStatus> = new Map();

  constructor() {
    const config = getArcConfig();
    this.provider = createArcProvider();
    this.contract = new ethers.Contract(
      config.payoutRouterAddress,
      PayoutRouterABI,
      this.provider
    );

    logger.info("PayoutWorker initialized", {
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      contractAddress: config.payoutRouterAddress,
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

    const payoutKey = `${batchId.toString()}-${index.toString()}`;

    // Idempotency: skip if already processed
    if (this.payoutStatuses.has(payoutKey)) {
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
        batchId: batchId.toString(),
        index: Number(index),
        recipient,
        amount: formattedAmount,
        destinationChain: chainLabel,
        status: "QUEUED",
        circleTransferId: circleResponse.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.payoutStatuses.set(payoutKey, payoutStatus);

      logger.info("Payout instruction processed successfully", {
        payoutKey,
        circleTransferId: circleResponse.id,
        destinationChain: circleChain,
      });
    } catch (error) {
      logger.error("Failed to process payout instruction", { error, payoutKey });

      this.payoutStatuses.set(payoutKey, {
        batchId: batchId.toString(),
        index: Number(index),
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
    return this.payoutStatuses.get(`${batchId}-${index}`);
  }

  getBatchPayouts(batchId: string): PayoutStatus[] {
    const payouts: PayoutStatus[] = [];
    for (const [key, status] of this.payoutStatuses.entries()) {
      if (key.startsWith(`${batchId}-`)) {
        payouts.push(status);
      }
    }
    return payouts;
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
  const worker = new PayoutWorker();

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
