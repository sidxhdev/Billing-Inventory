import React from "react";
import CartQuantityControl from "../cart/CartQuantityControl";
import { formatCurrency, formatNumber, stockStatusOf } from "../../utils/format";
import StockStatusBadge from "./StockStatusBadge";

export default function ProductTable({
  products,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
  onAddToCart,
  onQuantityChange,
  cart = [],
  editingId,
  loading,
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  if (loading) {
    return <div className="loading-state">Loading inventory...</div>;
  }

  return (
    <div>
      <div className="table-wrap table-wrap-inventory">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th className="align-right">Selling price</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  No products match the current filters.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const status = stockStatusOf(product);
                const cartQuantity =
                  cart.find((item) => Number(item.product_id) === Number(product.id))
                    ?.quantity || 0;
                return (
                  <tr
                    key={product.id}
                    className={`${status === "low_stock" ? "row-low-stock" : ""} ${
                      status === "out_of_stock" ? "row-out-stock" : ""
                    } ${editingId === product.id ? "row-editing" : ""}`}
                  >
                    <td className="mono nowrap">{product.sku}</td>
                    <td>
                      <div className="product-cell">
                        <span className="product-name">{product.name}</span>
                        {product.description && (
                          <span className="product-meta" title={product.description}>
                            {product.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{product.category || "General"}</td>
                    <td className="align-right mono nowrap">
                      {formatCurrency(product.price)}
                    </td>
                    <td>
                      <div className="stock-cell">
                        <span className="stock-quantity">
                          {formatNumber(product.quantity)} {product.unit}
                        </span>
                        <StockStatusBadge status={status} />
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        {cartQuantity > 0 ? (
                          <CartQuantityControl
                            product={product}
                            quantity={cartQuantity}
                            onChange={onQuantityChange}
                            size="sm"
                          />
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => onAddToCart(product)}
                            disabled={product.quantity <= 0}
                          >
                            Add to cart
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => onEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-ghost"
                          onClick={() => onDelete(product)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
