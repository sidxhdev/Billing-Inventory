import React from "react";
import { stockStatusClass, stockStatusLabel, stockStatusOf } from "../../utils/format";

export default function StockStatusBadge({ product, status }) {
  const resolved = status || stockStatusOf(product);
  return <span className={stockStatusClass(resolved)}>{stockStatusLabel(resolved)}</span>;
}
