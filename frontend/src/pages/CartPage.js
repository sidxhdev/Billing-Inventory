import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage, invoicesApi } from "../api";
import CartItems from "../components/cart/CartItems";
import CheckoutForm from "../components/cart/CheckoutForm";
import OrderSummary from "../components/cart/OrderSummary";
import ProductSelector from "../components/cart/ProductSelector";
import InvoicePreview from "../components/billing/InvoicePreview";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useStore } from "../context/StoreContext";
import {
  computeCartTotals,
  downloadBlob,
  makeIdempotencyKey,
  round2,
} from "../utils/format";

const EMPTY_CUSTOMER = {
  name: "",
  phone: "",
  address: "",
  gstin: "",
  business_name: "",
};

export default function CartPage() {
  const {
    cart,
    products,
    config,
    loadingProducts,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    refreshProducts,
    showToast,
  } = useStore();

  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const idempotencyKey = useRef(makeIdempotencyKey());

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const totals = useMemo(
    () => computeCartTotals(cart, config, Number(discount) || 0),
    [cart, config, discount]
  );

  const handleDiscountChange = (value) => {
    const numeric = Number(value) || 0;
    if (numeric > totals.subtotal) {
      setDiscount(String(totals.subtotal));
      return;
    }
    setDiscount(value);
  };

  const handlePaymentStatusChange = (status) => {
    setPaymentStatus(status);
    if (status === "paid") setAmountPaid(String(totals.total));
    if (status === "pending") setAmountPaid("0");
    if (status === "partially_paid") {
      const current = Number(amountPaid) || 0;
      setAmountPaid(current > 0 && current < totals.total ? String(current) : "0");
    }
  };

  const validateCheckout = () => {
    if (cart.length === 0) return "Add at least one product to the cart.";
    if (!customer.name.trim()) return "Customer name is required.";
    for (const item of cart) {
      const product = products.find(
        (candidate) => Number(candidate.id) === Number(item.product_id)
      );
      if (!product) return `${item.name} is no longer available. Remove it from the cart.`;
      if (item.quantity > product.quantity) {
        return `Only ${product.quantity} ${product.unit || "unit"} of ${product.name} are available.`;
      }
      if (item.quantity <= 0) return "Every cart item must have a quantity of at least 1.";
    }
    const paid = paymentStatus === "paid" ? totals.total : round2(Number(amountPaid) || 0);
    if (paymentStatus === "pending" && paid !== 0) {
      return "A pending invoice must have zero amount paid.";
    }
    if (paymentStatus === "partially_paid" && (paid <= 0 || paid >= totals.total)) {
      return "A partially paid invoice needs an amount greater than zero and less than the total.";
    }
    return "";
  };

  const handleCheckout = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validationError = validateCheckout();
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    const paid =
      paymentStatus === "paid" ? totals.total : round2(Number(amountPaid) || 0);

    setBusy(true);
    setError("");
    try {
      const invoice = await invoicesApi.checkout({
        items: cart.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          gstin: customer.gstin.trim(),
          business_name: customer.business_name.trim(),
        },
        discount: totals.discount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: paid,
        idempotency_key: idempotencyKey.current,
        notes: notes.trim() || null,
      });

      clearCart();
      setCompletedInvoice(invoice);
      setCustomer(EMPTY_CUSTOMER);
      setPaymentStatus("paid");
      setAmountPaid("0");
      setDiscount("0");
      setNotes("");
      idempotencyKey.current = makeIdempotencyKey();
      showToast(`Invoice ${invoice.invoice_number} created.`);
      await refreshProducts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = getErrorMessage(err, "Checkout failed. Please review the cart and try again.");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!completedInvoice) return;
    setDownloading(true);
    try {
      const blob = await invoicesApi.downloadPdf(completedInvoice.id);
      downloadBlob(blob, `${completedInvoice.invoice_number}.pdf`);
    } catch (err) {
      showToast(getErrorMessage(err, "Could not download the invoice PDF."), "error");
    } finally {
      setDownloading(false);
    }
  };

  const clearCartNow = () => {
    clearCart();
    setConfirmClear(false);
    setDiscount("0");
    setError("");
    showToast("Cart cleared.");
  };

  if (completedInvoice) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Checkout complete</h1>
            <p className="page-subtitle">
              Invoice {completedInvoice.invoice_number} has been created and the stock has been updated.
            </p>
          </div>
          <div className="page-actions">
            <Link className="btn btn-outline" to="/billing">
              View invoices
            </Link>
            <Link className="btn btn-primary" to={`/billing/${completedInvoice.id}`}>
              Open invoice
            </Link>
          </div>
        </div>

        <div className="success-panel">
          <div>
            <h2 className="success-title">Sale recorded</h2>
            <p className="success-text">
              The cart has been cleared. You can download the PDF, open the invoice, or start a new sale.
            </p>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-outline" onClick={handleDownload} disabled={downloading}>
              {downloading ? "Preparing PDF..." : "Download PDF"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCompletedInvoice(null)}>
              Start new sale
            </button>
          </div>
        </div>

        <InvoicePreview invoice={completedInvoice} config={config} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cart & Checkout</h1>
          <p className="page-subtitle">
            Build the sale, apply a discount, verify GST and record customer payment details.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" to="/inventory">
            Back to inventory
          </Link>
        </div>
      </div>

      <div className="cart-layout">
        <div className="stack">
          <ProductSelector products={products} cart={cart} onAdd={addToCart} />

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Cart items</h2>
                <p className="card-subtitle">Review quantities before checkout.</p>
              </div>
              <div className="page-actions">
                <span className="count-badge">{cart.length} lines</span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-ghost"
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear cart
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              <CartItems
                cart={cart}
                products={products}
                onQuantityChange={updateCartQuantity}
                onRemove={removeFromCart}
              />
            </div>
          </section>
        </div>

        <aside className="cart-sidebar">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Order summary</h2>
            </div>
            <div className="card-body">
              <OrderSummary
                totals={totals}
                config={config}
                discount={discount}
                onDiscountChange={handleDiscountChange}
              />
              <p className="summary-note">
                Configuration: GST {Number(config.gst_rate) || 0}% ({config.gst_mode === "igst" ? "IGST" : "CGST + SGST"}).
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Checkout</h2>
                <p className="card-subtitle">
                  {loadingProducts ? "Refreshing stock before checkout..." : "Enter customer and payment details."}
                </p>
              </div>
            </div>
            <div className="card-body">
              <CheckoutForm
                customer={customer}
                setCustomer={setCustomer}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentStatus={paymentStatus}
                setPaymentStatus={handlePaymentStatusChange}
                amountPaid={amountPaid}
                setAmountPaid={setAmountPaid}
                notes={notes}
                setNotes={setNotes}
                totals={totals}
                onSubmit={handleCheckout}
                busy={busy}
                disabled={cart.length === 0}
                error={error}
              />
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear cart"
        message="Remove all products from the cart? This does not affect inventory."
        confirmLabel="Clear cart"
        danger
        onConfirm={clearCartNow}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
