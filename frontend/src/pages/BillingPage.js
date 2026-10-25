import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage, invoicesApi } from "../api";
import InvoiceActions from "../components/billing/InvoiceActions";
import InvoiceDetails from "../components/billing/InvoiceDetails";
import InvoiceTable from "../components/billing/InvoiceTable";
import PaymentDialog from "../components/billing/PaymentDialog";
import { useStore } from "../context/StoreContext";
import {
  downloadBlob,
  formatCurrency,
  formatNumber,
  paymentMethodLabel,
} from "../utils/format";

const PAGE_SIZE = 10;
const EMPTY_FILTERS = {
  q: "",
  payment_status: "all",
  payment_method: "all",
  date_from: "",
  date_to: "",
};

export default function BillingPage() {
  const { config, showToast } = useStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [formFilters, setFormFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const previewRef = useRef(null);

  const loadInvoices = useCallback(async (activeFilters) => {
    setLoading(true);
    const params = {};
    if (activeFilters.q.trim()) params.q = activeFilters.q.trim();
    if (activeFilters.payment_status !== "all") {
      params.payment_status = activeFilters.payment_status;
    }
    if (activeFilters.payment_method !== "all") {
      params.payment_method = activeFilters.payment_method;
    }
    if (activeFilters.date_from) params.date_from = activeFilters.date_from;
    if (activeFilters.date_to) params.date_to = activeFilters.date_to;

    try {
      const data = await invoicesApi.list(params);
      setInvoices(data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load invoices."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices(filters);
  }, [filters, loadInvoices]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleInvoices = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    return invoices.reduce(
      (acc, invoice) => {
        acc.totalInvoiced += Number(invoice.total) || 0;
        acc.totalPaid += Number(invoice.amount_paid) || 0;
        acc.outstanding += Number(invoice.balance_due) || 0;
        if (invoice.payment_status !== "paid") acc.unpaidCount += 1;
        return acc;
      },
      { totalInvoiced: 0, totalPaid: 0, outstanding: 0, unpaidCount: 0 }
    );
  }, [invoices]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    setFilters({ ...formFilters });
  };

  const handleReset = () => {
    setFormFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    window.setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleDownload = async (invoice) => {
    setDownloadingId(invoice.id);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);
      downloadBlob(blob, `${invoice.invoice_number}.pdf`);
    } catch (err) {
      showToast(getErrorMessage(err, "Could not download the invoice PDF."), "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSavePayment = async (payload) => {
    if (!paymentInvoice) return;
    try {
      const updated = await invoicesApi.updatePayment(paymentInvoice.id, payload);
      showToast(`Payment updated for ${updated.invoice_number}.`);
      setSelectedInvoice((current) =>
        current && current.id === updated.id ? updated : current
      );
      await loadInvoices(filters);
    } catch (err) {
      throw new Error(getErrorMessage(err, "Could not update the payment."));
    }
  };

  const hasFilters =
    filters.q ||
    filters.payment_status !== "all" ||
    filters.payment_method !== "all" ||
    filters.date_from ||
    filters.date_to;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="page-subtitle">
            Search past invoices, review payment status and download PDF copies.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => loadInvoices(filters)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Invoices in view</span>
          <span className="stat-value">{formatNumber(invoices.length)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total invoiced</span>
          <span className="stat-value">{formatCurrency(stats.totalInvoiced)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Amount received</span>
          <span className="stat-value">{formatCurrency(stats.totalPaid)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Outstanding</span>
          <span className="stat-value stat-warning">{formatCurrency(stats.outstanding)}</span>
          <span className="stat-footnote">{formatNumber(stats.unpaidCount)} unpaid invoices</span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Filters</h2>
        </div>
        <div className="card-body">
          <form className="filter-grid" onSubmit={handleFilterSubmit}>
            <label className="field field-span-2">
              <span>Search</span>
              <input
                type="search"
                value={formFilters.q}
                onChange={(event) =>
                  setFormFilters((current) => ({ ...current, q: event.target.value }))
                }
                placeholder="Invoice number, customer name or phone"
              />
            </label>
            <label className="field">
              <span>Payment status</span>
              <select
                value={formFilters.payment_status}
                onChange={(event) =>
                  setFormFilters((current) => ({
                    ...current,
                    payment_status: event.target.value,
                  }))
                }
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially paid</option>
              </select>
            </label>
            <label className="field">
              <span>Payment method</span>
              <select
                value={formFilters.payment_method}
                onChange={(event) =>
                  setFormFilters((current) => ({
                    ...current,
                    payment_method: event.target.value,
                  }))
                }
              >
                <option value="all">All methods</option>
                <option value="cash">{paymentMethodLabel("cash")}</option>
                <option value="upi">{paymentMethodLabel("upi")}</option>
                <option value="card">{paymentMethodLabel("card")}</option>
                <option value="bank_transfer">{paymentMethodLabel("bank_transfer")}</option>
              </select>
            </label>
            <label className="field">
              <span>From date</span>
              <input
                type="date"
                value={formFilters.date_from}
                onChange={(event) =>
                  setFormFilters((current) => ({ ...current, date_from: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>To date</span>
              <input
                type="date"
                value={formFilters.date_to}
                onChange={(event) =>
                  setFormFilters((current) => ({ ...current, date_to: event.target.value }))
                }
              />
            </label>
            <div className="filter-actions">
              <button type="submit" className="btn btn-primary">
                Apply filters
              </button>
              <button type="button" className="btn btn-outline" onClick={handleReset}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          <button type="button" className="link-button" onClick={() => loadInvoices(filters)}>
            Retry
          </button>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Invoice history</h2>
            <p className="card-subtitle">
              {hasFilters ? "Showing filtered results." : "All invoices, newest first."}
            </p>
          </div>
          <span className="count-badge">{invoices.length} invoices</span>
        </div>
        <div className="card-body">
          <InvoiceTable
            invoices={visibleInvoices}
            totalCount={invoices.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onView={handleView}
            onDownload={handleDownload}
            onRecordPayment={setPaymentInvoice}
            downloadingId={downloadingId}
            selectedId={selectedInvoice?.id}
            loading={loading}
          />
        </div>
      </section>

      {selectedInvoice && (
        <section className="card invoice-card" ref={previewRef}>
          <div className="card-head">
            <div>
              <h2 className="card-title">Invoice preview</h2>
              <p className="card-subtitle">
                {selectedInvoice.invoice_number} | {selectedInvoice.customer_name || "Walk-in customer"}
              </p>
            </div>
            <InvoiceActions
              invoice={selectedInvoice}
              downloading={downloadingId === selectedInvoice.id}
              onDownload={() => handleDownload(selectedInvoice)}
              onRecordPayment={() => setPaymentInvoice(selectedInvoice)}
            />
          </div>
          <div className="card-body">
            <InvoiceDetails invoice={selectedInvoice} config={config} />
          </div>
        </section>
      )}

      <PaymentDialog
        open={Boolean(paymentInvoice)}
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onSave={handleSavePayment}
      />
    </div>
  );
}
