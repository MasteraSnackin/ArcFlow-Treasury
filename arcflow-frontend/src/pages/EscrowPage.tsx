import { useState } from "react";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  Search,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonLine } from "../components/Skeleton";
import {
  getEscrowContract,
  getEscrowContractReadOnly,
  approveIfNeeded,
  TOKEN_ADDRESSES,
  parseToken,
  formatToken,
  ZeroAddress,
} from "../lib/contracts";

type EscrowStatus = "OPEN" | "DISPUTED" | "RELEASED" | "REFUNDED";

type Escrow = {
  id: string;
  payer: string;
  payee: string;
  token: string;
  amount: string;
  expiry: number;
  arbitrator: string;
  status: EscrowStatus;
  disputed: boolean;
};


type MyEscrow = { id: string; payee: string; amount: string; token: string; createdAt: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TimeRemaining({ expiry }: { expiry: number }) {
  const remaining = Math.max(0, expiry - Date.now() / 1000);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (remaining <= 0)
    return (
      <span style={{ color: "#34d399" }}>Expired – ready to release</span>
    );
  return (
    <span>
      {h}h {m}m remaining
    </span>
  );
}

export default function EscrowPage() {
  const [formData, setFormData] = useState({
    payee: "",
    token: "USDC",
    amount: "",
    expiryHours: "24",
    arbitrator: "",
  });
  const [creating, setCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDispute, setConfirmDispute] = useState(false);
  const [myEscrows, setMyEscrows] = useState<MyEscrow[]>(() => {
    try { return JSON.parse(localStorage.getItem("arcflow_my_escrows") ?? "[]"); }
    catch { return []; }
  });

  const set = (k: string, v: string) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.payee || !formData.amount) {
      toast.error("Please fill all required fields.");
      return;
    }
    setCreating(true);
    setCreateStatus("");
    try {
      const tokenAddr = TOKEN_ADDRESSES[formData.token];
      const escrowContract = await getEscrowContract();
      const escrowAddr = import.meta.env.VITE_ARC_ESCROW_ADDRESS as string;
      const amountBigInt = parseToken(formData.amount);
      const expiryTimestamp = Math.floor(Date.now() / 1000) + Number(formData.expiryHours) * 3600;
      const arbitrator = formData.arbitrator || ZeroAddress;

      await approveIfNeeded(tokenAddr, escrowAddr, amountBigInt, setCreateStatus);

      setCreateStatus("Sending transaction…");
      const tx = await escrowContract.createEscrow(
        formData.payee,
        tokenAddr,
        amountBigInt,
        BigInt(expiryTimestamp),
        arbitrator
      );
      setCreateStatus("Waiting for confirmation…");
      const receipt = await tx.wait();

      // Parse EscrowCreated event to get the real on-chain escrow ID.
      let newId = String(myEscrows.length);
      if (receipt) {
        for (const log of receipt.logs) {
          try {
            const parsed = escrowContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed?.name === "EscrowCreated") {
              newId = parsed.args[0].toString();
              break;
            }
          } catch { /* not this event */ }
        }
      }

      setShowCreateModal(false);
      const newItem: MyEscrow = {
        id: newId,
        payee: formData.payee,
        amount: formData.amount,
        token: formData.token,
        createdAt: new Date().toISOString(),
      };
      const updatedEscrows = [newItem, ...myEscrows];
      setMyEscrows(updatedEscrows);
      localStorage.setItem("arcflow_my_escrows", JSON.stringify(updatedEscrows));
      toast.success(`Escrow #${newId} created!`);
      doLookup(newId);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4001) {
        const msg =
          (err as { shortMessage?: string }).shortMessage ??
          (err as { message?: string }).message ??
          "Failed to create escrow.";
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
    setEscrow(null);
    setNotFound(false);
    setConfirmDispute(false);
    try {
      const contract = await getEscrowContractReadOnly();
      const data = await contract.escrows(BigInt(id)) as [
        string, string, string, bigint, bigint, string, boolean, boolean, boolean
      ];
      const [payer, payee, token, amount, expiry, arbitrator, disputed, released, refunded] = data;
      if (payer === ZeroAddress) { setNotFound(true); return; }
      const status: EscrowStatus =
        released ? "RELEASED" :
        refunded ? "REFUNDED" :
        disputed ? "DISPUTED" :
        "OPEN";
      const tokenName =
        Object.entries(TOKEN_ADDRESSES).find(
          ([, addr]) => addr.toLowerCase() === token.toLowerCase()
        )?.[0] ?? `${token.slice(0, 6)}\u2026${token.slice(-4)}`;
      const short = (addr: string) =>
        addr && addr !== ZeroAddress ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : "None";
      setEscrow({
        id,
        payer: short(payer),
        payee: short(payee),
        token: tokenName,
        amount: formatToken(amount),
        expiry: Number(expiry),
        arbitrator: short(arbitrator),
        status,
        disputed,
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
    if (!escrow) return;
    setActionLoading(action);
    try {
      const id = BigInt(escrow.id);
      const contract = await getEscrowContract();
      const tx =
        action === "dispute"        ? await contract.raiseDispute(id)         :
        action === "release"        ? await contract.autoRelease(id)          :
        action === "resolve-payee"  ? await contract.resolveDispute(id, true)  :
        action === "resolve-payer"  ? await contract.resolveDispute(id, false) :
        null;
      if (!tx) return;
      await tx.wait();
      await doLookup(escrow.id);
      if (action === "dispute")       toast.success("Dispute raised on Escrow #" + escrow.id);
      else if (action === "release")  toast.success("Escrow #" + escrow.id + " auto-released to payee.");
      else if (action === "resolve-payee") toast.success("Dispute resolved — paid to payee.");
      else if (action === "resolve-payer") toast.success("Dispute resolved — refunded to payer.");
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

  const STATUS_COLOR: Record<string, string> = {
    OPEN: "badge-open",
    DISPUTED: "badge-disputed",
    RELEASED: "badge-done",
    REFUNDED: "badge-refunded",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.6,
          }}
        >
          Create on-chain escrows with auto-release and dispute resolution.
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={15} /> New Escrow
        </button>
      </div>

      {/* Two columns */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        {/* Look up escrow */}
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
            <Search size={16} color="rgba(255,255,255,0.5)" /> Look Up Escrow
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
                Escrow ID
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
              {loading ? "Looking up\u2026" : "Look Up"}
            </button>
          </form>

          {!loading && !escrow && !notFound && (
            <EmptyState
              icon={<Search size={22} />}
              title="No escrow loaded"
              description="Enter an escrow ID above to view details and available actions."
            />
          )}

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
              <SkeletonLine h={12} w="80%" />
              <SkeletonLine h={12} w="45%" />
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
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#f87171",
                  }}
                >
                  Escrow not found
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(239,68,68,0.7)",
                    marginTop: 3,
                  }}
                >
                  No escrow with ID &quot;{lookupId}&quot; exists. Check the ID
                  and try again.
                </div>
              </div>
            </div>
          )}

          {escrow && !loading && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
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
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "white",
                    }}
                  >
                    Escrow #{escrow.id}
                  </span>
                  <span
                    className={`badge ${STATUS_COLOR[escrow.status]}`}
                  >
                    {escrow.status}
                  </span>
                </div>
                {(
                  [
                    ["Payer", escrow.payer],
                    ["Payee", escrow.payee],
                    ["Token", escrow.token],
                    ["Amount", `${escrow.amount} ${escrow.token}`],
                    ["Arbitrator", escrow.arbitrator],
                  ] as [string, string][]
                ).map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
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
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Expires
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <TimeRemaining expiry={escrow.expiry} />
                  </span>
                </div>
              </div>

              {/* Actions */}
              {escrow.status === "OPEN" && !escrow.disputed && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {confirmDispute ? (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#f87171", fontWeight: 500 }}>
                        This action is irreversible. The escrow will enter dispute resolution and an arbitrator must resolve it.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => { setConfirmDispute(false); doAction("dispute"); }}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "dispute" ? (
                            <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <AlertTriangle size={13} />
                          )}
                          {actionLoading === "dispute" ? "Raising\u2026" : "Confirm Dispute"}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => setConfirmDispute(false)}
                          disabled={!!actionLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-danger"
                      onClick={() => setConfirmDispute(true)}
                      disabled={!!actionLoading}
                    >
                      <AlertTriangle size={13} />
                      Raise Dispute
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={() => doAction("release")}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "release" ? (
                      <RefreshCw
                        size={13}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <Clock size={13} />
                    )}
                    {actionLoading === "release"
                      ? "Releasing\u2026"
                      : "Auto Release (after expiry)"}
                  </button>
                </div>
              )}
              {escrow.status === "DISPUTED" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      fontStyle: "italic",
                    }}
                  >
                    Arbitrator actions:
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => doAction("resolve-payee")}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "resolve-payee" ? (
                      <RefreshCw
                        size={13}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <CheckCircle size={13} />
                    )}
                    Resolve \u2192 Pay Payee
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => doAction("resolve-payer")}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "resolve-payer" ? (
                      <RefreshCw
                        size={13}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    Resolve \u2192 Refund Payer
                  </button>
                </div>
              )}
              {(escrow.status === "RELEASED" ||
                escrow.status === "REFUNDED") && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.15)",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <CheckCircle size={15} color="#34d399" />
                  <span
                    style={{
                      fontSize: 13,
                      color: "#34d399",
                      fontWeight: 500,
                    }}
                  >
                    Escrow{" "}
                    {escrow.status === "RELEASED"
                      ? "released to payee"
                      : "refunded to payer"}
                    .
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* My Escrows */}
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
            <FileText size={16} color="rgba(255,255,255,0.5)" /> My Escrows
          </div>
          {myEscrows.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title="No escrows yet"
              description="Create an escrow and it will appear here for quick access."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {myEscrows.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => doLookup(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 6px",
                    borderBottom: i < myEscrows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
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
                    <FileText size={15} color="#818cf8" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                      Escrow #{item.id}
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
                      {item.payee || "—"} · {item.amount} {item.token}
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

      {/* Create Escrow Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Escrow"
      >
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
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
              Payee Address *
            </label>
            <input
              className="input-glass"
              placeholder="0x..."
              value={formData.payee}
              onChange={(e) => set("payee", e.target.value)}
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
                Amount *
              </label>
              <input
                className="input-glass"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="100.00"
                value={formData.amount}
                onChange={(e) => set("amount", e.target.value)}
                style={{ width: "100%" }}
                required
              />
            </div>
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
              Expiry (hours from now)
            </label>
            <input
              className="input-glass"
              type="number"
              min="1"
              placeholder="24"
              value={formData.expiryHours}
              onChange={(e) => set("expiryHours", e.target.value)}
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
              Arbitrator Address (optional)
            </label>
            <input
              className="input-glass"
              placeholder="0x... (leave empty for no arbitrator)"
              value={formData.arbitrator}
              onChange={(e) => set("arbitrator", e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {createStatus && (
            <div style={{ fontSize: 12, color: "rgba(165,180,252,0.8)", marginTop: 2 }}>
              {createStatus}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreateModal(false)}
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
                <ShieldCheck size={14} />
              )}
              {creating ? "Creating\u2026" : "Create Escrow"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
