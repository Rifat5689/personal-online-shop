import { useState, useCallback, useMemo, useEffect } from "react";
import { CartContext } from "./CartContextValue";

const getKey = (item) => item?.id ?? item?.title ?? item?.name;

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(localStorage.getItem("cart_items") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [shippingZone, setShippingZone] = useState(() => {
    if (typeof window === "undefined") return "outside";
    const v = localStorage.getItem("cart_shipping_zone");
    return v === "inside" || v === "outside" ? v : "outside";
  });

  useEffect(() => {
    localStorage.setItem("cart_items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("cart_shipping_zone", shippingZone);
  }, [shippingZone]);

  const addItem = useCallback((item) => {
    if (!item) return;
    const key = getKey(item);
    if (key == null) return;
    setItems((prev) =>
      prev.find((i) => getKey(i) === key)
        ? prev.map((i) =>
            getKey(i) === key ? { ...i, quantity: (i.quantity ?? 1) + 1 } : i
          )
        : [...prev, { ...item, quantity: 1 }]
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => getKey(i) !== key));
  }, []);

  const updateQuantity = useCallback((key, qty) => {
    setItems((prev) =>
      prev
        .map((i) => (getKey(i) === key ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => (i.quantity ?? 1) > 0)
    );
  }, []);

  const itemCount = useMemo(() => items.length, [items.length]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      addItem,
      removeItem,
      updateQuantity,
      shippingZone,
      setShippingZone,
    }),
    [items, itemCount, addItem, removeItem, updateQuantity, shippingZone]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
