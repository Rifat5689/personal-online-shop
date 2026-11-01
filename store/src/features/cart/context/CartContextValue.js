import { createContext } from "react";

export const CartContext = createContext({
  items: [],
  itemCount: 0,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  shippingZone: "outside",
  setShippingZone: () => {},
});
