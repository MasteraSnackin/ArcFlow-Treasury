import { describe, it, expect, beforeEach } from "vitest";
import { PayoutStore } from "../src/stores/payoutStore";
import { PayoutStatus } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<PayoutStatus> = {}): PayoutStatus {
  return {
    batchId: "1",
    index: 0,
    recipient: "0xRecipient",
    amount: "100.000000",
    destinationChain: "ARC-TESTNET",
    status: "QUEUED",
    circleTransferId: "circle_transfer_abc123",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PayoutStore", () => {
  let store: PayoutStore;

  beforeEach(() => {
    store = new PayoutStore();
  });

  // ── set / get ─────────────────────────────────────────────────────────────

  it("stores and retrieves a payout by batchId + index", () => {
    const status = makeStatus();
    store.set("1", 0, status);
    expect(store.get("1", 0)).toEqual(status);
  });

  it("returns undefined for an unknown key", () => {
    expect(store.get("99", 0)).toBeUndefined();
  });

  it("overwrites an existing entry on set()", () => {
    const first  = makeStatus({ status: "QUEUED" });
    const second = makeStatus({ status: "COMPLETED" });
    store.set("1", 0, first);
    store.set("1", 0, second);
    expect(store.get("1", 0)?.status).toBe("COMPLETED");
  });

  // ── has ───────────────────────────────────────────────────────────────────

  it("has() returns true after storing an entry", () => {
    store.set("1", 0, makeStatus());
    expect(store.has("1", 0)).toBe(true);
  });

  it("has() returns false for a missing entry", () => {
    expect(store.has("1", 0)).toBe(false);
  });

  // ── getBatch ──────────────────────────────────────────────────────────────

  it("getBatch() returns all payouts for a batch", () => {
    store.set("2", 0, makeStatus({ batchId: "2", index: 0 }));
    store.set("2", 1, makeStatus({ batchId: "2", index: 1 }));
    store.set("3", 0, makeStatus({ batchId: "3", index: 0 })); // different batch

    const batch2 = store.getBatch("2");
    expect(batch2).toHaveLength(2);
    expect(batch2.every((p) => p.batchId === "2")).toBe(true);
  });

  it("getBatch() returns an empty array for an unknown batchId", () => {
    expect(store.getBatch("999")).toHaveLength(0);
  });

  // ── updateByCircleTransferId ──────────────────────────────────────────────

  it("updates status to COMPLETED by transfer ID and returns true", () => {
    store.set("1", 0, makeStatus({ circleTransferId: "ct_abc" }));

    const updated = store.updateByCircleTransferId("ct_abc", "COMPLETED");

    expect(updated).toBe(true);
    expect(store.get("1", 0)?.status).toBe("COMPLETED");
  });

  it("updates status to FAILED with error message", () => {
    store.set("1", 0, makeStatus({ circleTransferId: "ct_xyz" }));

    store.updateByCircleTransferId("ct_xyz", "FAILED", "Transfer failed by Circle");

    const entry = store.get("1", 0);
    expect(entry?.status).toBe("FAILED");
    expect(entry?.error).toBe("Transfer failed by Circle");
  });

  it("updates status to PROCESSING", () => {
    store.set("1", 0, makeStatus({ circleTransferId: "ct_proc" }));
    store.updateByCircleTransferId("ct_proc", "PROCESSING");
    expect(store.get("1", 0)?.status).toBe("PROCESSING");
  });

  it("refreshes updatedAt on update", async () => {
    const originalDate = new Date("2026-01-01T00:00:00Z");
    store.set("1", 0, makeStatus({ circleTransferId: "ct_time", updatedAt: originalDate }));

    // Small delay so the new timestamp is strictly after originalDate
    await new Promise((r) => setTimeout(r, 5));

    store.updateByCircleTransferId("ct_time", "COMPLETED");

    const entry = store.get("1", 0);
    expect(entry?.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
  });

  it("returns false when transfer ID is not found", () => {
    const result = store.updateByCircleTransferId("nonexistent_transfer", "COMPLETED");
    expect(result).toBe(false);
  });

  it("does not modify other entries when updating by transfer ID", () => {
    store.set("1", 0, makeStatus({ circleTransferId: "ct_a", status: "QUEUED" }));
    store.set("1", 1, makeStatus({ circleTransferId: "ct_b", status: "QUEUED", index: 1 }));

    store.updateByCircleTransferId("ct_a", "COMPLETED");

    expect(store.get("1", 0)?.status).toBe("COMPLETED");
    expect(store.get("1", 1)?.status).toBe("QUEUED"); // unaffected
  });

  it("clears error field when status moves to PROCESSING (undefined error)", () => {
    store.set("1", 0, makeStatus({ circleTransferId: "ct_retry", status: "FAILED", error: "old error" }));

    store.updateByCircleTransferId("ct_retry", "PROCESSING", undefined);

    const entry = store.get("1", 0);
    expect(entry?.status).toBe("PROCESSING");
    expect(entry?.error).toBeUndefined();
  });

  // ── secondary-index correctness ───────────────────────────────────────────

  it("overwriting with a different circleTransferId invalidates the old transfer index entry", () => {
    // First write: transfer ID = ct_old
    store.set("1", 0, makeStatus({ circleTransferId: "ct_old" }));

    // Overwrite with a new transfer ID (e.g. retried via Circle)
    store.set("1", 0, makeStatus({ circleTransferId: "ct_new", status: "QUEUED" }));

    // Old transfer ID should no longer resolve
    expect(store.updateByCircleTransferId("ct_old", "COMPLETED")).toBe(false);

    // New transfer ID should resolve correctly
    expect(store.updateByCircleTransferId("ct_new", "COMPLETED")).toBe(true);
    expect(store.get("1", 0)?.status).toBe("COMPLETED");
  });

  it("getBatch() only returns entries for the requested batch, not cross-batch matches", () => {
    // batchId "10" has a key "10-0" which startsWith("1-") — a bug that the old
    // prefix-scan approach would have triggered if batchId "1" was also present.
    store.set("1",  0, makeStatus({ batchId: "1",  index: 0 }));
    store.set("10", 0, makeStatus({ batchId: "10", index: 0 }));
    store.set("10", 1, makeStatus({ batchId: "10", index: 1 }));

    expect(store.getBatch("1")).toHaveLength(1);
    expect(store.getBatch("10")).toHaveLength(2);
  });

  it("does not expose entries from other batches after getBatch()", () => {
    store.set("5", 0, makeStatus({ batchId: "5", index: 0 }));
    store.set("50", 0, makeStatus({ batchId: "50", index: 0 }));

    const result5 = store.getBatch("5");
    expect(result5.every((p) => p.batchId === "5")).toBe(true);
  });
});
