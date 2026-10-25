import React from "react";
import { formatCurrency, paymentMethodLabel, paymentStatusLabel } from "../../utils/format";

const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer"];
const PAYMENT_STATUSES = ["paid", "pending", "partially_paid"];

export default function CheckoutForm({
  customer,
  setCustomer,
  paymentMethod,
  setPaymentMethod,
  paymentStatus,
  setPaymentStatus,
  amountPaid,
  setAmountPaid,
  notes,
  setNotes,
  totals,
  onSubmit,
  busy,
  disabled,
  error,
}) {
  const paid = Number(amountPaid) || 0;
  const balance = Math.max(0, totals.total - paid);

  const updateCustomer = (field, value) => {
    setCustomer((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form-section">
        <h3 className="form-section-title">Customer details</h3>
        <div className="form-grid">
          <label className="field">
            <span>Customer name</span>
            <input
              value={customer.name}
              onChange={(event) => updateCustomer("name", event.target.value)}
              placeholder="Required"
              required
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              value={customer.phone}
              onChange={(event) => updateCustomer("phone", event.target.value)}
              placeholder="Optional"
              inputMode="tel"
            />
          </label>
          <label className="field field-span-2">
            <span>Billing address</span>
            <textarea
              value={customer.address}
              onChange={(event) => updateCustomer("address", event.target.value)}
              placeholder="Street, city, state, PIN code"
              rows={2}
            />
          </label>
          <label className="field">
            <span>Customer GSTIN</span>
            <input
              value={customer.gstin}
              onChange={(event) => updateCustomer("gstin", event.target.value.toUpperCase())}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            <span>Business name</span>
            <input
              value={customer.business_name}
              onChange={(event) => updateCustomer("business_name", event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Payment</h3>
        <div className="form-grid">
          <label className="field">
            <span>Payment method</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Payment status</span>
            <select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
            >
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {paymentStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount paid</span>
            <input
              type="number"
              min="0"
              max={totals.total}
              step="0.01"
              value={paymentStatus === "paid" ? totals.total : amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              disabled={paymentStatus === "paid"}
            />
            <span className="help-text">
              {paymentStatus === "paid"
                ? "The full invoice amount is marked as paid."
                : `Balance due ${formatCurrency(balance)}.`}
            </span>
          </label>
          <label className="field">
            <span>Balance due</span>
            <input value={formatCurrency(paymentStatus === "paid" ? 0 : balance)} readOnly />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Optional note for the invoice"
          />
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || disabled}>
        {busy ? "Processing..." : disabled ? "Add products to continue" : "Review checkout"}
      </button>
    </form>
  );
}
