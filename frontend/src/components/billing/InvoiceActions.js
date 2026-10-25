import React from "react";
import { Link } from "react-router-dom";

export default function InvoiceActions({
  invoice,
  onRecordPayment,
  onDownload,
  downloading = false,
  onPrint,
  showBack = false,
}) {
  if (!invoice) return null;

  return (
    <div className="invoice-actions no-print">
      {showBack && (
        <Link className="btn btn-outline" to="/billing">
          Back to invoices
        </Link>
      )}
      <button
        type="button"
        className="btn btn-outline"
        onClick={onDownload}
        disabled={downloading || !onDownload}
      >
        {downloading ? "Preparing PDF..." : "Download PDF"}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={onPrint || (() => window.print())}
      >
        Print
      </button>
      <button type="button" className="btn btn-primary" onClick={onRecordPayment}>
        Record payment
      </button>
    </div>
  );
}
