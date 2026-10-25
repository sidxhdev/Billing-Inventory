import React from "react";
import { formatCurrency } from "../../utils/format";

export default function OrderSummary({
  totals,
  config,
  discount,
  onDiscountChange,
  showDiscountInput = true,
}) {
  const taxLabel =
    config.gst_mode === "igst"
      ? "IGST"
      : `${config.gst_mode === "cgst_sgst" ? "CGST + SGST" : "Tax"}`;

  return (
    <div className="summary">
      <div className="summary-row">
        <span>Subtotal</span>
        <span className="mono">{formatCurrency(totals.subtotal)}</span>
      </div>

      {showDiscountInput && (
        <label className="summary-row summary-discount">
          <span>Discount</span>
          <span className="discount-input-wrap">
            <span className="mono">₹</span>
            <input
              className="input input-compact"
              type="number"
              min="0"
              max={totals.subtotal}
              step="0.01"
              value={discount}
              onChange={(event) => onDiscountChange(event.target.value)}
              aria-label="Invoice discount"
            />
          </span>
        </label>
      )}

      <div className="summary-row">
        <span>Taxable amount</span>
        <span className="mono">{formatCurrency(totals.taxableAmount)}</span>
      </div>

      {totals.tax > 0 ? (
        <>
          {config.gst_mode === "igst" ? (
            <div className="summary-row">
              <span>IGST</span>
              <span className="mono">{formatCurrency(totals.igst)}</span>
            </div>
          ) : (
            <>
              <div className="summary-row">
                <span>CGST</span>
                <span className="mono">{formatCurrency(totals.cgst)}</span>
              </div>
              <div className="summary-row">
                <span>SGST</span>
                <span className="mono">{formatCurrency(totals.sgst)}</span>
              </div>
            </>
          )}
          <div className="summary-row summary-tax">
            <span>{taxLabel}</span>
            <span className="mono">{formatCurrency(totals.tax)}</span>
          </div>
        </>
      ) : (
        <p className="summary-note">No GST is configured for this sale.</p>
      )}

      <div className="summary-divider" />
      <div className="summary-row summary-grand">
        <span>Total payable</span>
        <span className="mono">{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
}
