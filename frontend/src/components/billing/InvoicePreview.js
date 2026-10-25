import React from "react";
import {
  amountInWords,
  formatCurrency,
  formatDateTime,
  formatNumber,
  paymentMethodLabel,
  paymentStatusClass,
  paymentStatusLabel,
} from "../../utils/format";

export default function InvoicePreview({ invoice, config = {} }) {
  if (!invoice) return null;

  const items = invoice.items || [];
  const businessName = invoice.business_name || config.business_name || "My Business";
  const businessAddress = invoice.business_address || config.business_address || "";
  const businessPhone = invoice.business_phone || config.business_phone || "";
  const businessEmail = invoice.business_email || config.business_email || "";
  const businessGstin = invoice.business_gstin || config.business_gstin || "";
  const hasTax = Number(invoice.tax) > 0;
  const isIgst = Number(invoice.igst) > 0;

  return (
    <article className="invoice-sheet" aria-label={`Invoice ${invoice.invoice_number}`}>
      <header className="invoice-head">
        <div className="invoice-business">
          <h2>{businessName}</h2>
          {businessAddress && <p className="invoice-address">{businessAddress}</p>}
          <p>
            {businessPhone && <span>{businessPhone}</span>}
            {businessPhone && businessEmail && <span> | </span>}
            {businessEmail && <span>{businessEmail}</span>}
          </p>
          {businessGstin && <p className="invoice-gstin">GSTIN: {businessGstin}</p>}
        </div>
        <div className="invoice-title-block">
          <span className="invoice-kind">{hasTax ? "TAX INVOICE" : "INVOICE"}</span>
          <span className="invoice-number">{invoice.invoice_number}</span>
          <span className="invoice-date">{formatDateTime(invoice.created_at)}</span>
          <span className={paymentStatusClass(invoice.payment_status)}>
            {paymentStatusLabel(invoice.payment_status)}
          </span>
        </div>
      </header>

      <div className="invoice-parties">
        <div>
          <span className="invoice-label">Billed to</span>
          <p className="invoice-customer-name">
            {invoice.customer_business_name || invoice.customer_name || "Walk-in customer"}
          </p>
          {invoice.customer_business_name && invoice.customer_name && (
            <p className="invoice-muted">Contact: {invoice.customer_name}</p>
          )}
          {invoice.customer_address && <p className="invoice-muted">{invoice.customer_address}</p>}
          {invoice.customer_phone && <p className="invoice-muted">Phone: {invoice.customer_phone}</p>}
          {invoice.customer_gstin && <p className="invoice-muted">GSTIN: {invoice.customer_gstin}</p>}
        </div>
        <div>
          <span className="invoice-label">Payment</span>
          <p>{paymentMethodLabel(invoice.payment_method)}</p>
          <p className="invoice-muted">Paid: {formatCurrency(invoice.amount_paid)}</p>
          <p className="invoice-muted">Balance: {formatCurrency(invoice.balance_due)}</p>
        </div>
      </div>

      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th className="align-right">#</th>
              <th>Item</th>
              <th>SKU</th>
              <th className="align-right">Qty</th>
              <th className="align-right">Rate</th>
              <th className="align-right">Tax</th>
              <th className="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || `${item.product_name}-${index}`}>
                <td className="align-right mono">{index + 1}</td>
                <td>
                  {item.product_name}
                  <span className="invoice-muted invoice-unit"> / {item.unit || "pcs"}</span>
                </td>
                <td className="mono">{item.sku || "-"}</td>
                <td className="align-right mono">
                  {formatNumber(item.quantity)} {item.unit || "pcs"}
                </td>
                <td className="align-right mono">{formatCurrency(item.unit_price)}</td>
                <td className="align-right mono">
                  {formatCurrency(item.tax_amount)}
                  <span className="invoice-muted"> ({Number(item.tax_rate) || 0}%)</span>
                </td>
                <td className="align-right mono">{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-bottom">
        <div className="invoice-notes">
          {invoice.notes && (
            <>
              <span className="invoice-label">Notes</span>
              <p className="invoice-muted">{invoice.notes}</p>
            </>
          )}
          <span className="invoice-label">Amount in words</span>
          <p className="invoice-words">{amountInWords(invoice.total)}</p>
          {config.payment_terms && (
            <>
              <span className="invoice-label">Terms</span>
              <p className="invoice-muted">{config.payment_terms}</p>
            </>
          )}
        </div>

        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>Subtotal</span>
            <span className="mono">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="invoice-total-row">
              <span>Discount</span>
              <span className="mono">-{formatCurrency(invoice.discount)}</span>
            </div>
          )}
          <div className="invoice-total-row">
            <span>Taxable amount</span>
            <span className="mono">{formatCurrency(invoice.taxable_amount)}</span>
          </div>
          {isIgst ? (
            <div className="invoice-total-row">
              <span>IGST</span>
              <span className="mono">{formatCurrency(invoice.igst)}</span>
            </div>
          ) : (
            <>
              {Number(invoice.cgst) > 0 && (
                <div className="invoice-total-row">
                  <span>CGST</span>
                  <span className="mono">{formatCurrency(invoice.cgst)}</span>
                </div>
              )}
              {Number(invoice.sgst) > 0 && (
                <div className="invoice-total-row">
                  <span>SGST</span>
                  <span className="mono">{formatCurrency(invoice.sgst)}</span>
                </div>
              )}
            </>
          )}
          <div className="invoice-total-row invoice-grand">
            <span>Total</span>
            <span className="mono">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="invoice-total-row">
            <span>Amount paid</span>
            <span className="mono">{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="invoice-total-row invoice-balance">
            <span>Balance due</span>
            <span className="mono">{formatCurrency(invoice.balance_due)}</span>
          </div>
        </div>
      </div>

      <footer className="invoice-footer">
        <span>{config.thank_you_message || "Thank you for your business."}</span>
        <span>Computer-generated invoice.</span>
      </footer>
    </article>
  );
}
