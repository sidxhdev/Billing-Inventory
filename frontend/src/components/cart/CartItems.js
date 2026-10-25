import React from "react";
import { formatCurrency, formatNumber } from "../../utils/format";

export default function CartItems({ cart, products, onQuantityChange, onRemove }) {
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  if (cart.length === 0) {
    return (
      <div className="empty-state compact">
        <h3>Cart is empty</h3>
        <p>Add products from the selector to start a sale.</p>
      </div>
    );
  }

  return (
    <div className="cart-list">
      {cart.map((item) => {
        const product = productMap.get(Number(item.product_id));
        const available = product ? Number(product.quantity) || 0 : 0;
        const exceedsStock = item.quantity > available;
        return (
          <div className="cart-line" key={item.product_id}>
            <div className="cart-line-main">
              <div>
                <span className="product-name">{item.name}</span>
                <span className="product-meta mono">{item.sku || "No SKU"}</span>
              </div>
              <span className="cart-unit-price">
                {formatCurrency(item.price)} / {item.unit || "pcs"}
              </span>
            </div>

            <div className="cart-line-controls">
              <div className="qty-control" aria-label={`Quantity for ${item.name}`}>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => onQuantityChange(item.product_id, item.quantity - 1)}
                  aria-label={`Decrease quantity of ${item.name}`}
                >
                  -
                </button>
                <input
                  className="qty-input"
                  type="number"
                  min="1"
                  max={available || 1}
                  value={item.quantity}
                  onChange={(event) =>
                    onQuantityChange(item.product_id, Number(event.target.value))
                  }
                  aria-label={`Quantity for ${item.name}`}
                />
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => onQuantityChange(item.product_id, item.quantity + 1)}
                  aria-label={`Increase quantity of ${item.name}`}
                >
                  +
                </button>
              </div>
              <span className="line-total">
                {formatCurrency((Number(item.price) || 0) * item.quantity)}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-danger-ghost"
                onClick={() => onRemove(item.product_id)}
              >
                Remove
              </button>
            </div>

            <div className="cart-line-stock">
              {exceedsStock ? (
                <span className="text-danger">
                  Only {formatNumber(available)} {item.unit || "unit"} available. Reduce the quantity.
                </span>
              ) : (
                <span className="text-muted">
                  {formatNumber(available)} {item.unit || "unit"} available in stock
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
