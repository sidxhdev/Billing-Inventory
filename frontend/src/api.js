import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  timeout: 90000,
});

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || item.message || String(item))
      .join(", ");
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (error?.code === "ECONNABORTED") {
    return "The request timed out. The server may still be starting. Please try again.";
  }
  if ([502, 503, 504].includes(error?.response?.status)) {
    return "The server is starting up or unavailable. Please try again in a moment.";
  }
  if (error?.message === "Network Error") {
    return "Cannot reach the server. Check that the backend is running.";
  }
  return error?.message || fallback;
}

export const productsApi = {
  list: (params) => api.get("/products/", { params }).then((res) => res.data),
  get: (id) => api.get(`/products/${id}`).then((res) => res.data),
  create: (payload) => api.post("/products/", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/products/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/products/${id}`).then((res) => res.data),
  stats: () => api.get("/products/stats").then((res) => res.data),
  categories: () => api.get("/products/categories").then((res) => res.data),
};

export const invoicesApi = {
  list: (params) => api.get("/invoices/", { params }).then((res) => res.data),
  get: (id) => api.get(`/invoices/${id}`).then((res) => res.data),
  checkout: (payload) => api.post("/invoices/checkout", payload).then((res) => res.data),
  updatePayment: (id, payload) =>
    api.patch(`/invoices/${id}/payment`, payload).then((res) => res.data),
  downloadPdf: (id) =>
    api.get(`/invoices/${id}/pdf`, { responseType: "blob" }).then((res) => res.data),
};

export const configApi = {
  get: () => api.get("/config").then((res) => res.data),
};
