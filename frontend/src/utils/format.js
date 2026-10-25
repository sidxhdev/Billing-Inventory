const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

export const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
};

export const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
};

export const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

export const stockStatusOf = (product) => {
  if (!product || product.quantity <= 0) return "out_of_stock";
  if (product.quantity <= (product.low_stock_threshold || 0)) return "low_stock";
  return "in_stock";
};

export const stockStatusLabel = (status) =>
  ({ in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock" }[status] ||
  "Unknown");

export const paymentStatusLabel = (status) =>
  ({
    paid: "Paid",
    pending: "Pending",
    partially_paid: "Partially paid",
  }[status] || "Unknown");

export const paymentMethodLabel = (method) =>
  ({
    cash: "Cash",
    upi: "UPI",
    card: "Card",
    bank_transfer: "Bank transfer",
  }[method] || "Cash");

export const paymentStatusClass = (status) =>
  ({
    paid: "badge badge-success",
    pending: "badge badge-warning",
    partially_paid: "badge badge-info",
  }[status] || "badge badge-neutral");

export const stockStatusClass = (status) =>
  ({
    in_stock: "badge badge-success",
    low_stock: "badge badge-warning",
    out_of_stock: "badge badge-danger",
  }[status] || "badge badge-neutral");

export function computeCartTotals(cart, config = {}, discount = 0) {
  const subtotal = round2(
    cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)
  );
  const discountValue = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal));
  const taxableAmount = round2(subtotal - discountValue);
  const ratio = subtotal > 0 ? taxableAmount / subtotal : 0;
  const defaultRate = Number(config.gst_rate) || 0;

  let tax = 0;
  const lines = cart.map((item) => {
    const lineSubtotal = round2((Number(item.price) || 0) * (Number(item.quantity) || 0));
    const rate =
      item.tax_rate === null || item.tax_rate === undefined
        ? defaultRate
        : Number(item.tax_rate) || 0;
    const lineTax = round2(lineSubtotal * ratio * (rate / 100));
    tax = round2(tax + lineTax);
    return {
      ...item,
      lineSubtotal,
      taxRate: rate,
      lineTax,
      lineTotal: round2(lineSubtotal + lineTax),
    };
  });

  const cgst = config.gst_mode === "igst" ? 0 : round2(tax / 2);
  const sgst = config.gst_mode === "igst" ? 0 : round2(tax - cgst);
  const igst = config.gst_mode === "igst" ? tax : 0;
  const total = round2(taxableAmount + tax);

  return {
    lines,
    subtotal,
    discount: discountValue,
    taxableAmount,
    tax,
    cgst,
    sgst,
    igst,
    total,
  };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(number) {
  if (number < 20) return ONES[number];
  const [tens, ones] = [Math.floor(number / 10), number % 10];
  return `${TENS[tens]} ${ONES[ones]}`.trim();
}

function indianWords(number) {
  if (number === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(number / 10000000);
  number %= 10000000;
  const lakh = Math.floor(number / 100000);
  number %= 100000;
  const thousand = Math.floor(number / 1000);
  number %= 1000;
  const hundred = Math.floor(number / 100);
  number %= 100;
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (number) parts.push(twoDigits(number));
  return parts.join(" ");
}

export function amountInWords(value) {
  const numeric = round2(value);
  let rupees = Math.floor(Math.abs(numeric));
  let paise = Math.round((Math.abs(numeric) - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  let words = `Rupees ${indianWords(rupees)}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  words += " Only";
  return numeric < 0 ? `Minus ${words}` : words;
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
