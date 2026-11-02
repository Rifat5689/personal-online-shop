import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { request } from "../../../services/api";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCart } from "../../cart/CartProvider";
import { readStorage, priceOf } from "../../cart/utils/cartStorage";

import { getAnalyticsSession } from "../../analytics/tracking";

export function useCheckout() {
  const { store, storeSlug } = useStore();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const buyNowItem = location.state?.buyNowItem;
  const checkoutItems = buyNowItem ? [buyNowItem] : cart.items;

  const [shipping, setShipping] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [shippingZone, setShippingZone] = useState("insideDhaka");
  const [attempt, setAttempt] = useState(null);

  const subtotal = checkoutItems.reduce(
    (total, item) => total + priceOf(item.product) * item.quantity,
    0,
  );

  const insideFee = store?.shippingFees?.insideDhaka ?? 70;
  const outsideFee = store?.shippingFees?.outsideDhaka ?? 120;
  const zoneFee = shippingZone === "outsideDhaka" ? outsideFee : insideFee;
  const shippingFee = store?.useZoneShippingFees ? zoneFee : (store?.shippingFee ?? zoneFee);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        orderItems: checkoutItems.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
        analyticsSessionId: getAnalyticsSession(storeSlug).id,
        shippingDetails: shipping,
        shippingZone,
        customerUsername: (() => {
          try {
            return JSON.parse(
              localStorage.getItem(`ownshop:customer:${store._id}`),
            )?.username;
          } catch {
            return undefined;
          }
        })(),
        paymentMethod: "cash on delivery",
      };
      const fingerprint = JSON.stringify({ ...body, analyticsSessionId: undefined });
      const current =
        attempt?.fingerprint === fingerprint
          ? attempt
          : { fingerprint, key: crypto.randomUUID() };
      setAttempt(current);
      return request("post", `/orders/store/${storeSlug}`, body, {
        headers: { "Idempotency-Key": current.key },
      });
    },
    onSuccess: (order) => {
      try {
        const key = `ownshop:orders:${store._id}`;
        localStorage.setItem(
          key,
          JSON.stringify([
            order,
            ...readStorage(key).filter((item) => item._id !== order._id),
          ]),
        );
      } catch {
        /* Order is already saved by the backend; the success screen keeps its token. */
      }
      if (!buyNowItem) {
        cart.clear();
      }
      queryClient.invalidateQueries({ queryKey: ["products", storeSlug] });
      queryClient.invalidateQueries({ queryKey: ["product", storeSlug] });
      queryClient.invalidateQueries({ queryKey: ["relatedProducts", storeSlug] });
      navigate(`/order-success`, {
        state: { order },
        replace: true,
      });
    },
  });

  return {
    shipping,
    setShipping,
    shippingZone,
    setShippingZone,
    shippingFee,
    subtotal,
    checkoutItems,
    isBuyNow: !!buyNowItem,
    mutation,
    cart,
    store,
    storeSlug,
  };
}

