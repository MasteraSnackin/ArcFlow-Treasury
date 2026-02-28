import { Link } from "react-router-dom";
import { ShieldCheck, GitBranch, ArrowRightLeft, Zap, Globe, Lock, FlaskConical } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    color: "#6366f1",
    title: "Smart Escrow & Disputes",
    desc: "Lock USDC/EURC/USYC with configurable expiry and arbitrator. Raise disputes on-chain; auto-release after timeout.",
  },
  {
    icon: GitBranch,
    color: "#8b5cf6",
    title: "Payroll & Vesting Streams",
    desc: "Linear vesting with cliff — employer funds upfront, employee withdraws what's vested. Revoke with pro-rata split.",
  },
  {
    icon: ArrowRightLeft,
    color: "#06b6d4",
    title: "Cross-Chain Batch Payouts",
    desc: "Multi-recipient batches in one transaction. Each recipient picks their destination chain. Circle routes settlement.",
  },
];

const STATS = [
  { value: "31", label: "Contract tests" },
  { value: "61", label: "Backend tests" },
  { value: "3", label: "Arc contracts" },
  { value: "5", label: "Supported chains" },
];

const PILLARS = [
  { icon: Zap, color: "#f59e0b", label: "Sub-second finality", desc: "Arc's stablecoin-native L1" },
  { icon: Globe, color: "#10b981", label: "Circle CCTP", desc: "Cross-chain USDC settlement" },
  { icon: Lock, color: "#6366f1", label: "Fully on-chain", desc: "All obligations auditable on Arc" },
];

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "white",
        fontFamily: "Inter, sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 48px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          background: "rgba(10,10,15,0.8)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>ArcFlow Treasury</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            to="/demo"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FlaskConical size={14} />
            Try Demo
          </Link>
          <Link
            to="/dashboard"
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "96px 24px 80px",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            borderRadius: 999,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.25)",
            fontSize: 12,
            color: "#a5b4fc",
            fontWeight: 500,
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#6366f1",
              boxShadow: "0 0 6px rgba(99,102,241,0.8)",
            }}
          />
          Built on Arc · Encode × Arc Hackathon 2026
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.08,
            margin: "0 0 20px",
            letterSpacing: "-0.03em",
          }}
        >
          Stablecoin Treasury
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Operations, Unified
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "rgba(255,255,255,0.5)",
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.6,
          }}
        >
          Escrows, vesting streams, and cross-chain batch payouts in USDC/EURC — all on Arc,
          all on-chain, settled via Circle.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/dashboard"
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              boxShadow: "0 0 32px rgba(99,102,241,0.35)",
            }}
          >
            Open Dashboard
          </Link>
          <Link
            to="/demo"
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FlaskConical size={16} />
            Interactive Demo
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "center",
          gap: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {STATS.map(({ value, label }, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              maxWidth: 200,
              textAlign: "center",
              padding: "28px 24px",
              borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 32,
                fontWeight: 800,
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      {/* Feature cards */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "80px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 700,
              margin: "0 0 12px",
              letterSpacing: "-0.02em",
            }}
          >
            Three primitives, one system
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto" }}>
            Every treasury workflow your team needs, settled on-chain via Arc and Circle.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div
              key={title}
              style={{
                padding: 28,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(20px)",
                transition: "border-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = `${color}40`)}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Icon size={22} color={color} />
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {title}
              </h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Arc + Circle */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(99,102,241,0.05)",
          borderTop: "1px solid rgba(99,102,241,0.12)",
          borderBottom: "1px solid rgba(99,102,241,0.12)",
          padding: "64px 24px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 36px)",
              fontWeight: 700,
              marginBottom: 12,
              letterSpacing: "-0.02em",
            }}
          >
            Built for Arc & Circle
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.45)",
              maxWidth: 520,
              margin: "0 auto 40px",
              lineHeight: 1.6,
            }}
          >
            Arc is the stablecoin-native obligation ledger. Circle is the execution engine
            that moves USDC across chains.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            {PILLARS.map(({ icon: Icon, color, label, desc }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 22px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={color} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "80px 24px 100px",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(22px, 3vw, 36px)",
            fontWeight: 700,
            marginBottom: 12,
            letterSpacing: "-0.02em",
          }}
        >
          Ready to explore?
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 32,
          }}
        >
          No wallet needed for the demo. Connect MetaMask for live transactions on Arc Testnet.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/demo"
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 0 32px rgba(99,102,241,0.3)",
            }}
          >
            <FlaskConical size={16} />
            Try the Demo
          </Link>
          <Link
            to="/dashboard"
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Connect Wallet & Go Live
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          ArcFlow Treasury · Encode × Arc Hackathon 2026
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a
            href="https://github.com/MasteraSnackin/ArcFlow-Treasury"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
          >
            GitHub
          </a>
          <a
            href="https://testnet.arcscan.app"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
          >
            Arc Explorer
          </a>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
          >
            Testnet Faucet
          </a>
        </div>
      </footer>
    </div>
  );
}
