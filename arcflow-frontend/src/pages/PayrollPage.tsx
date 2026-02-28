import { useState } from "react";
import toast from "react-hot-toast";
import {
  GitBranch,
  Search,
  Plus,
  RefreshCw,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  List,
} from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonLine } from "../components/Skeleton";

type Stream = {
  id: string;
  employer: string;
  employee: string;
  token: string;
  totalAmount: string;
  start: number;
  cliff: number;
  end: number;
  withdrawn: string;
  vested: string;
  withdrawable: string;
  revoked: boolean;
};

const MOCK_STREAM: Stream = {
  id: "0",
  employer: "0x1234\u20265678",
  employee: "0xabcd\u2026ef01",
  token: "USDC",
  totalAmount: "18000.00",
  start: Date.now() / 1000 - 86400 * 30,
  cliff: Date.now() / 1000 - 86400 * 20,
  end: Date.now() / 1000 + 86400 * 335,
  withdrawn: "1500.00",
  vested: "4500.00",
  withdrawable: "3000.00",
  revoked: false,
};

type MyStream = { id: string; employee: string; amount: string; token: string; createdAt: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div
      style={{
        width: "100%",
        height: 6,
        borderRadius: 6,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 6,
          background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
          transition: "width 0.6s ease",
        }}
      />
    </div>
  );
}

export default function PayrollPage() {
  const [formData, setFormData] = useState({
    employee: "",
    token: "USDC",
    totalAmount: "",
    startNow: true,
    cliffHours: "0",
    durationHours: "720",
  });
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState<Stream | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [myStreams, setMyStreams] = useState<MyStream[]>(() => {
    try { return JSON.parse(localStorage.getItem("arcflow_my_streams") ?? "[]"); }
    catch { return []; }
  });

  const set = (k: string, v: string | boolean) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee || !formData.totalAmount) {
      toast.error("Fill all required fields.");
      return;
    }
    setCreating(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setShowModal(false);
      const newId = String(myStreams.length);
      const newItem: MyStream = {
        id: newId,
        employee: formData.employee,
        amount: formData.totalAmount,
        token: formData.token,
        createdAt: new Date().toISOString(),
      };
      const updatedStreams = [newItem, ...myStreams];
      setMyStreams(updatedStreams);
      localStorage.setItem("arcflow_my_streams", JSON.stringify(updatedStreams));
      toast.success(`Stream #${newId} created! Employee will start vesting immediately.`);
    } catch {
      toast.error("Failed to create stream. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const doLookup = async (id: string) => {
    setLookupId(id);
    setLoading(true);
    setStream(null);
    setNotFound(false);
    setConfirmRevoke(false);
    try {
      await new Promise((r) => setTimeout(r, 800));
      if (id === "0") setStream(MOCK_STREAM);
      else setNotFound(true);
    } catch {
      toast.error("Lookup failed. Please try again.");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => { e.preventDefault(); doLookup(lookupId); };

  const doAction = async (action: string) => {
    setActionLoading(action);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      if (action === "withdraw") {
        setStream((s) =>
          s
            ? {
                ...s,
                withdrawn: (+s.withdrawn + +s.withdrawable).toFixed(2),
                withdrawable: "0.00",
              }
            : s
        );
        toast.success(`Withdrew ${stream?.withdrawable} USDC successfully.`);
      } else if (action === "revoke") {
        setStream((s) => (s ? { ...s, revoked: true } : s));
        toast.success(
          "Stream revoked. Vested amount sent to employee, remainder refunded."
        );
      }
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const vestedPct = stream
    ? ((+stream.vested / +stream.totalAmount) * 100).toFixed(1)
    : "0";
  const wdrawPct = stream
    ? ((+stream.withdrawn / +stream.totalAmount) * 100).toFixed(1)
    : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          Create and manage USDC payroll streams with cliff vesting.
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Stream
        </button>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        {/* Lookup */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "white",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Search size={16} color="rgba(255,255,255,0.5)" /> Look Up Stream
          </div>
          <form
            onSubmit={handleLookup}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Stream ID
              </label>
              <input
                className="input-glass"
                placeholder="e.g. 0"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={loading || !lookupId}
            >
              {loading ? (
                <RefreshCw
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Search size={14} />
              )}
              {loading ? "Loading\u2026" : "Look Up"}
            </button>
          </form>

          {loading && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <SkeletonLine h={14} w="60%" />
              <SkeletonLine h={10} w="80%" />
              <SkeletonLine h={8} w="100%" />
            </div>
          )}

          {notFound && !loading && (
            <div
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 12,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle
                size={16}
                color="#f87171"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f87171" }}>
                  Stream not found
                </div>
                <div style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginTop: 3 }}>
                  No stream with ID &quot;{lookupId}&quot; exists. Check the ID and try again.
                </div>
              </div>
            </div>
          )}

          {stream && !loading && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "white",
                    }}
                  >
                    Stream #{stream.id}
                  </span>
                  <span
                    className={`badge ${stream.revoked ? "badge-refunded" : "badge-active"}`}
                  >
                    {stream.revoked ? "REVOKED" : "ACTIVE"}
                  </span>
                </div>
                {(
                  [
                    ["Employer", stream.employer],
                    ["Employee", stream.employee],
                    ["Token", stream.token],
                    ["Total", `${stream.totalAmount} USDC`],
                    ["Withdrawn", `${stream.withdrawn} USDC`],
                  ] as [string, string][]
                ).map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      {l}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.75)",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      Vested
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontWeight: 600,
                      }}
                    >
                      {vestedPct}% ({stream.vested} USDC)
                    </span>
                  </div>
                  <ProgressBar
                    value={+stream.vested}
                    max={+stream.totalAmount}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    <span>Withdrawn: {wdrawPct}%</span>
                    <span>Withdrawable: {stream.withdrawable} USDC</span>
                  </div>
                </div>
              </div>
              {!stream.revoked && +stream.withdrawable > 0 && (
                <button
                  className="btn-primary"
                  onClick={() => doAction("withdraw")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "withdraw" ? (
                    <RefreshCw
                      size={13}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <DollarSign size={13} />
                  )}
                  {actionLoading === "withdraw"
                    ? "Withdrawing\u2026"
                    : `Withdraw ${stream.withdrawable} USDC`}
                </button>
              )}
              {!stream.revoked && !confirmRevoke && (
                <button
                  className="btn-danger"
                  onClick={() => setConfirmRevoke(true)}
                  disabled={!!actionLoading}
                >
                  <TrendingUp size={13} />
                  Revoke Stream (employer)
                </button>
              )}
              {!stream.revoked && confirmRevoke && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <AlertTriangle
                      size={14}
                      color="#f87171"
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                    <span style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
                      This is irreversible. Vested tokens go to the employee;
                      the remainder is refunded to you.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-danger"
                      onClick={() => { setConfirmRevoke(false); doAction("revoke"); }}
                      disabled={!!actionLoading}
                      style={{ flex: 1 }}
                    >
                      {actionLoading === "revoke" ? (
                        <RefreshCw
                          size={13}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                      ) : (
                        <TrendingUp size={13} />
                      )}
                      {actionLoading === "revoke" ? "Revoking\u2026" : "Confirm Revoke"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setConfirmRevoke(false)}
                      disabled={!!actionLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!loading && !stream && !notFound && (
            <EmptyState
              icon={<GitBranch size={22} />}
              title="No stream loaded"
              description="Enter a stream ID above to view vesting details and actions."
            />
          )}
        </div>

        {/* My Streams */}
        <div className="glass-card" style={{ padding: 24, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "white",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <List size={16} color="rgba(255,255,255,0.5)" /> My Streams
          </div>
          {myStreams.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={22} />}
              title="No streams yet"
              description="Create a stream and it will appear here for quick access."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {myStreams.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => doLookup(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 6px",
                    borderBottom: i < myStreams.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    cursor: "pointer",
                    borderRadius: 8,
                    transition: "background 0.1s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <GitBranch size={15} color="#a78bfa" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                      Stream #{item.id}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.employee || "—"} · {item.amount} {item.token}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                    {timeAgo(item.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Stream Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Payroll Stream"
      >
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 15 }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Employee Address *
            </label>
            <input
              className="input-glass"
              placeholder="0x..."
              value={formData.employee}
              onChange={(e) => set("employee", e.target.value)}
              style={{ width: "100%" }}
              required
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Token
              </label>
              <select
                className="input-glass"
                value={formData.token}
                onChange={(e) => set("token", e.target.value)}
                style={{ width: "100%" }}
              >
                <option>USDC</option>
                <option>EURC</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Total Amount *
              </label>
              <input
                className="input-glass"
                type="number"
                min="0"
                step="0.01"
                placeholder="18000.00"
                value={formData.totalAmount}
                onChange={(e) => set("totalAmount", e.target.value)}
                style={{ width: "100%" }}
                required
              />
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Cliff (hours)
              </label>
              <input
                className="input-glass"
                type="number"
                min="0"
                placeholder="0"
                value={formData.cliffHours}
                onChange={(e) => set("cliffHours", e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Duration (hours)
              </label>
              <input
                className="input-glass"
                type="number"
                min="1"
                placeholder="720"
                value={formData.durationHours}
                onChange={(e) => set("durationHours", e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
              fontSize: 12,
              color: "rgba(99,102,241,0.8)",
            }}
          >
            You must approve {formData.totalAmount || "0"} {formData.token}{" "}
            before creating. The app will prompt you.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating}
            >
              {creating ? (
                <RefreshCw
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <GitBranch size={14} />
              )}
              {creating ? "Creating\u2026" : "Create Stream"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
