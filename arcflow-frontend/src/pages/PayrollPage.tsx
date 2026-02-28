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
import {
  getStreamsContract,
  getStreamsContractReadOnly,
  approveIfNeeded,
  TOKEN_ADDRESSES,
  parseToken,
  formatToken,
  ZeroAddress,
} from "../lib/contracts";

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
  const [createStatus, setCreateStatus] = useState("");
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
    setCreateStatus("");
    try {
      const tokenAddr = TOKEN_ADDRESSES[formData.token];
      const streamsContract = await getStreamsContract();
      const streamsAddr = import.meta.env.VITE_ARC_STREAMS_ADDRESS as string;
      const totalBigInt = parseToken(formData.totalAmount);
      const now = Math.floor(Date.now() / 1000);
      const start = now;
      const cliff = now + Number(formData.cliffHours) * 3600;
      const end = now + Number(formData.durationHours) * 3600;

      await approveIfNeeded(tokenAddr, streamsAddr, totalBigInt, setCreateStatus);

      setCreateStatus("Sending transaction…");
      const tx = await streamsContract.createStream(
        formData.employee,
        tokenAddr,
        totalBigInt,
        BigInt(start),
        BigInt(cliff),
        BigInt(end)
      );
      setCreateStatus("Waiting for confirmation…");
      const receipt = await tx.wait();

      // Parse StreamCreated event to get the real on-chain stream ID.
      let newId = String(myStreams.length);
      if (receipt) {
        for (const log of receipt.logs) {
          try {
            const parsed = streamsContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed?.name === "StreamCreated") {
              newId = parsed.args[0].toString();
              break;
            }
          } catch { /* not this event */ }
        }
      }

      setShowModal(false);
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
      doLookup(newId);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4001) {
        const msg =
          (err as { shortMessage?: string }).shortMessage ??
          (err as { message?: string }).message ??
          "Failed to create stream.";
        toast.error(msg);
      }
    } finally {
      setCreating(false);
      setCreateStatus("");
    }
  };

  const doLookup = async (id: string) => {
    setLookupId(id);
    setLoading(true);
    setStream(null);
    setNotFound(false);
    setConfirmRevoke(false);
    try {
      const contract = await getStreamsContractReadOnly();
      const data = await contract.streams(BigInt(id)) as [
        string, string, string, bigint, bigint, bigint, bigint, bigint
      ];
      const [employer, employee, token, totalAmount, start, cliff, end, withdrawn] = data;
      if (employer === ZeroAddress) { setNotFound(true); return; }
      const vested = (await contract.getVested(BigInt(id))) as bigint;
      const withdrawable = (await contract.getWithdrawable(BigInt(id))) as bigint;
      // Revoked: contract sets withdrawn = totalAmount when employer revokes before end
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const revoked = totalAmount > 0n && withdrawn === totalAmount && nowSec < end;
      const tokenName =
        Object.entries(TOKEN_ADDRESSES).find(
          ([, addr]) => addr.toLowerCase() === token.toLowerCase()
        )?.[0] ?? `${token.slice(0, 6)}\u2026${token.slice(-4)}`;
      const short = (addr: string) =>
        addr ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : "";
      setStream({
        id,
        employer: short(employer),
        employee: short(employee),
        token: tokenName,
        totalAmount: formatToken(totalAmount),
        start: Number(start),
        cliff: Number(cliff),
        end: Number(end),
        withdrawn: formatToken(withdrawn),
        vested: formatToken(vested),
        withdrawable: formatToken(withdrawable),
        revoked,
      });
    } catch (err: unknown) {
      const msg =
        (err as { shortMessage?: string }).shortMessage ??
        (err as { message?: string }).message ??
        "";
      if (msg.toLowerCase().includes("not configured")) toast.error(msg);
      else toast.error("Lookup failed — check your RPC connection and contract address.");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => { e.preventDefault(); doLookup(lookupId); };

  const doAction = async (action: string) => {
    if (!stream) return;
    setActionLoading(action);
    try {
      const id = BigInt(stream.id);
      const contract = await getStreamsContract();
      const tx =
        action === "withdraw" ? await contract.withdraw(id) :
        action === "revoke"   ? await contract.revoke(id)   :
        null;
      if (!tx) return;
      await tx.wait();
      await doLookup(stream.id);
      if (action === "withdraw") {
        toast.success(`Withdrew ${stream.withdrawable} ${stream.token} successfully.`);
      } else if (action === "revoke") {
        toast.success("Stream revoked. Vested amount sent to employee, remainder refunded.");
      }
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4001) {
        const msg =
          (err as { shortMessage?: string }).shortMessage ??
          (err as { message?: string }).message ??
          "Action failed.";
        toast.error(msg);
      }
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
                    ["Total", `${stream.totalAmount} ${stream.token}`],
                    ["Withdrawn", `${stream.withdrawn} ${stream.token}`],
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
                      {vestedPct}% ({stream.vested} {stream.token})
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
                    <span>Withdrawable: {stream.withdrawable} {stream.token}</span>
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
                    : `Withdraw ${stream.withdrawable} ${stream.token}`}
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
          {createStatus && (
            <div style={{ fontSize: 12, color: "rgba(165,180,252,0.8)" }}>
              {createStatus}
            </div>
          )}
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
