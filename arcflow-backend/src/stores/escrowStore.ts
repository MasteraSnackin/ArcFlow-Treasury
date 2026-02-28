import { logger } from "../config/logger";

export type EscrowStatusValue = "OPEN" | "DISPUTED" | "RELEASED" | "REFUNDED";

export interface EscrowRecord {
  id: string;
  payer: string;
  payee: string;
  /** Token contract address (hex). */
  token: string;
  /** Human-readable amount string, e.g. "500.000000". */
  amount: string;
  /** Unix timestamp (seconds). */
  expiry: number;
  arbitrator: string;
  status: EscrowStatusValue;
  updatedAt: Date;
}

/**
 * In-memory index of on-chain escrow state, keyed by escrow ID string.
 *
 * Updated by EscrowStreamWorker as EscrowCreated / EscrowDisputed /
 * EscrowResolved / EscrowReleased / EscrowRefunded events arrive.
 * GET /escrows/:id reads from this store first, then falls back to a
 * direct contract call if the ID has not yet been indexed.
 */
export class EscrowStore {
  private readonly store = new Map<string, EscrowRecord>();

  set(id: string, record: EscrowRecord): void {
    this.store.set(id, record);
    logger.debug("EscrowStore: upserted", { id, status: record.status });
  }

  get(id: string): EscrowRecord | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  /** Update only the status field of an existing record. No-op if not found. */
  setStatus(id: string, status: EscrowStatusValue): boolean {
    const record = this.store.get(id);
    if (!record) return false;
    record.status = status;
    record.updatedAt = new Date();
    return true;
  }

  size(): number {
    return this.store.size;
  }
}
