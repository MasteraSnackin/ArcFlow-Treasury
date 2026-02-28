import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightLeft,
  Plus,
  Minus,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  List,
  Loader,
} from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonLine } from "../components/Skeleton";
import {
  getPayoutContract,
  approveIfNeeded,
  TOKEN_ADDRESSES,
  parseToken,
  encodeChain,
} from "../lib/contracts";

type MyBatch = { id: string; recipients: number; total: string; token: string; createdAt: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Recipient = { address: string; amount: string; chain: string };
type PayoutRow = {
  index: number;
  recipient: string;
  amount: string;
  destinationChain: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  circleTransferId?: string;
};
type BatchStatus = {
  batchId: string;
  totalPayouts: number;
  totalAmount: string;
  ready: boolean;
  payouts: PayoutRow[];
};


// Chains supported by Circle's arc-multichain-wallet integration.
// POLYGON and OPTIMISM are intentionally excluded — they are not in Circle's
// current ARC-testnet chain map (mapChainIdentifier in circleClient.ts).
const CHAINS = ["ARC", "BASE", "AVAX", "ETH", "ARB"];

const STATUS_BADGE: Record<string, string> = {
  QUEUED:     "badge-queued",
  PROCESSING: "badge-queued",
  COMPLETED:  "badge-done",
  FAILED:     "badge-failed",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  QUEUED:     Clock,
  PROCESSING: Loader,
  COMPLETED:  CheckCircle,
  FAILED:     AlertCircle,
};

export default function PayoutsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: "", amount: "", chain: "ARC" },
  ]);
  const [token, setToken] = useState("USDC");
  const [creating, setCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [myBatches, setMyBatches] = useState<MyBatch[]>(() => {
    try { return JSON.parse(localStorage.getItem("arcflow_my_batches") ?? "[]"); }
    catch { return []; }
  });

  const addRow = () =>
    setRecipients((r) => [...r, { address: "", amount: "", chain: "ARC" }]);
  const removeRow = (i: number) =>
    setRecipients((r) => r.filter((_, j) => j !== i));
  const setRow = (i: number, k: keyof Recipient, v: string) =>
    setRecipients((r) =>
      r.map((row, j) => (j === i ? { ...row, [k]: v } : row))
    );
  const total = recipients.reduce((s, r) => s + (+r.amount || 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = recipients.filter((r) => !r.address || !r.amount);
    if (invalid.length) {
      toast.error("Fill all recipient rows or remove empty ones.");
      return;
    }
    setCreating(true);
    setCreateStatus("");
    try {
      const tokenAddr = TOKEN_ADDRESSES[token];
      const payoutContract = await getPayoutContract();
      const payoutRouterAddr = import.meta.env.VITE_ARC_PAYOUT_ROUTER_ADDRESS as string;

      const recipientAddrs = recipients.map((r) => r.address);
      const amounts = recipients.map((r) => parseToken(r.amount));
      const chains = recipients.map((r) => encodeChain(r.chain));
      const totalBigInt = amounts.reduce((a, b) => a + b, 0n);

      await approveIfNeeded(tokenAddr, payoutRouterAddr, totalBigInt, setCreateStatus);

      setCreateStatus("Sending transaction…");
      const tx = await payoutContract.createBatchPayout(
        tokenAddr,
        recipientAddrs,
        amounts,
        chains
      );
      setCreateStatus("Waiting for confirmation…");
      const receipt = await tx.wait();

      // Parse BatchPayoutCreated event to get the real on-chain batch ID.
      let newId = String(myBatches.length);
      if (receipt) {
        for (const log of receipt.logs) {
          try {
            const parsed = payoutContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed?.name === "BatchPayoutCreated") {
              newId = parsed.args[0].toString();
              break;
            }
          } catch { /* not this event */ }
        }
      }

      setShowModal(false);
      const newItem: MyBatch = {
        id: newId,
        recipients: recipients.length,
        total: total.toFixed(2),
        token,
        createdAt: new Date().toISOString(),
      };
      const updatedBatches = [newItem, ...myBatches];
      setMyBatches(updatedBatches);
      localStorage.setItem("arcflow_my_batches", JSON.stringify(updatedBatches));
      toast.success(
        `Batch #${newId} created with ${recipients.length} payouts (${total.toFixed(2)} ${token})`
      );
      setRecipients([{ address: "", amount: "", chain: "ARC" }]);
      doLookup(newId);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4001) {
        const msg =
          (err as { shortMessage?: string }).shortMessage ??
          (err as { message?: string }).message ??
          "Failed to create batch.";
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
    setBatch(null);
    setNotFound(false);
    try {
      const res = await fetch(`http://localhost:3000/payouts/${id}/status`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as BatchStatus;
      setBatch(data);
    } catch {
      toast.error("Status fetch failed. Is the backend running?");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => { e.preventDefault(); doLookup(lookupId); };

  const refresh = async () => {
    if (!lookupId) return;
    await doLookup(lookupId);
    toast.success("Status refreshed.");
  };

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
          Create multi-recipient USDC payouts across chains via Circle.
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Batch Payout
        </button>
      </div>

      {/* My Batches */}
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
          <List size={16} color="rgba(255,255,255,0.5)" /> My Batches
        </div>
        {myBatches.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft size={22} />}
            title="No batches yet"
            description="Create a batch payout and it will appear here for quick access."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {myBatches.map((item, i) => (
              <div
                key={item.id}
                onClick={() => doLookup(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 6px",
                  borderBottom: i < myBatches.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
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
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ArrowRightLeft size={15} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                    Batch #{item.id}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {item.recipients} recipient{item.recipients !== 1 ? "s" : ""} · {item.total} {item.token}
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

      {/* Batch status lookup */}
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
          <Search size={16} color="rgba(255,255,255,0.5)" /> Batch Status
        </div>
        <form
          onSubmit={handleLookup}
          style={{ display: "flex", gap: 12, marginBottom: 20 }}
        >
          <input
            className="input-glass"
            placeholder="Batch ID (e.g. 0)"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            style={{ flex: 1 }}
          />
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
            {loading ? "Fetching\u2026" : "Fetch Status"}
          </button>
          {batch && (
            <button
              type="button"
              className="btn-secondary"
              onClick={refresh}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </form>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonLine key={i} h={40} />
            ))}
          </div>
        )}

        {notFound && !loading && (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.15)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <AlertCircle size={15} color="#f87171" />
            <span style={{ fontSize: 13, color: "#f87171" }}>
              Batch ID &quot;{lookupId}&quot; not found. Verify the ID or check
              your network.
            </span>
          </div>
        )}

        {!batch && !loading && !notFound && (
          <EmptyState
            icon={<ArrowRightLeft size={22} />}
            title="No batch loaded"
            description="Enter a batch ID above to see per-recipient payout status."
          />
        )}

        {batch && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Batch summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 12,
              }}
            >
              {[
                {
                  label: "Total Amount",
                  value: `${(+batch.totalAmount).toLocaleString()} USDC`,
                  color: "white",
                },
                {
                  label: "Recipients",
                  value: String(batch.totalPayouts),
                  color: "white",
                },
                {
                  label: "Completed",
                  value: `${batch.payouts.filter((p) => p.status === "COMPLETED").length}/${batch.totalPayouts}`,
                  color: "#34d399",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color,
                      fontFamily: "monospace",
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["#", "Recipient", "Amount", "Chain", "Status", "Circle ID"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 14px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.4)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {batch.payouts.map((p) => {
                    const Icon = STATUS_ICON[p.status];
                    return (
                      <tr
                        key={p.index}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          transition: "background 0.1s",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(255,255,255,0.02)")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td
                          style={{
                            padding: "11px 14px",
                            color: "rgba(255,255,255,0.5)",
                            fontFamily: "monospace",
                          }}
                        >
                          {p.index}
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            fontFamily: "monospace",
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          {p.recipient}
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            fontFamily: "monospace",
                            color: "white",
                            fontWeight: 600,
                          }}
                        >
                          {(+p.amount).toLocaleString()} USDC
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <span
                            className="badge badge-open"
                            style={{ fontSize: 11 }}
                          >
                            {p.destinationChain}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <span
                            className={`badge ${STATUS_BADGE[p.status] ?? "badge-queued"}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Icon
                              size={11}
                              style={p.status === "PROCESSING" ? { animation: "spin 1s linear infinite" } : undefined}
                            />
                            {p.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {p.circleTransferId?.slice(0, 16) || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create batch modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Batch Payout"
        maxWidth={640}
      >
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
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
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{ width: "100%" }}
              >
                <option>USDC</option>
                <option>EURC</option>
              </select>
            </div>
            <div
              style={{
                alignSelf: "flex-end",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
                fontFamily: "monospace",
                fontSize: 14,
                fontWeight: 700,
                color: "white",
                minWidth: 140,
                textAlign: "right",
              }}
            >
              {total.toLocaleString()} {token}
            </div>
          </div>

          {/* Recipients table */}
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 110px 36px",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {["Recipient Address", "Amount", "Chain", ""].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {recipients.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 110px 36px",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  className="input-glass"
                  placeholder="0x..."
                  value={r.address}
                  onChange={(e) => setRow(i, "address", e.target.value)}
                  style={{ width: "100%" }}
                />
                <input
                  className="input-glass"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={r.amount}
                  onChange={(e) => setRow(i, "amount", e.target.value)}
                  style={{ width: "100%" }}
                />
                <select
                  className="input-glass"
                  value={r.chain}
                  onChange={(e) => setRow(i, "chain", e.target.value)}
                  style={{ width: "100%" }}
                >
                  {CHAINS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={recipients.length === 1}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                    opacity: recipients.length === 1 ? 0.3 : 1,
                  }}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={addRow}
              style={{ marginTop: 4, width: "100%" }}
            >
              <Plus size={13} /> Add Recipient
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Requires ERC-20 approval for{" "}
            <strong style={{ color: "rgba(255,255,255,0.7)" }}>
              {total.toLocaleString()} {token}
            </strong>{" "}
            to the PayoutRouter contract.
          </div>
          {createStatus && (
            <div style={{ fontSize: 12, color: "rgba(165,180,252,0.8)" }}>
              {createStatus}
            </div>
          )}
          <div
            style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
          >
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
              disabled={creating || total === 0}
            >
              {creating ? (
                <RefreshCw
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <ArrowRightLeft size={14} />
              )}
              {creating
                ? "Creating\u2026"
                : `Create Batch (${total.toFixed(2)} ${token})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
