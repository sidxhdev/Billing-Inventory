import React, { useEffect, useState } from "react";
import { getErrorMessage, productsApi } from "../../api";
import { useStore } from "../../context/StoreContext";

const EMPTY_FORM = {
  name: "",
  sku: "",
  description: "",
  category: "General",
  purchase_price: "",
  price: "",
  quantity: "",
  unit: "pcs",
  low_stock_threshold: "5",
  tax_rate: "",
};

function toForm(product) {
  if (!product) return { ...EMPTY_FORM };
  return {
    name: product.name || "",
    sku: product.sku || "",
    description: product.description || "",
    category: product.category || "General",
    purchase_price: String(product.purchase_price ?? 0),
    price: String(product.price ?? 0),
    quantity: String(product.quantity ?? 0),
    unit: product.unit || "pcs",
    low_stock_threshold: String(product.low_stock_threshold ?? 5),
    tax_rate: product.tax_rate === null || product.tax_rate === undefined ? "" : String(product.tax_rate),
  };
}

export default function ProductForm({ product, categories = [], onSaved, onCancel }) {
  const { showToast } = useStore();
  const [form, setForm] = useState(() => toForm(product));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(product));
    setError("");
  }, [product]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "Product name is required.";
    const purchasePrice = Number(form.purchase_price || 0);
    const sellingPrice = Number(form.price || 0);
    const quantity = Number(form.quantity || 0);
    const threshold = Number(form.low_stock_threshold || 0);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      return "Purchase price must be zero or greater.";
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      return "Selling price must be zero or greater.";
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      return "Quantity must be a whole number of zero or greater.";
    }
    if (!Number.isInteger(threshold) || threshold < 0) {
      return "Low-stock threshold must be a whole number of zero or greater.";
    }
    if (form.tax_rate !== "" && (Number(form.tax_rate) < 0 || Number(form.tax_rate) > 100)) {
      return "Tax rate must be between 0 and 100.";
    }
    if (!form.unit.trim()) return "Unit is required.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() ? form.sku.trim().toUpperCase() : null,
      description: form.description.trim(),
      category: form.category.trim() || "General",
      purchase_price: Number(form.purchase_price || 0),
      price: Number(form.price || 0),
      quantity: Number(form.quantity || 0),
      unit: form.unit.trim() || "pcs",
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      tax_rate: form.tax_rate === "" ? null : Number(form.tax_rate),
    };

    try {
      const saved = product
        ? await productsApi.update(product.id, payload)
        : await productsApi.create(payload);
      showToast(product ? "Product updated." : "Product added to inventory.");
      if (!product) setForm({ ...EMPTY_FORM });
      onSaved?.(saved);
    } catch (err) {
      const message = getErrorMessage(err, "Could not save the product.");
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="field field-span-2">
          <span>Product name</span>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Cotton shirt"
            required
          />
        </label>

        <label className="field">
          <span>SKU / product code</span>
          <input
            name="sku"
            value={form.sku}
            onChange={handleChange}
            placeholder="Auto-generated if blank"
          />
        </label>

        <label className="field">
          <span>Category</span>
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            list="category-options"
            placeholder="General"
          />
          <datalist id="category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <label className="field field-span-2">
          <span>Description</span>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            placeholder="Short product description"
          />
        </label>

        <label className="field">
          <span>Purchase price</span>
          <input
            type="number"
            name="purchase_price"
            value={form.purchase_price}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </label>

        <label className="field">
          <span>Selling price</span>
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
        </label>

        <label className="field">
          <span>Stock quantity</span>
          <input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
            min="0"
            step="1"
            placeholder="0"
            required
          />
        </label>

        <label className="field">
          <span>Unit</span>
          <input
            name="unit"
            value={form.unit}
            onChange={handleChange}
            list="unit-options"
            required
          />
          <datalist id="unit-options">
            {["pcs", "kg", "g", "l", "ml", "box", "pack", "dozen"].map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Low-stock alert at</span>
          <input
            type="number"
            name="low_stock_threshold"
            value={form.low_stock_threshold}
            onChange={handleChange}
            min="0"
            step="1"
          />
        </label>

        <label className="field">
          <span>Tax rate (%)</span>
          <input
            type="number"
            name="tax_rate"
            value={form.tax_rate}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.01"
            placeholder="Use configured GST"
          />
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : product ? "Save changes" : "Add product"}
        </button>
        {product && (
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
            Cancel edit
          </button>
        )}
      </div>
    </form>
  );
}
