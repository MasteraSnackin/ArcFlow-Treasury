import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

// ---------------------------------------------------------------------------
// File persistence — constructor(filePath?) feature
// ---------------------------------------------------------------------------

describe("PayoutStore — file persistence", () => {
  let tmpFile: string;

  beforeEach(() => {
    // Unique temp file per test so parallel runs don't collide.
    tmpFile = path.join(
      os.tmpdir(),
      `arcflow_payoutstore_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
    );
  });

  afterEach(() => {
    // Remove temp file even if the test failed.
    try { fs.unlinkSync(tmpFile); } catch { /* already absent — that's fine */ }
  });

  // Helper: wait long enough for the 200 ms debounce + async writeFile to land.
  const waitForSave = () => new Promise<void>((r) => setTimeout(r, 350));

  // ── startup behaviour ────────────────────────────────────────────────────

  it("starts empty when the file does not exist (ENOENT — first run)", () => {
    // tmpFile hasn't been created yet — constructor must not throw.
    const store = new PayoutStore(tmpFile);
    expect(store.getBatch("1")).toHaveLength(0);
    expect(store.get("1", 0)).toBeUndefined();
    expect(store.has("1", 0)).toBe(false);
  });

  // ── round-trip persistence ───────────────────────────────────────────────

  it("persists a payout to disk and reloads it in a new store instance", async () => {
    const store = new PayoutStore(tmpFile);
    store.set("1", 0, makeStatus());

    await waitForSave();

    // New store loading from the same file must have the data.
    const store2 = new PayoutStore(tmpFile);
    expect(store2.has("1", 0)).toBe(true);
    expect(store2.get("1", 0)?.status).toBe("QUEUED");
    expect(store2.get("1", 0)?.recipient).toBe("0xRecipient");
  });

  it("deserializes createdAt and updatedAt as Date objects after reload", async () => {
    const iso = "2026-01-15T12:00:00.000Z";
    const store = new PayoutStore(tmpFile);
    store.set("1", 0, makeStatus({
      createdAt: new Date(iso),
      updatedAt: new Date(iso),
    }));

    await waitForSave();

    const store2 = new PayoutStore(tmpFile);
    const loaded = store2.get("1", 0)!;
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded.updatedAt).toBeInstanceOf(Date);
    expect(loaded.createdAt.toISOString()).toBe(iso);
    expect(loaded.updatedAt.toISOString()).toBe(iso);
  });

  // ── secondary-index rebuild on load ─────────────────────────────────────

  it("rebuilds batchIndex so getBatch() returns correct results after reload", async () => {
    const store = new PayoutStore(tmpFile);
    store.set("2", 0, makeStatus({ batchId: "2", index: 0 }));
    store.set("2", 1, makeStatus({ batchId: "2", index: 1 }));
    store.set("3", 0, makeStatus({ batchId: "3", index: 0 }));

    await waitForSave();

    const store2 = new PayoutStore(tmpFile);
    expect(store2.getBatch("2")).toHaveLength(2);
    expect(store2.getBatch("3")).toHaveLength(1);
    expect(store2.getBatch("99")).toHaveLength(0); // unknown batch → empty
  });

  it("rebuilds transferIndex so updateByCircleTransferId() works after reload", async () => {
    const store = new PayoutStore(tmpFile);
    store.set("1", 0, makeStatus({ circleTransferId: "ct_reload" }));

    await waitForSave();

    const store2 = new PayoutStore(tmpFile);
    const updated = store2.updateByCircleTransferId("ct_reload", "COMPLETED");
    expect(updated).toBe(true);
    expect(store2.get("1", 0)?.status).toBe("COMPLETED");
  });

  // ── persistence of status updates ───────────────────────────────────────

  it("persists status changes made via updateByCircleTransferId()", async () => {
    const store = new PayoutStore(tmpFile);
    store.set("1", 0, makeStatus({ circleTransferId: "ct_upd_persist" }));
    await waitForSave();

    store.updateByCircleTransferId("ct_upd_persist", "COMPLETED");
    await waitForSave();

    const store2 = new PayoutStore(tmpFile);
    expect(store2.get("1", 0)?.status).toBe("COMPLETED");
  });

  // ── debounce coalescing ──────────────────────────────────────────────────

  it("multiple rapid set() calls coalesce into a single file write with final state", async () => {
    const store = new PayoutStore(tmpFile);

    // 5 mutations fired within the same JS event-loop tick — all within the debounce window.
    for (let i = 0; i < 5; i++) {
      store.set("1", i, makeStatus({ batchId: "1", index: i, circleTransferId: `ct_${i}` }));
    }

    await waitForSave();

    const raw = fs.readFileSync(tmpFile, "utf-8");
    const entries = JSON.parse(raw) as [string, unknown][];

    // All 5 payouts must be present in the single written snapshot.
    expect(entries).toHaveLength(5);

    // Reloading reflects the final state correctly.
    const store2 = new PayoutStore(tmpFile);
    expect(store2.getBatch("1")).toHaveLength(5);
  });

  // ── no-filePath store does not write to disk ─────────────────────────────

  it("a store without a filePath never creates a file on set()", async () => {
    const store = new PayoutStore(); // no filePath
    store.set("1", 0, makeStatus());

    await waitForSave();

    // tmpFile was never used — it should not exist.
    expect(fs.existsSync(tmpFile)).toBe(false);
  });
});
