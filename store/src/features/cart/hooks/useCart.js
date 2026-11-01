import { useContext } from "react";
import { CartContext } from "../context/CartContextValue";

/**
 * Convenience hook to access cart state and actions.
 * @returns {import('../context/CartContext').CartContext}
 */
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
