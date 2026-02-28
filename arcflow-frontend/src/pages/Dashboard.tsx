import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";

// ─── Animation variants ──────────────────────────────────────────────────
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};
import {
  ShieldCheck,
  GitBranch,
  ArrowRightLeft,
  TrendingUp,
  Clock,
  ExternalLink,
} from "lucide-react";
import EmptyState from "../components/EmptyState";

// Shapes mirror what each page writes to localStorage
type StoredEscrow = { id: string; payee: string; amount: string; token: string; createdAt: string };
type StoredStream = { id: string; employee: string; amount: string; token: string; createdAt: string };
type StoredBatch  = { id: string; recipients: number; total: string; token: string; createdAt: string };

function readLS<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); }
  catch { return []; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_MAP: Record<string, string> = {
  OPEN:       "badge-open",
  ACTIVE:     "badge-active",
  QUEUED:     "badge-queued",
  PROCESSING: "badge-queued",
  DISPUTED:   "badge-disputed",
  RELEASED:   "badge-done",
  REVOKED:    "badge-refunded",
  REFUNDED:   "badge-refunded",
  FAILED:     "badge-failed",
};

const TYPE_ICON: Record<string, React.ElementType> = {
  escrow: ShieldCheck,
  stream: GitBranch,
  payout: ArrowRightLeft,
};

export default function Dashboard() {
  // Read session items from localStorage (written by EscrowPage, PayrollPage, PayoutsPage)
  const escrows = readLS<StoredEscrow>("arcflow_my_escrows");
  const streams = readLS<StoredStream>("arcflow_my_streams");
  const batches = readLS<StoredBatch>("arcflow_my_batches");

  const escrowTotal = escrows.reduce((s, e)  => s + (+e.amount || 0), 0);
  const streamTotal = streams.reduce((s, st) => s + (+st.amount || 0), 0);
  const batchTotal  = batches.reduce((s, b)  => s + (+b.total   || 0), 0);
  const grandTotal  = escrowTotal + streamTotal + batchTotal;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const METRICS = [
    {
      label: "USDC in Escrow",
      value: fmt(escrowTotal),
      token: "USDC",
      icon: ShieldCheck,
      color: "#6366f1",
      change: escrows.length
        ? `${escrows.length} escrow${escrows.length !== 1 ? "s" : ""}`
        : "None yet",
    },
    {
      label: "USDC in Streams",
      value: fmt(streamTotal),
      token: "USDC",
      icon: GitBranch,
      color: "#8b5cf6",
      change: streams.length
        ? `${streams.length} stream${streams.length !== 1 ? "s" : ""}`
        : "None yet",
    },
    {
      label: "Pending Payout Batches",
      value: fmt(batchTotal),
      token: "USDC",
      icon: ArrowRightLeft,
      color: "#06b6d4",
      change: batches.length
        ? `${batches.length} batch${batches.length !== 1 ? "es" : ""}`
        : "None yet",
    },
    {
      label: "Total Treasury Value",
      value: fmt(grandTotal),
      token: "USDC",
      icon: TrendingUp,
      color: "#10b981",
      change: "All chains",
    },
  ];

  // Combine all created items, sort newest-first, show up to 5
  const RECENT = [
    ...escrows.map(e => ({
      type: "escrow",
      id: e.id,
      label: `Escrow #${e.id}`,
      detail: `${e.amount} ${e.token} → ${e.payee || "—"}`,
      status: "OPEN",
      time: timeAgo(e.createdAt),
      _ts: new Date(e.createdAt).getTime(),
    })),
    ...streams.map(s => ({
      type: "stream",
      id: s.id,
      label: `Stream #${s.id}`,
      detail: `${s.amount} ${s.token} → ${s.employee || "—"}`,
      status: "ACTIVE",
      time: timeAgo(s.createdAt),
      _ts: new Date(s.createdAt).getTime(),
    })),
    ...batches.map(b => ({
      type: "payout",
      id: b.id,
      label: `Batch #${b.id}`,
      detail: `${b.recipients} recipient${b.recipients !== 1 ? "s" : ""}, ${b.total} ${b.token}`,
      status: "QUEUED",
      time: timeAgo(b.createdAt),
      _ts: new Date(b.createdAt).getTime(),
    })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Metrics bento grid */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        {METRICS.map(({ label, value, token, icon: Icon, color, change }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className={`glass-card glass-card-hover${
                  label === "Total Treasury Value" ? " metric-highlight" : ""
                }`}
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: `${color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={15} color={color} />
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "white",
                      lineHeight: 1,
                    }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 4,
                    }}
                  >
                    {token}
                  </div>
                </div>
                <div style={{ fontSize: 11, color, fontWeight: 500 }}>
                  {change}
                </div>
              </motion.div>
            ))}
      </motion.div>

      {/* Two-column lower section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.36, ease: "easeOut" }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 14,
        }}
      >
        {/* Recent Activity */}
        <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{ fontWeight: 600, fontSize: 14, color: "white" }}
            >
              Recent Activity
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {RECENT.length} event{RECENT.length !== 1 ? "s" : ""}
            </div>
          </div>
          {RECENT.length === 0 ? (
            <EmptyState
              icon={<Clock size={24} />}
              title="No activity yet"
              description="Create your first escrow, stream, or payout batch to see activity here."
            />
          ) : (
            <div style={{ overflowY: "auto" }}>
              {RECENT.map((item, i) => {
                const Icon = TYPE_ICON[item.type];
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 20px",
                      borderBottom:
                        i < RECENT.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} color="rgba(255,255,255,0.5)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "rgba(255,255,255,0.85)",
                          marginBottom: 2,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.35)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 5,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className={`badge ${STATUS_MAP[item.status] || "badge-open"}`}
                      >
                        {item.status}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.3)",
                        }}
                      >
                        {item.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Quick Actions */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 14,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Quick Actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  label: "New Escrow",
                  href: "/escrow",
                  icon: ShieldCheck,
                  color: "#6366f1",
                },
                {
                  label: "New Stream",
                  href: "/payroll",
                  icon: GitBranch,
                  color: "#8b5cf6",
                },
                {
                  label: "New Batch Payout",
                  href: "/payouts",
                  icon: ArrowRightLeft,
                  color: "#06b6d4",
                },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link
                  key={label}
                  to={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.06)";
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={14} color={color} />
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.75)",
                      flex: 1,
                    }}
                  >
                    {label}
                  </span>
                  <ExternalLink size={13} color="rgba(255,255,255,0.25)" />
                </Link>
              ))}
            </div>
          </div>

          {/* Network info card */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
              }}
            >
              Network
            </div>
            {[
              { label: "Network", value: "Arc Testnet" },
              { label: "Chain ID", value: "5042002" },
              { label: "Token", value: "USDC / EURC" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.75)",
                    fontFamily: "monospace",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "rgba(99,102,241,0.7)",
                  boxShadow: "0 0 6px rgba(99,102,241,0.5)",
                }}
              />
              <span style={{ fontSize: 12, color: "rgba(165,180,252,0.8)", fontWeight: 500 }}>
                Arc Testnet
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
