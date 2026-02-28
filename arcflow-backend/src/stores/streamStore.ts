import { logger } from "../config/logger";

export interface StreamRecord {
  id: string;
  employer: string;
  employee: string;
  /** Token contract address (hex). */
  token: string;
  /** Human-readable total amount, e.g. "10000.000000". */
  totalAmount: string;
  /** Unix timestamp (seconds). */
  start: number;
  /** Unix timestamp (seconds). */
  cliff: number;
  /** Unix timestamp (seconds). */
  end: number;
  /** Human-readable withdrawn amount. Updated on Withdrawn events. */
  withdrawn: string;
  /** Set to true once a Revoked event is received. */
  revoked: boolean;
  updatedAt: Date;
}

/**
 * In-memory index of on-chain stream state, keyed by stream ID string.
 *
 * Updated by EscrowStreamWorker as StreamCreated / Withdrawn / Revoked
 * events arrive. GET /streams/:id reads from this store first, then falls
 * back to a direct contract call if the ID has not yet been indexed.
 */
export class StreamStore {
  private readonly store = new Map<string, StreamRecord>();

  set(id: string, record: StreamRecord): void {
    this.store.set(id, record);
    logger.debug("StreamStore: upserted", { id, revoked: record.revoked });
  }

  get(id: string): StreamRecord | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  /** Add to the withdrawn amount. No-op if the record is not found. */
  addWithdrawn(id: string, delta: string): boolean {
    const record = this.store.get(id);
    if (!record) return false;
    // Exact 6-decimal integer arithmetic (avoid float accumulation error).
    const prev  = BigInt(Math.round(parseFloat(record.withdrawn)  * 1_000_000));
    const add   = BigInt(Math.round(parseFloat(delta)             * 1_000_000));
    const total = prev + add;
    const whole = total / 1_000_000n;
    const frac  = (total % 1_000_000n).toString().padStart(6, "0");
    record.withdrawn  = `${whole}.${frac}`;
    record.updatedAt  = new Date();
    return true;
  }

  /** Mark a stream as revoked. No-op if the record is not found. */
  markRevoked(id: string): boolean {
    const record = this.store.get(id);
    if (!record) return false;
    record.revoked    = true;
    record.updatedAt  = new Date();
    return true;
  }

  size(): number {
    return this.store.size;
  }
}
