import React from "react";

export default function CartQuantityControl({
  product,
  quantity,
  onChange,
  size = "md",
}) {
  const available = Number(product.quantity) || 0;
  const atStockLimit = quantity >= available;
  const className = size === "sm" ? "qty-control qty-control-sm" : "qty-control";

  return (
    <div className={className} role="group" aria-label={`Quantity for ${product.name}`}>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(product.id, quantity - 1)}
        aria-label={`Decrease quantity of ${product.name}`}
      >
        -
      </button>
      <span className="qty-value" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(product.id, quantity + 1)}
        disabled={atStockLimit}
        aria-label={`Increase quantity of ${product.name}`}
      >
        +
      </button>
    </div>
  );
}
