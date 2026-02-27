import express, { Request, Response } from "express";
import { PayoutWorker } from "./workers/payoutWorker";
import { logger } from "./config/logger";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize worker (in production, this would be a separate process)
let worker: PayoutWorker | null = null;

/**
 * Health check endpoint
 */
app.get("/status", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "arcflow-backend",
  });
});

/**
 * Get payout status for a specific batch
 * GET /payouts/:batchId/status
 */
app.get("/payouts/:batchId/status", (req: Request, res: Response) => {
  const { batchId } = req.params;

  if (!worker) {
    return res.status(503).json({
      error: "Worker not initialized",
    });
  }

  try {
    const payouts = worker.getBatchPayouts(batchId);

    if (payouts.length === 0) {
      return res.status(404).json({
        error: "Batch not found",
        batchId,
      });
    }

    // Calculate totals
    const totalAmount = payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const completedCount = payouts.filter((p) => p.status === "COMPLETED").length;
    const failedCount = payouts.filter((p) => p.status === "FAILED").length;

    res.json({
      batchId,
      totalPayouts: payouts.length,
      totalAmount: totalAmount.toFixed(6),
      ready: payouts.length > 0, // Simple rule: batch is ready if it has payouts
      summary: {
        queued: payouts.filter((p) => p.status === "QUEUED").length,
        processing: payouts.filter((p) => p.status === "PROCESSING").length,
        completed: completedCount,
        failed: failedCount,
      },
      payouts: payouts.map((p) => ({
        index: p.index,
        recipient: p.recipient,
        amount: p.amount,
        destinationChain: p.destinationChain,
        status: p.status,
        circleTransferId: p.circleTransferId,
        error: p.error,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    logger.error("Error fetching batch status", { error, batchId });
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get status of a single payout
 * GET /payouts/:batchId/:index/status
 */
app.get("/payouts/:batchId/:index/status", (req: Request, res: Response) => {
  const { batchId, index } = req.params;

  if (!worker) {
    return res.status(503).json({
      error: "Worker not initialized",
    });
  }

  try {
    const payout = worker.getPayoutStatus(batchId, parseInt(index));

    if (!payout) {
      return res.status(404).json({
        error: "Payout not found",
        batchId,
        index: parseInt(index),
      });
    }

    res.json(payout);
  } catch (error) {
    logger.error("Error fetching payout status", { error, batchId, index });
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Initialize and start worker
    worker = new PayoutWorker();
    await worker.start();

    // Start Express server
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/status`);
      logger.info(`Batch status: http://localhost:${port}/payouts/:batchId/status`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

// Start if running directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
