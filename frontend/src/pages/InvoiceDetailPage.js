import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage, invoicesApi } from "../api";
import InvoiceActions from "../components/billing/InvoiceActions";
import InvoiceDetails from "../components/billing/InvoiceDetails";
import PaymentDialog from "../components/billing/PaymentDialog";
import { useStore } from "../context/StoreContext";
import { downloadBlob } from "../utils/format";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const { config, showToast } = useStore();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoicesApi.get(invoiceId);
      setInvoice(data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this invoice."));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  useEffect(() => {
    if (invoice?.invoice_number) {
      document.title = `${invoice.invoice_number} | Billing`;
    }
    return () => {
      document.title = "Inventory & Billing";
    };
  }, [invoice?.invoice_number]);

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);
      downloadBlob(blob, `${invoice.invoice_number}.pdf`);
    } catch (err) {
      showToast(getErrorMessage(err, "Could not download the invoice PDF."), "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleSavePayment = async (payload) => {
    if (!invoice) return;
    try {
      const updated = await invoicesApi.updatePayment(invoice.id, payload);
      setInvoice(updated);
      showToast(`Payment updated for ${updated.invoice_number}.`);
    } catch (err) {
      throw new Error(getErrorMessage(err, "Could not update the payment."));
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Invoice</h1>
            <p className="page-subtitle">The invoice could not be displayed.</p>
          </div>
        </div>
        <div className="alert alert-error" role="alert">
          {error || "Invoice not found."}
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" to="/billing">
            Back to invoices
          </Link>
          <button type="button" className="btn btn-primary" onClick={loadInvoice}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">{invoice.invoice_number}</h1>
          <p className="page-subtitle">
            Invoice detail, payment status and printable PDF copy.
          </p>
        </div>
        <InvoiceActions
          invoice={invoice}
          showBack
          downloading={downloading}
          onDownload={handleDownload}
          onRecordPayment={() => setPaymentOpen(true)}
        />
      </div>

      <section className="card invoice-card">
        <div className="card-body">
          <InvoiceDetails invoice={invoice} config={config} />
        </div>
      </section>

      <PaymentDialog
        open={paymentOpen}
        invoice={invoice}
        onClose={() => setPaymentOpen(false)}
        onSave={handleSavePayment}
      />
    </div>
  );
}
