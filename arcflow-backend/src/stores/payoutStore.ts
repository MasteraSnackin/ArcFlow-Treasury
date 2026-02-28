import { PayoutStatus } from "../types";
import { logger } from "../config/logger";

/**
 * PayoutStore
 *
 * In-memory store for payout statuses.
 *
 * Primary key:  `${batchId}-${index}`
 * Secondary indexes maintained for O(1) / O(k) access patterns:
 *   - batchIndex   Map<batchId, Set<key>>   — getBatch() is O(k) where k = batch size
 *   - transferIndex Map<circleTransferId, key> — updateByCircleTransferId() is O(1)
 *
 * Without the indexes both of those operations are O(n) across ALL stored payouts.
 *
 * Replace with a Redis or database adapter for production persistence.
 */
export class PayoutStore {
  private readonly payouts: Map<string, PayoutStatus> = new Map();
  /** batchId → set of composite keys belonging to that batch. */
  private readonly batchIndex: Map<string, Set<string>> = new Map();
  /** circleTransferId → composite key (one-to-one because IDs are unique). */
  private readonly transferIndex: Map<string, string> = new Map();

  private key(batchId: string, index: number): string {
    return `${batchId}-${index}`;
  }

  /** Store or overwrite a payout entry; keeps both secondary indexes consistent. */
  set(batchId: string, index: number, status: PayoutStatus): void {
    const k = this.key(batchId, index);

    // When overwriting, remove the stale transferIndex entry for the old transfer ID.
    const existing = this.payouts.get(k);
    if (existing?.circleTransferId) {
      this.transferIndex.delete(existing.circleTransferId);
    }

    this.payouts.set(k, status);

    // Batch index: group by batchId.
    let batchKeys = this.batchIndex.get(batchId);
    if (!batchKeys) {
      batchKeys = new Set();
      this.batchIndex.set(batchId, batchKeys);
    }
    batchKeys.add(k);

    // Transfer index: point circleTransferId → composite key.
    if (status.circleTransferId) {
      this.transferIndex.set(status.circleTransferId, k);
    }
  }

  /** Retrieve a single payout, or undefined if not found. */
  get(batchId: string, index: number): PayoutStatus | undefined {
    return this.payouts.get(this.key(batchId, index));
  }

  /** Check whether a payout entry already exists (used for idempotency). */
  has(batchId: string, index: number): boolean {
    return this.payouts.has(this.key(batchId, index));
  }

  /**
   * Return all payouts that belong to the given batch, sorted ascending by index.
   *
   * Sorting guarantees deterministic, specification-grade API output regardless
   * of the order in which events were processed (e.g. replays, retries, or
   * out-of-order block delivery).
   *
   * Complexity: O(k log k) where k = payouts in the batch.
   */
  getBatch(batchId: string): PayoutStatus[] {
    const keys = this.batchIndex.get(batchId);
    if (!keys) return [];
    const result: PayoutStatus[] = [];
    for (const k of keys) {
      const v = this.payouts.get(k);
      if (v) result.push(v);
    }
    return result.sort((a, b) => a.index - b.index);
  }

  /**
   * Update a payout's status by its Circle transfer ID.
   * O(1) via transferIndex (was O(n) linear scan).
   *
   * @returns true if a matching entry was found and updated; false otherwise.
   */
  updateByCircleTransferId(
    circleTransferId: string,
    status: PayoutStatus["status"],
    error?: string
  ): boolean {
    const k = this.transferIndex.get(circleTransferId);
    if (!k) {
      logger.warn("Circle transfer ID not found for webhook update", { circleTransferId });
      return false;
    }

    const existing = this.payouts.get(k);
    if (!existing) return false;

    this.payouts.set(k, { ...existing, status, error, updatedAt: new Date() });
    logger.info("Payout status updated via Circle webhook", {
      circleTransferId,
      status,
      payoutKey: k,
    });
    return true;
  }
}
