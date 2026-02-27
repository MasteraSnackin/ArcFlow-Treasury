import { useState } from "react";
import {
  ShieldCheck,
  GitBranch,
  ArrowRightLeft,
  TrendingUp,
  Clock,
  ExternalLink,
} from "lucide-react";
import { MetricSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

// Simulated data
const METRICS = [
  {
    label: "USDC in Escrow",
    value: "12,400.00",
    token: "USDC",
    icon: ShieldCheck,
    color: "#6366f1",
    change: "+2 active",
  },
  {
    label: "USDC in Streams",
    value: "48,750.00",
    token: "USDC",
    icon: GitBranch,
    color: "#8b5cf6",
    change: "3 streams",
  },
  {
    label: "Pending Payout Batches",
    value: "7,200.00",
    token: "USDC",
    icon: ArrowRightLeft,
    color: "#06b6d4",
    change: "1 batch",
  },
  {
    label: "Total Treasury Value",
    value: "68,350.00",
    token: "USDC",
    icon: TrendingUp,
    color: "#10b981",
    change: "All chains",
  },
];

const RECENT = [
  {
    type: "escrow",
    id: "0",
    label: "Escrow #0",
    detail: "2,400 USDC \u2192 0xabc\u2026123",
    status: "OPEN",
    time: "2h ago",
  },
  {
    type: "escrow",
    id: "1",
    label: "Escrow #1",
    detail: "10,000 USDC \u2192 0xdef\u2026456",
    status: "DISPUTED",
    time: "5h ago",
  },
  {
    type: "stream",
    id: "0",
    label: "Stream #0",
    detail: "18,000 USDC \u2192 0x111\u2026aaa",
    status: "ACTIVE",
    time: "1d ago",
  },
  {
    type: "stream",
    id: "1",
    label: "Stream #1",
    detail: "30,750 USDC \u2192 0x222\u2026bbb",
    status: "ACTIVE",
    time: "2d ago",
  },
  {
    type: "payout",
    id: "0",
    label: "Batch #0",
    detail: "3\u00d7recipients, 7,200 USDC",
    status: "QUEUED",
    time: "30m ago",
  },
];

const STATUS_MAP: Record<string, string> = {
  OPEN: "badge-open",
  ACTIVE: "badge-active",
  QUEUED: "badge-queued",
  DISPUTED: "badge-disputed",
  RELEASED: "badge-done",
  FAILED: "badge-failed",
};

const TYPE_ICON: Record<string, React.ElementType> = {
  escrow: ShieldCheck,
  stream: GitBranch,
  payout: ArrowRightLeft,
};

export default function Dashboard() {
  const [loading] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Metrics bento grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        {loading
          ? [1, 2, 3, 4].map((i) => <MetricSkeleton key={i} />)
          : METRICS.map(({ label, value, token, icon: Icon, color, change }) => (
              <div
                key={label}
                className="glass-card glass-card-hover"
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
              </div>
            ))}
      </div>

      {/* Two-column lower section */}
      <div
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
              {RECENT.length} events
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
                    key={i}
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
                <a
                  key={label}
                  href={href}
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
                </a>
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
                  background: "#34d399",
                  boxShadow: "0 0 6px #34d399",
                }}
              />
              <span style={{ fontSize: 12, color: "#34d399", fontWeight: 500 }}>
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
