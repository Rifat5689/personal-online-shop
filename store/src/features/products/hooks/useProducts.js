import { useContext } from "react";
import { ProductsContext } from "../context/ProductsContextValue";

/**
 * Custom hook wrapping react-query for the products list.
 * Shares a cached query across the entire app via `queryKey: ["products"]`.
 */
export const useProducts = () => {
  const data = useContext(ProductsContext);
  return data;
};
