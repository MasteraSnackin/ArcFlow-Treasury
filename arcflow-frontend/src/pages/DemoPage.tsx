import { useState, useEffect } from "react";
import { Play, RotateCcw, Loader2 } from "lucide-react";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const ALICE   = "0xA1cE0000000000000000000000000000DeaDBEEF";
const BOB     = "0xB0B00000000000000000000000000000DeaDBEEF";
const CAROL   = "0xCA7010000000000000000000000000000000BEEF";
const ARBITER = "0xAb17e000000000000000000000000000000000AB";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ts(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

type Log = { ts: string; msg: string };

function LogPanel({ log }: { log: Log[] }) {
  if (log.length === 0) return null;
  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          marginBottom: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Transaction Log
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {log.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.25)",
                flexShrink: 0,
                minWidth: 70,
              }}
            >
              {e.ts}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              {e.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ESCROW TAB ────────────────────────────────────────────────────────────────

type EscrowState =
  | "idle"
  | "approving"
  | "creating"
  | "open"
  | "disputing"
  | "disputed"
  | "resolving"
  | "releasing"
  | "done_payee"
  | "done_payer"
  | "released";

function EscrowDemo() {
  const [state, setState] = useState<EscrowState>("idle");
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  function addLog(msg: string) {
    setLog((p) => [...p, { ts: ts(), msg }]);
  }

  function reset() {
    setState("idle");
    setLog([]);
    setBusy(null);
  }

  async function createEscrow() {
    setBusy("create");
    setState("approving");
    addLog("Approving USDC spend for ArcFlowEscrow…");
    await delay(1500);
    addLog("✓ ERC-20 approval confirmed (5,000 USDC)");
    setState("creating");
    addLog("Sending createEscrow transaction…");
    await delay(2000);
    addLog("✓ Escrow #42 created — 5,000 USDC locked on Arc Testnet");
    setState("open");
    setBusy(null);
  }

  async function raiseDispute() {
    setBusy("dispute");
    setState("disputing");
    addLog("Sending raiseDispute transaction…");
    await delay(1500);
    addLog("✓ Dispute raised — Arbitrator notified");
    setState("disputed");
    setBusy(null);
  }

  async function autoRelease() {
    setBusy("release");
    setState("releasing");
    addLog("Sending autoRelease transaction (expiry window passed)…");
    await delay(1500);
    addLog("✓ Escrow #42 auto-released → 5,000 USDC sent to Payee");
    setState("released");
    setBusy(null);
  }

  async function resolve(toPayee: boolean) {
    const key = toPayee ? "payee" : "payer";
    setBusy(key);
    setState("resolving");
    addLog(
      `Arbitrator resolving dispute → ${toPayee ? "Pay Payee" : "Refund Payer"}…`
    );
    await delay(1500);
    if (toPayee) {
      addLog(`✓ Dispute resolved — 5,000 USDC released to Payee (${short(BOB)})`);
      setState("done_payee");
    } else {
      addLog(
        `✓ Dispute resolved — 5,000 USDC refunded to Payer (${short(ALICE)})`
      );
      setState("done_payer");
    }
    setBusy(null);
  }

  const progressMap: Record<EscrowState, number> = {
    idle: 0,
    approving: 15,
    creating: 25,
    open: 38,
    disputing: 58,
    disputed: 65,
    resolving: 85,
    releasing: 85,
    done_payee: 100,
    done_payer: 100,
    released: 100,
  };

  const badgeMap: Record<EscrowState, string> = {
    idle: "",
    approving: "badge-queued",
    creating: "badge-queued",
    open: "badge-open",
    disputing: "badge-disputed",
    disputed: "badge-disputed",
    resolving: "badge-processing",
    releasing: "badge-processing",
    done_payee: "badge-released",
    done_payer: "badge-refunded",
    released: "badge-released",
  };

  const labelMap: Record<EscrowState, string> = {
    idle: "",
    approving: "APPROVING",
    creating: "CREATING",
    open: "OPEN",
    disputing: "DISPUTING",
    disputed: "DISPUTED",
    resolving: "RESOLVING",
    releasing: "RELEASING",
    done_payee: "RELEASED",
    done_payer: "REFUNDED",
    released: "RELEASED",
  };

  const isIdle = state === "idle";
  const isOpen = state === "open";
  const isDisputed = state === "disputed";
  const isDone =
    state === "done_payee" || state === "done_payer" || state === "released";
  const isBusy = busy !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Scenario card */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 4 }}
            >
              Escrow #42
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Demo · Arc Testnet · USDC
            </div>
          </div>
          {!isIdle && (
            <span className={badgeMap[state]}>{labelMap[state]}</span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "14px 24px",
          }}
        >
          {(
            [
              ["Payer", `${short(ALICE)} (You)`],
              ["Payee", short(BOB)],
              ["Arbitrator", short(ARBITER)],
              ["Token", "USDC"],
              ["Amount", "5,000 USDC"],
              ["Expiry", "72 h from now"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: value.includes("…") ? "monospace" : "inherit",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {!isIdle && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressMap[state]}%`,
                  background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: 10,
                color: "rgba(255,255,255,0.2)",
              }}
            >
              <span>Created</span>
              <span>Open</span>
              <span>Disputed</span>
              <span>Resolved</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        {isIdle && (
          <button
            className="btn-primary"
            onClick={createEscrow}
            disabled={isBusy}
          >
            {busy === "create" ? (
              <Loader2
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Play size={14} />
            )}
            Create Escrow
          </button>
        )}

        {isOpen && (
          <>
            <button
              className="btn-secondary"
              onClick={raiseDispute}
              disabled={isBusy}
            >
              {busy === "dispute" && (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              )}
              Raise Dispute
            </button>
            <button
              className="btn-secondary"
              onClick={autoRelease}
              disabled={isBusy}
            >
              {busy === "release" && (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              )}
              Auto-Release
            </button>
          </>
        )}

        {isDisputed && (
          <>
            <button
              className="btn-primary"
              onClick={() => resolve(true)}
              disabled={isBusy}
            >
              {busy === "payee" && (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              )}
              Resolve → Pay Payee
            </button>
            <button
              className="btn-danger"
              onClick={() => resolve(false)}
              disabled={isBusy}
            >
              {busy === "payer" && (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              )}
              Resolve → Refund Payer
            </button>
          </>
        )}

        {isDone && (
          <div
            style={{
              fontSize: 13,
              color: state === "done_payer" ? "#9ca3af" : "#34d399",
              fontWeight: 500,
            }}
          >
            {state === "done_payee" || state === "released"
              ? "✓ Payee received 5,000 USDC"
              : "✓ Payer refunded 5,000 USDC"}
          </div>
        )}

        {!isIdle && (
          <button
            className="btn-secondary"
            onClick={reset}
            disabled={isBusy}
            style={{ marginLeft: "auto" }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <LogPanel log={log} />

      {isIdle && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}
        >
          Click{" "}
          <strong style={{ color: "rgba(255,255,255,0.5)" }}>
            Create Escrow
          </strong>{" "}
          to walk through the lifecycle
        </div>
      )}
    </div>
  );
}

// ─── PAYROLL TAB ───────────────────────────────────────────────────────────────

const DEMO_DURATION = 12;
const CLIFF_SECS = 3;
const TOTAL_USDC = 12000;

type StreamState = "idle" | "approving" | "creating" | "streaming" | "revoked" | "complete";

function PayrollDemo() {
  const [state, setState] = useState<StreamState>("idle");
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [withdrawnUSDC, setWithdrawnUSDC] = useState(0);

  // Tick interval — managed by useEffect keyed on streaming state
  useEffect(() => {
    if (state !== "streaming") return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const next = parseFloat((prev + 0.5).toFixed(1));
        return Math.min(next, DEMO_DURATION);
      });
    }, 500);
    return () => clearInterval(id);
  }, [state]);

  // Completion detection
  useEffect(() => {
    if (state === "streaming" && elapsed >= DEMO_DURATION) {
      setState("complete");
      setLog((p) => [
        ...p,
        {
          ts: ts(),
          msg: "✓ Stream #7 fully vested — 12,000 USDC available to withdraw",
        },
      ]);
    }
  }, [elapsed, state]);

  function addLog(msg: string) {
    setLog((p) => [...p, { ts: ts(), msg }]);
  }

  function reset() {
    setState("idle");
    setLog([]);
    setBusy(null);
    setElapsed(0);
    setWithdrawnUSDC(0);
  }

  // Derived values
  const vestedPct =
    elapsed >= CLIFF_SECS ? Math.min(elapsed / DEMO_DURATION, 1) : 0;
  const vestedUSDC = TOTAL_USDC * vestedPct;
  const withdrawable = Math.max(0, vestedUSDC - withdrawnUSDC);
  const cliffPct = (CLIFF_SECS / DEMO_DURATION) * 100;
  const withdrawnBarPct = (withdrawnUSDC / TOTAL_USDC) * 100;
  const vestedBarPct = (vestedUSDC / TOTAL_USDC) * 100;

  async function createStream() {
    setBusy("create");
    setState("approving");
    addLog("Approving USDC spend for ArcFlowStreams…");
    await delay(1500);
    addLog("✓ ERC-20 approval confirmed (12,000 USDC)");
    setState("creating");
    addLog("Sending createStream transaction…");
    await delay(2000);
    addLog("✓ Stream #7 created — cliff: 3 s, end: 12 s (demo speed)");
    setState("streaming");
    setBusy(null);
  }

  function withdraw() {
    if (withdrawable <= 0) return;
    const amount = withdrawable;
    setWithdrawnUSDC((prev) => prev + amount);
    addLog(`✓ Withdrew ${amount.toFixed(0)} USDC → ${short(BOB)}`);
  }

  async function revokeStream() {
    const snappedVested = vestedUSDC;
    setBusy("revoke");
    addLog("Employer sending revoke transaction…");
    await delay(1500);
    const sent = snappedVested.toFixed(0);
    const refunded = (TOTAL_USDC - snappedVested).toFixed(0);
    addLog(
      `✓ Stream #7 revoked — ${sent} USDC to Employee, ${refunded} USDC refunded to Employer`
    );
    setState("revoked");
    setBusy(null);
  }

  const isIdle = state === "idle";
  const isActive = state === "streaming" || state === "complete";
  const isBusy = busy !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stream card */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 4 }}
            >
              Stream #7
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Demo · 12,000 USDC · 12 seconds
            </div>
          </div>
          {state !== "idle" && (
            <span
              className={
                state === "streaming"
                  ? "badge-active"
                  : state === "complete"
                  ? "badge-done"
                  : state === "revoked"
                  ? "badge-refunded"
                  : "badge-queued"
              }
            >
              {state === "streaming"
                ? "STREAMING"
                : state === "complete"
                ? "COMPLETE"
                : state === "revoked"
                ? "REVOKED"
                : state.toUpperCase()}
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "14px 24px",
            marginBottom: isActive ? 24 : 0,
          }}
        >
          {(
            [
              ["Employer", `${short(ALICE)} (You)`],
              ["Employee", short(BOB)],
              ["Token", "USDC"],
              ["Total", "12,000 USDC"],
              ["Cliff", "3 s (demo)"],
              ["Duration", "12 s (demo)"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: value.includes("…") ? "monospace" : "inherit",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Live vesting visualization */}
        {isActive && (
          <>
            {/* Progress bar */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}
              >
                {/* Withdrawn segment */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${withdrawnBarPct}%`,
                    background: "rgba(99,102,241,0.5)",
                    transition: "width 0.4s ease",
                  }}
                />
                {/* Vesting segment */}
                <div
                  style={{
                    position: "absolute",
                    left: `${withdrawnBarPct}%`,
                    top: 0,
                    height: "100%",
                    width: `${Math.max(0, vestedBarPct - withdrawnBarPct)}%`,
                    background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>

              {/* Cliff marker */}
              <div
                style={{
                  position: "absolute",
                  left: `${cliffPct}%`,
                  top: -8,
                  width: 2,
                  height: 24,
                  background: "#fbbf24",
                  borderRadius: 1,
                  transform: "translateX(-50%)",
                }}
              />
            </div>

            {/* Cliff label */}
            <div
              style={{ position: "relative", height: 20, marginTop: 4, marginBottom: 4 }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${cliffPct}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10,
                  color: "#fbbf24",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                CLIFF
              </div>
            </div>

            {/* Live counters */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10,
                marginTop: 8,
              }}
            >
              {(
                [
                  ["Vested", `${vestedUSDC.toFixed(0)} USDC`, "#a5b4fc"],
                  [
                    "Withdrawn",
                    `${withdrawnUSDC.toFixed(0)} USDC`,
                    "rgba(255,255,255,0.5)",
                  ],
                  ["Withdrawable", `${withdrawable.toFixed(0)} USDC`, "#34d399"],
                  [
                    "Time",
                    `${elapsed.toFixed(1)}s / 12s`,
                    "rgba(255,255,255,0.4)",
                  ],
                ] as [string, string, string][]
              ).map(([label, value, color]) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {state === "revoked" && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(107,114,128,0.1)",
              border: "1px solid rgba(107,114,128,0.2)",
              fontSize: 13,
              color: "#9ca3af",
            }}
          >
            Stream revoked by employer. Vested tokens sent to employee; remainder
            refunded.
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        {isIdle && (
          <button
            className="btn-primary"
            onClick={createStream}
            disabled={isBusy}
          >
            {busy === "create" ? (
              <Loader2
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Play size={14} />
            )}
            Create Stream
          </button>
        )}

        {state === "streaming" && (
          <>
            <button
              className="btn-primary"
              onClick={withdraw}
              disabled={isBusy || withdrawable <= 0}
            >
              {withdrawable > 0
                ? `Withdraw ${withdrawable.toFixed(0)} USDC`
                : "Withdraw (cliff not reached)"}
            </button>
            <button
              className="btn-danger"
              onClick={revokeStream}
              disabled={isBusy}
            >
              {busy === "revoke" && (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              )}
              Revoke Stream
            </button>
          </>
        )}

        {state === "complete" && (
          <button
            className="btn-primary"
            onClick={withdraw}
            disabled={withdrawable <= 0}
          >
            {withdrawable > 0
              ? `Withdraw ${withdrawable.toFixed(0)} USDC`
              : "All withdrawn ✓"}
          </button>
        )}

        {!isIdle && (
          <button
            className="btn-secondary"
            onClick={reset}
            disabled={isBusy}
            style={{ marginLeft: "auto" }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <LogPanel log={log} />

      {isIdle && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}
        >
          Click{" "}
          <strong style={{ color: "rgba(255,255,255,0.5)" }}>
            Create Stream
          </strong>{" "}
          to start the vesting demo
        </div>
      )}
    </div>
  );
}

// ─── PAYOUT TAB ────────────────────────────────────────────────────────────────

type PayoutRowStatus = "QUEUED" | "PROCESSING" | "COMPLETED";

type DemoPayoutRow = {
  recipient: string;
  amount: string;
  chain: string;
  status: PayoutRowStatus;
};

const DEMO_ROWS: Omit<DemoPayoutRow, "status">[] = [
  { recipient: ALICE, amount: "1,000", chain: "ARC" },
  { recipient: BOB, amount: "2,500", chain: "BASE" },
  { recipient: CAROL, amount: "500", chain: "ARB" },
];

type BatchState = "idle" | "approving" | "creating" | "running" | "done";

function PayoutDemo() {
  const [state, setState] = useState<BatchState>("idle");
  const [log, setLog] = useState<Log[]>([]);
  const [rows, setRows] = useState<DemoPayoutRow[]>(
    DEMO_ROWS.map((r) => ({ ...r, status: "QUEUED" }))
  );
  const [busy, setBusy] = useState(false);

  function addLog(msg: string) {
    setLog((p) => [...p, { ts: ts(), msg }]);
  }

  function reset() {
    setState("idle");
    setLog([]);
    setRows(DEMO_ROWS.map((r) => ({ ...r, status: "QUEUED" })));
    setBusy(false);
  }

  async function createBatch() {
    setBusy(true);
    setState("approving");
    addLog("Approving USDC spend for ArcFlowPayoutRouter…");
    await delay(1500);
    addLog("✓ ERC-20 approval confirmed (4,000 USDC)");
    setState("creating");
    addLog("Sending createBatchPayout transaction…");
    await delay(2000);
    addLog("✓ Batch #demo-42 created — 3 payouts queued on Arc Testnet");
    setState("running");
    setBusy(false);

    // Process each row sequentially
    for (let i = 0; i < DEMO_ROWS.length; i++) {
      await delay(1500);
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "PROCESSING" } : r
        )
      );
      addLog(
        `Processing payout ${i + 1}/3 via Circle → ${short(DEMO_ROWS[i].recipient)} on ${DEMO_ROWS[i].chain}`
      );
      await delay(2000);
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "COMPLETED" } : r
        )
      );
      addLog(
        `✓ Payout ${i + 1}/3 completed — ${DEMO_ROWS[i].amount} USDC delivered to ${DEMO_ROWS[i].chain}`
      );
    }

    setState("done");
    addLog("✓ Batch #demo-42 complete — 4,000 USDC distributed across 3 chains");
  }

  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const isIdle = state === "idle";
  const showTable = state !== "idle" && state !== "approving" && state !== "creating";

  const rowBadge: Record<PayoutRowStatus, string> = {
    QUEUED: "badge-queued",
    PROCESSING: "badge-processing",
    COMPLETED: "badge-done",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Batch card */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 4 }}
            >
              Batch #demo-42
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Demo · 3 payouts · 4,000 USDC · Multi-chain via Circle
            </div>
          </div>
          {(state === "approving" || state === "creating") && (
            <span className="badge-queued">CREATING</span>
          )}
          {state === "running" && (
            <span className="badge-processing">PROCESSING</span>
          )}
          {state === "done" && <span className="badge-done">COMPLETED</span>}
        </div>

        {/* Static preview before batch is running */}
        {!showTable && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DEMO_ROWS.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "monospace",
                    minWidth: 24,
                  }}
                >
                  #{i + 1}
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)",
                    flex: 1,
                  }}
                >
                  {short(row.recipient)}
                </span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "white" }}
                >
                  {row.amount} USDC
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    color: "#a5b4fc",
                  }}
                >
                  {row.chain}
                </span>
              </div>
            ))}
            {/* Total */}
            <div
              style={{
                marginTop: 4,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.12)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Total
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>
                4,000 USDC
              </span>
            </div>
          </div>
        )}

        {/* Live status table */}
        {showTable && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {completed} / {DEMO_ROWS.length} completed
              </span>
              {state === "done" && (
                <span
                  style={{
                    fontSize: 12,
                    color: "#34d399",
                    fontWeight: 500,
                  }}
                >
                  All payouts delivered ✓
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background:
                      row.status === "PROCESSING"
                        ? "rgba(6,182,212,0.05)"
                        : row.status === "COMPLETED"
                        ? "rgba(16,185,129,0.04)"
                        : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      row.status === "PROCESSING"
                        ? "rgba(6,182,212,0.15)"
                        : row.status === "COMPLETED"
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(255,255,255,0.06)"
                    }`,
                    transition: "all 0.4s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "monospace",
                      minWidth: 24,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.7)",
                      flex: 1,
                    }}
                  >
                    {short(row.recipient)}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "white" }}
                  >
                    {row.amount} USDC
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      color: "#a5b4fc",
                    }}
                  >
                    {row.chain}
                  </span>
                  <span className={rowBadge[row.status]}>{row.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
      >
        {isIdle && (
          <button
            className="btn-primary"
            onClick={createBatch}
            disabled={busy}
          >
            <Play size={14} /> Create Batch Payout
          </button>
        )}

        {(state === "approving" || state === "creating") && (
          <button className="btn-primary" disabled>
            <Loader2
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
            {state === "approving" ? "Approving…" : "Creating batch…"}
          </button>
        )}

        {!isIdle && (
          <button
            className="btn-secondary"
            onClick={reset}
            disabled={busy || state === "running"}
            style={{ marginLeft: "auto" }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <LogPanel log={log} />

      {isIdle && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}
        >
          Click{" "}
          <strong style={{ color: "rgba(255,255,255,0.5)" }}>
            Create Batch Payout
          </strong>{" "}
          to simulate multi-chain distribution
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

type Tab = "escrow" | "payroll" | "payout";

const TABS: { id: Tab; label: string }[] = [
  { id: "escrow", label: "Escrow & Disputes" },
  { id: "payroll", label: "Payroll & Vesting" },
  { id: "payout", label: "Payout Batches" },
];

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("escrow");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          Interactive Demo
        </div>
        <h2
          style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "white" }}
        >
          ArcFlow Operations Showcase
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 14,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.7,
          }}
        >
          Walk through escrow disputes, payroll vesting, and payout batches —
          no wallet or testnet funds required.
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              borderRadius: "10px 10px 0 0",
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color:
                tab === t.id ? "#a5b4fc" : "rgba(255,255,255,0.45)",
              background:
                tab === t.id ? "rgba(99,102,241,0.12)" : "transparent",
              border: "1px solid",
              borderColor:
                tab === t.id
                  ? "rgba(99,102,241,0.25)"
                  : "transparent",
              borderBottom:
                tab === t.id
                  ? "1px solid rgba(10,10,15,1)"
                  : "1px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              transition: "all 0.15s ease",
              outline: "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "escrow" && <EscrowDemo />}
      {tab === "payroll" && <PayrollDemo />}
      {tab === "payout" && <PayoutDemo />}
    </div>
  );
}
