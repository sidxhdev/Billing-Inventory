import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { configApi, getErrorMessage, productsApi } from "../api";

export const DEFAULT_CONFIG = {
  business_name: "My Business",
  business_address: "",
  business_phone: "",
  business_email: "",
  business_gstin: "",
  business_state: "",
  gst_rate: 0,
  gst_mode: "cgst_sgst",
  invoice_prefix: "INV",
  currency: "INR",
  payment_terms: "",
  thank_you_message: "Thank you for your business.",
  default_low_stock_threshold: 5,
  payment_methods: ["cash", "upi", "card", "bank_transfer"],
  payment_statuses: ["paid", "pending", "partially_paid"],
};

const CART_KEY = "inventory-billing-cart-v1";
const StoreContext = createContext(null);

function readStoredCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && Number.isInteger(Number(item.product_id)) && Number(item.quantity) > 0
    );
  } catch {
    return [];
  }
}

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [cart, setCart] = useState(readStoredCart);
  const [toast, setToast] = useState(null);
  const cartRef = useRef(cart);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToast({ id, message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const refreshProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await productsApi.list();
      setProducts(data);
      setProductsError("");

      const byId = new Map(data.map((product) => [Number(product.id), product]));
      const current = cartRef.current;
      let changed = false;
      const next = current.map((item) => {
        const product = byId.get(Number(item.product_id));
        if (!product) return item;
        const updated = {
          ...item,
          name: product.name,
          sku: product.sku,
          price: product.price,
          unit: product.unit,
          tax_rate: product.tax_rate,
        };
        if (
          updated.name !== item.name ||
          updated.sku !== item.sku ||
          updated.price !== item.price ||
          updated.unit !== item.unit ||
          updated.tax_rate !== item.tax_rate
        ) {
          changed = true;
        }
        return updated;
      });
      if (changed) {
        setCart(next);
        cartRef.current = next;
      }
      return data;
    } catch (error) {
      setProductsError(getErrorMessage(error, "Failed to load products."));
      return [];
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await configApi.get();
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  useEffect(() => {
    refreshProducts();
    refreshConfig();
  }, [refreshProducts, refreshConfig]);

  useEffect(() => {
    cartRef.current = cart;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable in private mode; the cart still works in memory.
    }
  }, [cart]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const addToCart = useCallback(
    (product, quantity = 1) => {
      if (!product) return false;
      const requested = Math.max(1, Math.floor(Number(quantity) || 1));
      const latest = cartRef.current;
      const existing = latest.find((item) => Number(item.product_id) === Number(product.id));
      const nextQuantity = (existing?.quantity || 0) + requested;
      const available = Number(product.quantity) || 0;
      if (available <= 0) {
        showToast(`${product.name} is out of stock.`, "error");
        return false;
      }
      if (nextQuantity > available) {
        showToast(
          `Only ${available} ${product.unit || "unit"} of ${product.name} available in stock.`,
          "error"
        );
        return false;
      }
      const cartItem = {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        unit: product.unit,
        tax_rate: product.tax_rate,
        quantity: nextQuantity,
      };
      const next = existing
        ? latest.map((item) =>
            Number(item.product_id) === Number(product.id) ? cartItem : item
          )
        : [...latest, cartItem];
      setCart(next);
      cartRef.current = next;
      showToast(`${product.name} added to cart.`);
      return true;
    },
    [showToast]
  );

  const updateCartQuantity = useCallback(
    (productId, quantity) => {
      const latest = cartRef.current;
      const product = products.find((item) => Number(item.id) === Number(productId));
      const available = product ? Number(product.quantity) || 0 : 0;
      let requested = Math.floor(Number(quantity) || 0);
      if (requested <= 0) {
        const next = latest.filter((item) => Number(item.product_id) !== Number(productId));
        setCart(next);
        cartRef.current = next;
        return;
      }
      if (requested > available) {
        requested = available;
        showToast(
          product
            ? `Only ${available} ${product.unit || "unit"} of ${product.name} available.`
            : "Requested quantity exceeds available stock.",
          "error"
        );
      }
      if (requested <= 0) {
        const next = latest.filter((item) => Number(item.product_id) !== Number(productId));
        setCart(next);
        cartRef.current = next;
        return;
      }
      const next = latest.map((item) => {
        if (Number(item.product_id) !== Number(productId)) return item;
        return {
          ...item,
          name: product?.name ?? item.name,
          sku: product?.sku ?? item.sku,
          price: product?.price ?? item.price,
          unit: product?.unit ?? item.unit,
          tax_rate: product?.tax_rate ?? item.tax_rate,
          quantity: requested,
        };
      });
      setCart(next);
      cartRef.current = next;
    },
    [products, showToast]
  );

  const removeFromCart = useCallback((productId) => {
    const next = cartRef.current.filter(
      (item) => Number(item.product_id) !== Number(productId)
    );
    setCart(next);
    cartRef.current = next;
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    cartRef.current = [];
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const value = {
    products,
    loadingProducts,
    productsError,
    config,
    cart,
    cartCount,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    refreshProducts,
    refreshConfig,
    toast,
    showToast,
    dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside a StoreProvider");
  }
  return context;
}
