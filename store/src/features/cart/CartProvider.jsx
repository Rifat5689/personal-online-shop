import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { readStorage, addCartItem, priceOf } from "./utils/cartStorage";
import { trackEvent } from "../analytics/tracking";
const CartContext = createContext(null);
export function CartProvider({ store, children }) {
  const key = `ownshop:cart:${store._id}`;
  const wishlistKey = `ownshop:wishlist:${store._id}`;
  const [items, setItems] = useState(() =>
    readStorage(key).filter(
      (item) =>
        item.product?.tenantId === store._id &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    ),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [wishlist, setWishlist] = useState(() =>
    readStorage(wishlistKey).filter(
      (product) => product.tenantId === store._id,
    ),
  );
  const [notice, setNotice] = useState("");
  const [noticeId, setNoticeId] = useState(0);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      setNotice(
        "Your browser could not save your cart. Keep this tab open until checkout.",
      );
    }
  }, [items, key]);
  useEffect(() => {
    try {
      localStorage.setItem(wishlistKey, JSON.stringify(wishlist));
    } catch {
      setNotice("Unable to save your wishlist.");
    }
  }, [wishlist, wishlistKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice("");
    }, 2200);
    return () => clearTimeout(timer);
  }, [notice, noticeId]);

  const add = (product, quantity = 1) => {
    if (product.tenantId !== store._id) return;
    // Update the ref immediately so rapid repeat clicks see the first addition.
    const current = itemsRef.current;
    const isExisting = current.some((item) => item.product._id === product._id);
    const next = addCartItem(current, product, quantity);
    if (!isExisting && next === current) return;
    itemsRef.current = next;
    setItems(next);
    if (!isExisting) trackEvent(store.slug, "add_to_cart", { productId: product._id });
    setNoticeId((value) => value + 1);
    setNotice(isExisting ? "Already in your cart" : "Added to cart");
  };

  const update = (id, quantity) =>
    setItems((current) =>
      current.map((item) =>
        item.product._id === id
          ? {
              ...item,
              quantity: Math.max(1, Math.min(item.product.stock, quantity)),
            }
          : item,
      ),
    );
  const remove = (id) =>
    setItems((current) => current.filter((item) => item.product._id !== id));
  const toggleWishlist = (product) => {
    if (product.tenantId !== store._id) return;
    setWishlist((current) =>
      current.some((item) => item._id === product._id)
        ? current.filter((item) => item._id !== product._id)
        : [...current, product],
    );
  };
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + priceOf(item.product) * item.quantity,
    0,
  );
  return (
    <CartContext.Provider
      value={{
        items,
        add,
        update,
        remove,
        clear: () => setItems([]),
        count,
        subtotal,
        wishlist,
        toggleWishlist,
        notice,
        noticeId,
        dismissNotice: () => setNotice(""),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export const useCart = () => useContext(CartContext);
