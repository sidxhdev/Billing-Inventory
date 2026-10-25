import React from "react";
import {
  formatCurrency,
  formatDateTime,
  paymentStatusClass,
  paymentStatusLabel,
} from "../../utils/format";

export default function InvoiceTable({
  invoices,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onView,
  onDownload,
  onRecordPayment,
  downloadingId,
  selectedId,
  loading,
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  if (loading) {
    return <div className="loading-state">Loading invoices...</div>;
  }

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="align-right">Items</th>
              <th className="align-right">Total</th>
              <th className="align-right">Paid</th>
              <th className="align-right">Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  No invoices match the current filters.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={selectedId === invoice.id ? "row-selected" : ""}
                >
                  <td className="mono nowrap">{invoice.invoice_number}</td>
                  <td className="nowrap">{formatDateTime(invoice.created_at)}</td>
                  <td>
                    <div className="product-cell">
                      <span className="product-name">
                        {invoice.customer_name || "Walk-in customer"}
                      </span>
                      {invoice.customer_business_name && (
                        <span className="product-meta">{invoice.customer_business_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="align-right mono">{invoice.items?.length || 0}</td>
                  <td className="align-right mono nowrap">{formatCurrency(invoice.total)}</td>
                  <td className="align-right mono nowrap">{formatCurrency(invoice.amount_paid)}</td>
                  <td className="align-right mono nowrap">
                    {formatCurrency(invoice.balance_due)}
                  </td>
                  <td>
                    <span className={paymentStatusClass(invoice.payment_status)}>
                      {paymentStatusLabel(invoice.payment_status)}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => onView(invoice)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => onDownload(invoice)}
                        disabled={downloadingId === invoice.id}
                      >
                        {downloadingId === invoice.id ? "PDF..." : "PDF"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onRecordPayment(invoice)}
                      >
                        Payment
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="pagination">
          <span className="pagination-info">
            Showing {start}-{end} of {totalCount}
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="pagination-page">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
