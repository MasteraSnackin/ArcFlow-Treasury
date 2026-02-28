import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  GitBranch,
  ArrowRightLeft,
  Zap,
  Wallet,
  Circle,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

const NAV = [
  {
    section: "Treasury",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Operations",
    items: [
      { to: "/escrow",  label: "Escrow & Disputes", icon: ShieldCheck },
      { to: "/payroll", label: "Payroll & Vesting",  icon: GitBranch },
      { to: "/payouts", label: "Payout Batches",      icon: ArrowRightLeft },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/escrow":    "Escrow & Disputes",
  "/payroll":   "Payroll & Vesting",
  "/payouts":   "Payout Batches",
};

const ARC_CHAIN_ID = "0x4cef52"; // 5042002 decimal

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
};

function getEth(): EthProvider | undefined {
  return (window as unknown as { ethereum?: EthProvider }).ethereum;
}

export default function Layout() {
  const location = useLocation();
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "loading">("loading");
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = () => {
      fetch("http://localhost:3000/status")
        .then((r) => (r.ok ? setApiStatus("online") : setApiStatus("offline")))
        .catch(() => setApiStatus("offline"));
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Detect chain on mount and listen for changes
  useEffect(() => {
    const eth = getEth();
    if (!eth) return;

    const handleChainChanged = (id: unknown) => {
      setChainId(String(id));
    };

    eth.request({ method: "eth_chainId" })
      .then((id) => setChainId(String(id)))
      .catch(() => {/* not yet connected */});

    eth.on("chainChanged", handleChainChanged);
    return () => eth.removeListener("chainChanged", handleChainChanged);
  }, []);

  const connectWallet = async () => {
    const eth = getEth();
    if (eth) {
      try {
        const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
        setWalletAddr(accounts[0]);
        const id = await eth.request({ method: "eth_chainId" }) as string;
        setChainId(id);
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        if (code !== 4001) {
          // 4001 = user explicitly rejected; anything else is unexpected
          toast.error("Wallet connection failed. Check MetaMask and try again.");
        }
      }
    } else {
      // Simulate for demo (no MetaMask installed)
      setWalletAddr("0x1234567890abcdef1234567890abcdef12345678");
    }
  };

  const switchNetwork = async () => {
    const eth = getEth();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 4902) {
        toast.error("Arc Testnet not found in wallet. Please add it manually.");
      } else if (code !== 4001) {
        // 4001 = user rejected the switch; anything else is unexpected
        toast.error("Failed to switch network. Please switch manually in MetaMask.");
      }
    }
  };

  const wrongNetwork = walletAddr !== null && chainId !== null && chainId !== ARC_CHAIN_ID;

  const shortAddr = walletAddr
    ? `${walletAddr.slice(0, 6)}\u2026${walletAddr.slice(-4)}`
    : null;
  const pageTitle = PAGE_TITLES[location.pathname] ?? "ArcFlow";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          minHeight: "100vh",
          flexShrink: 0,
          background:
            "linear-gradient(180deg, rgba(17,17,24,0.95) 0%, rgba(10,10,15,0.98) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "24px 16px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(99,102,241,0.4)",
                flexShrink: 0,
              }}
            >
              <Zap size={18} color="white" fill="white" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "white",
                  lineHeight: 1,
                }}
              >
                ArcFlow
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.08em",
                  marginTop: 2,
                }}
              >
                TREASURY
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            padding: "12px 10px",
            overflowY: "auto",
          }}
        >
          {NAV.map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  padding: "0 6px 6px",
                }}
              >
                {section}
              </div>
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-item${isActive ? " active" : ""}`
                  }
                  style={{ display: "flex", marginBottom: 2 }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  <ChevronRight
                    size={13}
                    style={{ opacity: 0.3, marginLeft: "auto" }}
                  />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#34d399",
                boxShadow: "0 0 6px #34d399",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontWeight: 500,
              }}
            >
              Arc Testnet
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.2)",
                marginLeft: "auto",
              }}
            >
              5042002
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div
        style={{
          marginLeft: 240,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            background: "rgba(10,10,15,0.85)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "white" }}
          >
            {pageTitle}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* API Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 8,
                background:
                  apiStatus === "online"
                    ? "rgba(16,185,129,0.1)"
                    : apiStatus === "offline"
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  apiStatus === "online"
                    ? "rgba(16,185,129,0.2)"
                    : apiStatus === "offline"
                    ? "rgba(239,68,68,0.2)"
                    : "rgba(255,255,255,0.08)"
                }`,
              }}
            >
              {apiStatus === "online" ? (
                <Circle size={7} color="#34d399" fill="#34d399" />
              ) : apiStatus === "offline" ? (
                <AlertCircle size={13} color="#f87171" />
              ) : (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.3)",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color:
                    apiStatus === "online"
                      ? "#34d399"
                      : apiStatus === "offline"
                      ? "#f87171"
                      : "rgba(255,255,255,0.4)",
                }}
              >
                {apiStatus === "loading"
                  ? "Checking..."
                  : apiStatus === "online"
                  ? "API Online"
                  : "API Offline"}
              </span>
            </div>

            {/* Wallet */}
            {walletAddr ? (
              <button className="btn-secondary" style={{ gap: 6 }}>
                <Wallet size={13} />
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {shortAddr}
                </span>
              </button>
            ) : (
              <button className="btn-primary" onClick={connectWallet}>
                <Wallet size={14} /> Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Network mismatch banner */}
        {wrongNetwork && (
          <div
            style={{
              background: "rgba(245,158,11,0.12)",
              borderBottom: "1px solid rgba(245,158,11,0.25)",
              padding: "10px 28px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#fbbf24", flex: 1 }}>
              Wrong network detected. ArcFlow requires{" "}
              <strong>Arc Testnet (Chain ID 5042002)</strong>.
            </span>
            <button
              onClick={switchNetwork}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#fbbf24",
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 7,
                padding: "5px 12px",
                cursor: "pointer",
              }}
            >
              Switch Network
            </button>
          </div>
        )}

        {/* Page content */}
        <main
          style={{ flex: 1, padding: "28px", overflowY: "auto" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
