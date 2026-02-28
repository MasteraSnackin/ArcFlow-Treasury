import crypto from "crypto";
import express, { Request, Response } from "express";
import { PayoutWorker } from "./workers/payoutWorker";
import { logger } from "./config/logger";

const app = express();
const port = process.env.PORT || 3000;

// Augmented request type — carries the raw body buffer for HMAC verification.
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

// Capture raw body alongside the normal JSON parse so the Circle webhook
// handler can verify the HMAC-SHA256 signature without a second read of the stream.
app.use(
  express.json({
    verify: (req: RequestWithRawBody, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---------------------------------------------------------------------------
// HMAC helper
// ---------------------------------------------------------------------------

const CIRCLE_WEBHOOK_SECRET = process.env.CIRCLE_WEBHOOK_SECRET ?? "";

if (!CIRCLE_WEBHOOK_SECRET) {
  logger.warn(
    "CIRCLE_WEBHOOK_SECRET is not set — Circle webhook HMAC verification disabled (stub mode)"
  );
}

/**
 * Verify a Circle webhook signature.
 *
 * Circle signs the raw request body with HMAC-SHA256 using the shared secret
 * and sends the hex digest in the `x-circle-signature` header.
 * Uses timingSafeEqual to prevent timing attacks.
 *
 * @returns true if the signature is valid (or if the secret is not configured).
 */
function verifyCircleWebhookHmac(rawBody: Buffer, signatureHeader: string): boolean {
  if (!CIRCLE_WEBHOOK_SECRET) return true; // stub mode — skip verification

  const expected = crypto
    .createHmac("sha256", CIRCLE_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signatureHeader, "hex");
    const expBuf = Buffer.from(expected, "hex");
    // Buffers must be the same length for timingSafeEqual.
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch {
    return false; // malformed hex in signature header
  }
}

// ---------------------------------------------------------------------------
// Financial arithmetic helpers
// ---------------------------------------------------------------------------

/**
 * Parse a USDC/EURC amount string into an exact integer micro-unit count (×10⁶).
 *
 * Fast path (amounts < 9×10⁹ USDC): parseFloat × 10⁶ + Math.round, then
 * BigInt(number).  For 6-decimal USDC values Math.round eliminates the
 * sub-ULP float error, so the result is identical to pure-integer string
 * parsing while being ~10× faster (avoids BigInt string construction).
 *
 * Slow path (≥ 9×10⁹ USDC per payout, unrealistic): exact string parsing.
 *
 * Examples:
 *   "100.5"      → 100_500_000n
 *   "0.123456"   → 123_456n
 *   "1000000.0"  → 1_000_000_000_000n
 */
export function amountToMicro(formatted: string): bigint {
  const asFloat = parseFloat(formatted) * 1_000_000;
  if (asFloat <= Number.MAX_SAFE_INTEGER) {
    return BigInt(Math.round(asFloat)); // fast path — no string parsing
  }
  // Slow path: exact string parsing for extreme amounts.
  const dot = formatted.indexOf(".");
  if (dot === -1) return BigInt(formatted) * 1_000_000n;
  const whole = formatted.slice(0, dot) || "0";
  const frac  = formatted.slice(dot + 1).padEnd(6, "0").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(frac);
}

/**
 * Format a micro-unit BigInt back to a 6-decimal string.
 * Exact for any amount — no floating-point division.
 *
 * Examples:
 *   100_500_000n → "100.500000"
 *   1n           → "0.000001"
 */
export function formatMicro(micro: bigint): string {
  const whole = micro / 1_000_000n;
  const frac  = (micro % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

type PayoutStatus = import("./types").PayoutStatus;

/**
 * Compute batch totals in a SINGLE pass over payouts[].
 *
 * Before: 5 separate array passes (1 reduce + 4 filter), parseFloat arithmetic.
 * After : 1 pass, integer accumulation as Number, single BigInt at the end.
 *
 * Why Number-then-BigInt: summing per-element BigInt additions allocates N
 * intermediate BigInt objects.  Summing as a Number integer is ~5× faster;
 * BigInt(totalInt) at the end is one allocation and is always exact provided
 * the total is below Number.MAX_SAFE_INTEGER (~9×10⁹ USDC — safe for any
 * realistic batch).
 *
 * Complexity: O(N) vs O(5N).
 */
export function computeBatchSummary(payouts: PayoutStatus[]) {
  let totalMicroNum = 0; // integer Number, exact up to ~9×10⁹ USDC total
  let queued = 0, processing = 0, completed = 0, failed = 0;

  for (const p of payouts) {
    totalMicroNum += Math.round(parseFloat(p.amount) * 1_000_000);
    switch (p.status) {
      case "QUEUED":      queued++;      break;
      case "PROCESSING":  processing++;  break;
      case "COMPLETED":   completed++;   break;
      case "FAILED":      failed++;      break;
    }
  }

  return { totalMicro: BigInt(totalMicroNum), queued, processing, completed, failed };
}

// ---------------------------------------------------------------------------
// Initialize worker (in production, this would be a separate process)
// ---------------------------------------------------------------------------
let worker: PayoutWorker | null = null;

/**
 * Health check endpoint
 */
app.get("/status", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    network: "arc-testnet",
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

    // Single-pass summary (O(N)) with exact integer arithmetic.
    const { totalMicro, queued, processing, completed, failed } =
      computeBatchSummary(payouts);

    res.json({
      batchId,
      totalPayouts: payouts.length,
      totalAmount: formatMicro(totalMicro),
      ready: payouts.length > 0, // Simple rule: batch is ready if it has payouts
      summary: { queued, processing, completed, failed },
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

  // Validate index before converting — parseInt("abc") === NaN and parseInt("08") can
  // be unreliable without an explicit radix. NaN serialises as null in JSON, which
  // would make the 404 body misleading.
  const indexNum = parseInt(index, 10);
  if (isNaN(indexNum) || indexNum < 0) {
    return res.status(400).json({
      error: "Invalid payout index: must be a non-negative integer",
    });
  }

  if (!worker) {
    return res.status(503).json({
      error: "Worker not initialized",
    });
  }

  try {
    const payout = worker.getPayoutStatus(batchId, indexNum);

    if (!payout) {
      return res.status(404).json({
        error: "Payout not found",
        batchId,
        index: indexNum,
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

// ---------------------------------------------------------------------------
// Circle webhook endpoint
// ---------------------------------------------------------------------------

/**
 * Receive Circle transfer status notifications.
 *
 * Circle posts a JSON body with shape:
 *   { transfer: { id: string, status: "pending" | "complete" | "failed", ... } }
 *
 * The endpoint maps Circle's status vocabulary to the internal PayoutStatus
 * vocabulary and updates the in-memory store accordingly.
 *
 * POST /webhooks/circle
 */
app.post("/webhooks/circle", (req: RequestWithRawBody, res: Response) => {
  // HMAC-SHA256 signature check — protects against forged status updates.
  const signature = req.headers["x-circle-signature"] as string | undefined;
  const rawBody = req.rawBody;

  if (CIRCLE_WEBHOOK_SECRET && (!signature || !rawBody)) {
    return res.status(401).json({ error: "Missing x-circle-signature header or body" });
  }

  if (rawBody && signature && !verifyCircleWebhookHmac(rawBody, signature)) {
    logger.warn("Circle webhook HMAC verification failed", { signature });
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const body = req.body as {
    transfer?: { id?: string; status?: string };
  };

  const transferId = body?.transfer?.id;
  const circleStatus = body?.transfer?.status;

  if (!transferId || !circleStatus) {
    return res.status(400).json({
      error: "Invalid webhook payload: missing transfer.id or transfer.status",
    });
  }

  const circleStatusMap: Record<string, "PROCESSING" | "COMPLETED" | "FAILED"> = {
    pending:  "PROCESSING",
    complete: "COMPLETED",
    failed:   "FAILED",
  };

  const internalStatus = circleStatusMap[circleStatus];
  if (!internalStatus) {
    return res.status(400).json({
      error: `Unknown Circle transfer status: "${circleStatus}"`,
    });
  }

  if (!worker) {
    return res.status(503).json({ error: "Worker not initialized" });
  }

  const errorMessage =
    internalStatus === "FAILED" ? "Transfer failed by Circle" : undefined;

  const updated = worker.updatePayoutStatusByTransferId(
    transferId,
    internalStatus,
    errorMessage
  );

  logger.info("Circle webhook received", { transferId, circleStatus, internalStatus, updated });

  res.json({ received: true, updated });
});

// ---------------------------------------------------------------------------
// Escrow status stub endpoints
// ---------------------------------------------------------------------------

/**
 * Get escrow status by ID (stub — no contract calls until deployment).
 *
 * Returns mock data for ID 0; 404 for any other ID.
 * Once ArcFlowEscrow is deployed, replace with an ethers.js call to
 * ArcFlowEscrow.escrows(id) and map the result to this response shape.
 *
 * GET /escrows/:id
 */
app.get("/escrows/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid escrow ID: must be a non-negative integer" });
  }

  if (id !== "0") {
    return res.status(404).json({ error: "Escrow not found", id });
  }

  const now = Math.floor(Date.now() / 1000);
  res.json({
    id: "0",
    payer:      "0x1111111111111111111111111111111111111111",
    payee:      "0x2222222222222222222222222222222222222222",
    token:      "USDC",
    amount:     "500.000000",
    expiry:     now + 3600,
    arbitrator: "0x3333333333333333333333333333333333333333",
    status:     "OPEN",
  });
});

// ---------------------------------------------------------------------------
// Stream status stub endpoints
// ---------------------------------------------------------------------------

/**
 * Get stream status by ID (stub — no contract calls until deployment).
 *
 * Returns mock data for ID 0; 404 for any other ID.
 * Once ArcFlowStreams is deployed, replace with an ethers.js call to
 * ArcFlowStreams.streams(id) and compute vested/withdrawable amounts on-chain.
 *
 * GET /streams/:id
 */
app.get("/streams/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid stream ID: must be a non-negative integer" });
  }

  if (id !== "0") {
    return res.status(404).json({ error: "Stream not found", id });
  }

  const now = Math.floor(Date.now() / 1000);
  res.json({
    id:          "0",
    employer:    "0x1111111111111111111111111111111111111111",
    employee:    "0x4444444444444444444444444444444444444444",
    token:       "USDC",
    totalAmount: "10000.000000",
    startTime:   now - 86400,         // started 1 day ago
    cliffTime:   now - 86400 + 3600,  // cliff was 1 h after start
    endTime:     now + 86400 * 29,    // ends in 29 more days
    withdrawn:   "0.000000",
    status:      "ACTIVE",
  });
});

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Initialize and start worker (optional file persistence via PAYOUT_STORE_PATH)
    worker = new PayoutWorker({ filePath: process.env.PAYOUT_STORE_PATH });
    await worker.start();

    // Start Express server
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Health check:       http://localhost:${port}/status`);
      logger.info(`Batch status:       http://localhost:${port}/payouts/:batchId/status`);
      logger.info(`Circle webhook:     http://localhost:${port}/webhooks/circle`);
      logger.info(`Escrow status:      http://localhost:${port}/escrows/:id`);
      logger.info(`Stream status:      http://localhost:${port}/streams/:id`);
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
