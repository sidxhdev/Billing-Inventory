import React, { useMemo, useState } from "react";
import { formatCurrency, formatNumber, stockStatusOf } from "../../utils/format";
import StockStatusBadge from "../inventory/StockStatusBadge";
import CartQuantityControl from "./CartQuantityControl";

export default function ProductSelector({ products, cart, onAdd, onQuantityChange }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  );

  const quantities = useMemo(() => {
    const map = {};
    cart.forEach((item) => {
      map[item.product_id] = item.quantity;
    });
    return map;
  }, [cart]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (!query) return true;
      return [product.name, product.sku, product.description, product.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [products, search, category]);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Available products</h2>
          <p className="card-subtitle">Add products to the cart. Stock is checked again at checkout.</p>
        </div>
        <span className="count-badge">{visibleProducts.length} products</span>
      </div>
      <div className="card-body">
        <div className="toolbar toolbar-wrap">
          <input
            className="input search-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products by name, SKU or category"
            aria-label="Search available products"
          />
          <select
            className="input select-input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter products by category"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="empty-state compact">
            <h3>No products found</h3>
            <p>Try a different search or add products from the inventory page.</p>
          </div>
        ) : (
          <div className="selector-grid">
            {visibleProducts.map((product) => {
              const status = stockStatusOf(product);
              const inCart = quantities[product.id] || 0;
              const available = Math.max(0, product.quantity - inCart);
              return (
                <article key={product.id} className="product-card">
                  <div className="product-card-head">
                    <div>
                      <h3 className="product-card-name">{product.name}</h3>
                      <span className="product-card-sku mono">{product.sku}</span>
                    </div>
                    <StockStatusBadge status={status} />
                  </div>
                  <div className="product-card-meta">
                    <span>{product.category || "General"}</span>
                    <span>
                      {formatNumber(product.quantity)} {product.unit} available
                    </span>
                  </div>
                  <div className="product-card-foot">
                    <span className="product-price">{formatCurrency(product.price)}</span>
                    {inCart > 0 ? (
                      <CartQuantityControl
                        product={product}
                        quantity={inCart}
                        onChange={onQuantityChange}
                        size="sm"
                      />
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onAdd(product)}
                        disabled={available <= 0}
                      >
                        {available <= 0 ? "No stock left" : "Add to cart"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
