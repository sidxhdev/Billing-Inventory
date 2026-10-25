import React from "react";
import InvoicePreview from "./InvoicePreview";

export default function InvoiceDetails({ invoice, config }) {
  if (!invoice) {
    return (
      <div className="empty-state">
        <h3>Select an invoice</h3>
        <p>Choose an invoice from the list to preview it here.</p>
      </div>
    );
  }

  return (
    <div className="invoice-detail">
      <InvoicePreview invoice={invoice} config={config} />
    </div>
  );
}
