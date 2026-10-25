import {
  amountInWords,
  computeCartTotals,
  makeIdempotencyKey,
  paymentMethodLabel,
  paymentStatusLabel,
  stockStatusOf,
} from "./format";

const cart = [
  { product_id: 1, name: "Widget", price: 100, quantity: 2, tax_rate: null },
  { product_id: 2, name: "Gadget", price: 50, quantity: 2, tax_rate: null },
];

describe("computeCartTotals", () => {
  test("applies CGST and SGST using the configured rate", () => {
    const totals = computeCartTotals(cart, { gst_rate: 18, gst_mode: "cgst_sgst" }, 0);
    expect(totals.subtotal).toBe(300);
    expect(totals.taxableAmount).toBe(300);
    expect(totals.tax).toBe(54);
    expect(totals.cgst).toBe(27);
    expect(totals.sgst).toBe(27);
    expect(totals.igst).toBe(0);
    expect(totals.total).toBe(354);
  });

  test("applies discount before tax", () => {
    const totals = computeCartTotals(cart, { gst_rate: 18, gst_mode: "cgst_sgst" }, 50);
    expect(totals.discount).toBe(50);
    expect(totals.taxableAmount).toBe(250);
    expect(totals.tax).toBe(45);
    expect(totals.total).toBe(295);
  });

  test("uses a product tax override when present", () => {
    const mixed = [
      { product_id: 1, name: "Widget", price: 100, quantity: 2, tax_rate: null },
      { product_id: 2, name: "Gadget", price: 50, quantity: 2, tax_rate: 5 },
    ];
    const totals = computeCartTotals(mixed, { gst_rate: 18, gst_mode: "cgst_sgst" }, 0);
    expect(totals.tax).toBe(41);
    expect(totals.total).toBe(341);
  });

  test("uses IGST when configured", () => {
    const totals = computeCartTotals(cart, { gst_rate: 18, gst_mode: "igst" }, 0);
    expect(totals.cgst).toBe(0);
    expect(totals.sgst).toBe(0);
    expect(totals.igst).toBe(54);
  });

  test("clamps discount to the subtotal", () => {
    const totals = computeCartTotals(cart, { gst_rate: 0 }, 5000);
    expect(totals.discount).toBe(300);
    expect(totals.taxableAmount).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe("amountInWords", () => {
  test("converts rupees and paise to Indian words", () => {
    expect(amountInWords(1234.5)).toBe(
      "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only"
    );
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });
});

describe("stockStatusOf", () => {
  test("classifies stock levels", () => {
    expect(stockStatusOf({ quantity: 0, low_stock_threshold: 3 })).toBe("out_of_stock");
    expect(stockStatusOf({ quantity: 3, low_stock_threshold: 3 })).toBe("low_stock");
    expect(stockStatusOf({ quantity: 4, low_stock_threshold: 3 })).toBe("in_stock");
  });
});

describe("labels and helpers", () => {
  test("returns human-readable labels", () => {
    expect(paymentStatusLabel("partially_paid")).toBe("Partially paid");
    expect(paymentMethodLabel("bank_transfer")).toBe("Bank transfer");
  });

  test("creates an idempotency key", () => {
    expect(makeIdempotencyKey()).toEqual(expect.any(String));
    expect(makeIdempotencyKey().length).toBeGreaterThan(8);
  });
});
