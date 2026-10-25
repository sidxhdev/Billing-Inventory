import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage, productsApi } from "../api";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ProductForm from "../components/inventory/ProductForm";
import ProductTable from "../components/inventory/ProductTable";
import { useStore } from "../context/StoreContext";
import { formatCurrency, formatNumber, stockStatusOf } from "../utils/format";

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const {
    products,
    loadingProducts,
    productsError,
    cart,
    addToCart,
    updateCartQuantity,
    refreshProducts,
    showToast,
  } = useStore();
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const formRef = useRef(null);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  );

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce((sum, product) => sum + (product.quantity || 0), 0);
    const lowStock = products.filter((product) => stockStatusOf(product) === "low_stock").length;
    const outOfStock = products.filter(
      (product) => stockStatusOf(product) === "out_of_stock"
    ).length;
    const inventoryValue = products.reduce(
      (sum, product) => sum + (product.price || 0) * (product.quantity || 0),
      0
    );
    return { totalProducts, totalUnits, lowStock, outOfStock, inventoryValue };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = products.filter((product) => {
      if (query) {
        const haystack = [
          product.name,
          product.sku,
          product.description,
          product.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (category !== "all" && product.category !== category) return false;
      if (stockFilter !== "all" && stockStatusOf(product) !== stockFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "quantity_asc":
          return a.quantity - b.quantity;
        case "quantity_desc":
          return b.quantity - a.quantity;
        case "sku_asc":
          return (a.sku || "").localeCompare(b.sku || "");
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [products, search, category, stockFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, category, stockFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (product) => {
    setEditing(product);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSaved = async () => {
    setEditing(null);
    await refreshProducts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await productsApi.remove(deleteTarget.id);
      showToast("Product deleted.");
      if (editing?.id === deleteTarget.id) setEditing(null);
      setDeleteTarget(null);
      await refreshProducts();
    } catch (error) {
      showToast(getErrorMessage(error, "Could not delete the product."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setStockFilter("all");
    setSort("name_asc");
  };

  const hasFilters =
    search || category !== "all" || stockFilter !== "all" || sort !== "name_asc";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            Manage products, stock levels, pricing and category details.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={refreshProducts}
            disabled={loadingProducts}
          >
            {loadingProducts ? "Refreshing..." : "Refresh"}
          </button>
          <Link className="btn btn-primary" to="/cart">
            Open cart
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total products</span>
          <span className="stat-value">{formatNumber(stats.totalProducts)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Units in stock</span>
          <span className="stat-value">{formatNumber(stats.totalUnits)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low stock</span>
          <span className="stat-value stat-warning">{formatNumber(stats.lowStock)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Out of stock</span>
          <span className="stat-value stat-danger">{formatNumber(stats.outOfStock)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Inventory value</span>
          <span className="stat-value">{formatCurrency(stats.inventoryValue)}</span>
        </div>
      </div>

      {productsError && (
        <div className="alert alert-error" role="alert">
          {productsError}
          <button type="button" className="link-button" onClick={refreshProducts}>
            Retry
          </button>
        </div>
      )}

      <div className="inventory-layout">
        <section className="card" ref={formRef}>
          <div className="card-head">
            <div>
              <h2 className="card-title">{editing ? "Edit product" : "Add product"}</h2>
              <p className="card-subtitle">
                {editing
                  ? `Updating ${editing.name} (${editing.sku}).`
                  : "Create a product with pricing and stock details."}
              </p>
            </div>
          </div>
          <div className="card-body">
            <ProductForm
              product={editing}
              categories={categories}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Products</h2>
              <p className="card-subtitle">
                Search, filter and sort the inventory before adding products to a cart.
              </p>
            </div>
            <span className="count-badge">{filteredProducts.length} items</span>
          </div>
          <div className="card-body">
            <div className="toolbar toolbar-wrap">
              <input
                className="input search-input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, SKU, category or description"
                aria-label="Search products"
              />
              <select
                className="input select-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="input select-input"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                aria-label="Filter by stock status"
              >
                <option value="all">All stock</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
              <select
                className="input select-input"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort products"
              >
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="quantity_asc">Stock: low to high</option>
                <option value="quantity_desc">Stock: high to low</option>
                <option value="sku_asc">SKU: A to Z</option>
              </select>
              {hasFilters && (
                <button type="button" className="btn btn-sm btn-outline" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <ProductTable
              products={visibleProducts}
              totalCount={filteredProducts.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onAddToCart={addToCart}
              onQuantityChange={updateCartQuantity}
              cart={cart}
              editingId={editing?.id}
              loading={loadingProducts}
            />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.name} (${deleteTarget.sku})? Existing invoices keep their saved product details, but this product will no longer be available for new sales.`
            : ""
        }
        confirmLabel="Delete product"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
