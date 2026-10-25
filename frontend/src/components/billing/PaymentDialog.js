import React, { useEffect, useState } from "react";
import { formatCurrency, paymentMethodLabel, paymentStatusLabel, round2 } from "../../utils/format";

const METHODS = ["cash", "upi", "card", "bank_transfer"];
const STATUSES = ["paid", "pending", "partially_paid"];

export default function PaymentDialog({ invoice, open, onClose, onSave }) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setPaymentMethod(invoice.payment_method || "cash");
    setPaymentStatus(invoice.payment_status || "paid");
    setAmountPaid(String(invoice.amount_paid ?? 0));
    setError("");
  }, [open, invoice]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open || !invoice) return null;

  const total = Number(invoice.total) || 0;

  const handleStatusChange = (status) => {
    setPaymentStatus(status);
    if (status === "paid") setAmountPaid(String(total));
    if (status === "pending") setAmountPaid("0");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const paid = paymentStatus === "paid" ? total : round2(Number(amountPaid) || 0);
    if (paymentStatus === "pending" && paid !== 0) {
      setError("A pending invoice must have zero amount paid.");
      return;
    }
    if (paymentStatus === "partially_paid" && (paid <= 0 || paid >= total)) {
      setError("A partially paid invoice needs an amount greater than zero and less than the total.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: paid,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Could not update the payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className="modal-title" id="payment-dialog-title">
            Record payment
          </h2>
          <p className="modal-subtitle">
            {invoice.invoice_number} | Total {formatCurrency(total)} | Balance{" "}
            {formatCurrency(invoice.balance_due)}
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <label className="field">
                <span>Payment method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {METHODS.map((method) => (
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
                  onChange={(event) => handleStatusChange(event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {paymentStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-span-2">
                <span>Amount paid</span>
                <input
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  value={paymentStatus === "paid" ? total : amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  disabled={paymentStatus === "paid"}
                />
              </label>
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
