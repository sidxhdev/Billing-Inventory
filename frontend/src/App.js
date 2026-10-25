import React, { useEffect } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";
import { StoreProvider, useStore } from "./context/StoreContext";
import Toast from "./components/ui/Toast";
import InventoryPage from "./pages/InventoryPage";
import CartPage from "./pages/CartPage";
import BillingPage from "./pages/BillingPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function navClass({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

function AppShell() {
  const { cartCount, config } = useStore();

  return (
    <div className="app">
      <header className="header no-print">
        <div className="header-brand">
          <span className="header-mark" aria-hidden="true">
            IB
          </span>
          <div className="header-brand-text">
            <span className="header-title">{config.business_name || "Inventory & Billing"}</span>
            <span className="header-subtitle">Inventory and billing workspace</span>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main navigation">
          <NavLink to="/inventory" className={navClass}>
            Inventory
          </NavLink>
          <NavLink to="/cart" className={navClass}>
            Cart
            {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
          </NavLink>
          <NavLink to="/billing" className={navClass}>
            Billing
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </main>

      <footer className="app-footer no-print">
        <span>{config.business_name || "Inventory & Billing"}</span>
        <span>
          {config.business_phone ? `${config.business_phone} | ` : ""}
          GST configured at {Number(config.gst_rate) || 0}%
        </span>
      </footer>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTop />
        <AppShell />
      </StoreProvider>
    </BrowserRouter>
  );
}
