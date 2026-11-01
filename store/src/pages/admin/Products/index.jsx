import { useMerchantPanel } from "../../../application/providers/MerchantPanelProvider";
import React from "react";
import { ProductsManager } from "../../../features/products/components/ProductsManager";
export default function Products() {
  const { base } = useMerchantPanel();
  return <ProductsManager base={`${base}/products`} />;
}
