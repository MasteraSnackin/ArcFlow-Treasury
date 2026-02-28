/**
 * Benchmark & correctness tests for the single-pass batch summary (QW-1).
 *
 * Three goals:
 *  1. Prove that amountToMicro + formatMicro are exact for 6-decimal amounts.
 *  2. Show a concrete case where the old parseFloat reduce produces a subtly
 *     different intermediate value (even if toFixed(6) often rescues it).
 *  3. Measure the wall-clock speedup of 1 pass vs 5 passes for large N.
 */
import { describe, it, expect } from "vitest";
import { amountToMicro, formatMicro, computeBatchSummary } from "../src/server";
import { PayoutStatus } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayouts(
  amounts: string[],
  status: PayoutStatus["status"] = "QUEUED"
): PayoutStatus[] {
  return amounts.map((amount, i) => ({
    batchId: "test",
    index: i,
    recipient: `0x${i.toString(16).padStart(40, "0")}`,
    amount,
    destinationChain: "ARC-TESTNET",
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

// ---------------------------------------------------------------------------
// amountToMicro — exact parsing
// ---------------------------------------------------------------------------

describe("amountToMicro", () => {
  it("parses whole number with trailing .0 (ethers default)", () => {
    expect(amountToMicro("1.0")).toBe(1_000_000n);
  });

  it("parses 6-decimal fractional amount", () => {
    expect(amountToMicro("0.123456")).toBe(123_456n);
  });

  it("parses large amount", () => {
    expect(amountToMicro("1000000.0")).toBe(1_000_000_000_000n);
  });

  it("parses amount with fewer than 6 fractional digits", () => {
    // ethers may return "1.5" for 1_500_000 micro-USDC
    expect(amountToMicro("1.5")).toBe(1_500_000n);
  });

  it("parses amount with exactly 6 fractional digits", () => {
    expect(amountToMicro("100.123456")).toBe(100_123_456n);
  });

  it("parses zero", () => {
    expect(amountToMicro("0.0")).toBe(0n);
    expect(amountToMicro("0.000000")).toBe(0n);
  });

  it("parses 1 micro-USDC (minimum non-zero)", () => {
    expect(amountToMicro("0.000001")).toBe(1n);
  });
});

// ---------------------------------------------------------------------------
// formatMicro — exact formatting (inverse of amountToMicro)
// ---------------------------------------------------------------------------

describe("formatMicro", () => {
  it("formats 1 USDC", () => {
    expect(formatMicro(1_000_000n)).toBe("1.000000");
  });

  it("formats 0.000001 (1 micro-USDC)", () => {
    expect(formatMicro(1n)).toBe("0.000001");
  });

  it("formats a large amount", () => {
    expect(formatMicro(1_000_000_000_000n)).toBe("1000000.000000");
  });

  it("round-trips: amountToMicro → formatMicro", () => {
    const cases = ["100.5", "0.123456", "1.0", "999999.999999", "0.000001"];
    for (const s of cases) {
      const micro = amountToMicro(s);
      const back  = formatMicro(micro);
      // Both should represent the same value to 6 decimal places.
      expect(parseFloat(back)).toBeCloseTo(parseFloat(s), 6);
      // And the integer micro-unit must be exactly preserved.
      expect(amountToMicro(back)).toBe(micro);
    }
  });
});

// ---------------------------------------------------------------------------
// Floating-point divergence demonstration
// ---------------------------------------------------------------------------

describe("parseFloat vs BigInt arithmetic — correctness", () => {
  /**
   * The specific case where accumulated parseFloat error becomes observable:
   * 10 amounts of "0.100000" each.
   *
   * 0.1 is NOT exactly representable in IEEE 754 binary64.
   * parseFloat("0.100000") = 0.1000000000000000055511151231257827021181583404541015625
   * Sum of 10:              = 0.9999999999999999 (one ULP below 1.0 in doubles)
   * toFixed(6):             = "1.000000"  — COINCIDENTALLY correct due to rounding
   *
   * The test below verifies our integer approach always gives the analytically
   * correct answer, regardless of lucky toFixed rounding.
   */
  it("10 × '0.100000' sums to exactly 1.000000 via BigInt", () => {
    const amounts = Array(10).fill("0.100000");
    const total   = amounts.reduce((s, a) => s + amountToMicro(a), 0n);
    expect(total).toBe(1_000_000n);
    expect(formatMicro(total)).toBe("1.000000");
  });

  it("demonstrates parseFloat sum for 10 × 0.1 is NOT 1.0 internally", () => {
    // The raw float sum is slightly off — it only appears correct after toFixed.
    const floatSum = Array(10).fill(0).reduce((s) => s + 0.1, 0);
    // In IEEE 754 this is 0.9999999999999999 (< 1.0), NOT exactly 1.0.
    expect(floatSum).not.toBe(1.0);
    // But toFixed(6) makes it look correct — masking the imprecision.
    expect(floatSum.toFixed(6)).toBe("1.000000");
  });

  it("amounts that sum to a non-round total are exact with BigInt", () => {
    // 3 × "0.333333" + 1 × "0.000001" = "1.000000"
    const amounts = ["0.333333", "0.333333", "0.333333", "0.000001"];
    const total   = amounts.reduce((s, a) => s + amountToMicro(a), 0n);
    expect(total).toBe(1_000_000n);
    expect(formatMicro(total)).toBe("1.000000");
  });
});

// ---------------------------------------------------------------------------
// computeBatchSummary — correctness
// ---------------------------------------------------------------------------

describe("computeBatchSummary", () => {
  it("counts statuses correctly in a mixed batch", () => {
    const payouts = [
      ...makePayouts(["1.0", "2.0"], "QUEUED"),
      ...makePayouts(["3.0"], "PROCESSING"),
      ...makePayouts(["4.0", "5.0"], "COMPLETED"),
      ...makePayouts(["6.0"], "FAILED"),
    ];

    const { totalMicro, queued, processing, completed, failed } =
      computeBatchSummary(payouts);

    expect(queued).toBe(2);
    expect(processing).toBe(1);
    expect(completed).toBe(2);
    expect(failed).toBe(1);
    // Total: 1+2+3+4+5+6 = 21.000000
    expect(formatMicro(totalMicro)).toBe("21.000000");
  });

  it("handles an empty batch", () => {
    const { totalMicro, queued, processing, completed, failed } =
      computeBatchSummary([]);
    expect(totalMicro).toBe(0n);
    expect(queued + processing + completed + failed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Performance benchmark: 1 pass vs 5 passes for N = 5 000 payouts
// ---------------------------------------------------------------------------

/**
 * RESEARCH FINDING (Researcher QW-1):
 *
 * Initial hypothesis: single-pass BigInt arithmetic would be ~5× faster than
 * 5 separate float filter/reduce passes.
 *
 * Benchmark result: HYPOTHESIS REJECTED.
 * - Per-element BigInt string-parsing (BigInt("123456")) is expensive.
 * - V8 aggressively JIT-optimises float reduce/filter on dense arrays.
 * - For N = 5 000, the naive BigInt-per-element loop was ~1.6× SLOWER.
 *
 * Revised implementation (see computeBatchSummary):
 * - Sum as Number integers using Math.round(parseFloat × 10⁶) — no BigInt alloc.
 * - Single BigInt(totalInt) at the end.
 * - Result: ~2–4× faster than 5-pass float, AND provably exact for totals < 9×10⁹ USDC.
 *
 * This test measures and documents the actual before/after — no assertion on
 * speedup magnitude to avoid environment-sensitive CI flakiness.
 */
describe("single-pass performance benchmark", () => {
  const N = 5_000;
  const payouts: PayoutStatus[] = Array.from({ length: N }, (_, i) => ({
    batchId: "bench",
    index: i,
    recipient: `0x${i.toString(16).padStart(40, "0")}`,
    amount: (((i % 100) + 1) * 0.01).toFixed(6), // varied amounts 0.01–1.00
    destinationChain: "ARC-TESTNET",
    status: (["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] as const)[i % 4],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  it("measures single-pass vs 5-pass timing (informational — no speedup assertion)", () => {
    const RUNS = 200;

    // ── Old approach: 5 separate passes, float arithmetic ────────────────
    const t0 = performance.now();
    for (let r = 0; r < RUNS; r++) {
      const _total      = payouts.reduce((s, p) => s + parseFloat(p.amount), 0);
      const _completed  = payouts.filter((p) => p.status === "COMPLETED").length;
      const _failed     = payouts.filter((p) => p.status === "FAILED").length;
      const _queued     = payouts.filter((p) => p.status === "QUEUED").length;
      const _processing = payouts.filter((p) => p.status === "PROCESSING").length;
      void (_total + _completed + _failed + _queued + _processing);
    }
    const oldMs = performance.now() - t0;

    // ── New approach: single pass, Number-integer sum, one BigInt at end ──
    const t1 = performance.now();
    for (let r = 0; r < RUNS; r++) {
      const result = computeBatchSummary(payouts);
      void result;
    }
    const newMs = performance.now() - t1;

    const ratio = oldMs / newMs;
    console.log(
      [
        `Benchmark N=${N} × ${RUNS} runs`,
        `  old (5-pass float):  ${oldMs.toFixed(1)} ms`,
        `  new (1-pass int):    ${newMs.toFixed(1)} ms`,
        `  ratio: ${ratio.toFixed(2)}× (>1 = new wins, <1 = old wins)`,
      ].join("\n")
    );

    // The new implementation must produce a sane result (not a timing assertion).
    const { totalMicro } = computeBatchSummary(payouts);
    expect(totalMicro).toBeGreaterThan(0n);
  });
});
