import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import EscrowPage from "./pages/EscrowPage";
import PayrollPage from "./pages/PayrollPage";
import PayoutsPage from "./pages/PayoutsPage";
import DemoPage from "./pages/DemoPage";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#18181f",
            color: "white",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            borderRadius: "12px",
            fontSize: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          },
          success: { iconTheme: { primary: "#34d399", secondary: "#18181f" } },
          error:   { iconTheme: { primary: "#f87171", secondary: "#18181f" } },
          duration: 4000,
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/escrow" element={<EscrowPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/payouts" element={<PayoutsPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
