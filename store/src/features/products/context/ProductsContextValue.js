import { createContext } from "react";

export const ProductsContext = createContext({
  products: [],
  isLoading: true,
  isError: false,
  addProduct: () => {},
  updateProduct: () => {},
  deleteProduct: () => {},
  toggleProductStock: () => {},
  applyDiscount: () => {},
  searchProducts: () => [],
});
