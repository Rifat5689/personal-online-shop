import { usePageTranslation } from "../language/AdminLanguageProvider";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TbBell, TbBox, TbPackageOff, TbShoppingBag, TbX } from "react-icons/tb";
import { request } from "../../services/api";
import { useAuth } from "../../application/providers/AuthProvider";
import { orderNoticeKey, stockNoticeKey, readSeenNotifications, unseenNotifications } from "./notificationState";
export default function AdminNotifications({
  base
}) {
  const {
    user
  } = useAuth();
  const storageKey = `ownshop:seen-notifications:${user?._id}:${base}`;
  return <NotificationsInbox key={storageKey} base={base} storageKey={storageKey} />;
}
function NotificationsInbox({
  base,
  storageKey
}) {
  const {
    t
  } = usePageTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const [seen, setSeen] = useState(() => readSeenNotifications(localStorage, storageKey));
  const orders = useQuery({
    queryKey: ["mobileNotifications", "orders", storageKey],
    queryFn: () => request("get", "/orders"),
    refetchInterval: 30000
  });
  const products = useQuery({
    queryKey: ["mobileNotifications", "products", storageKey],
    queryFn: () => request("get", "/products"),
    refetchInterval: 60000
  });
  const unread = useMemo(() => unseenNotifications(orders.data || [], products.data || [], seen), [orders.data, products.data, seen]);
  const closePanel = useCallback(() => {
    // Merge stored receipts so another tab's seen notifications are preserved.
    const next = readSeenNotifications(localStorage, storageKey);
    for (const key of seen) next.add(key);
    for (const order of unread.orders) next.add(orderNoticeKey(order));
    for (const product of unread.products) next.add(stockNoticeKey(product));
    setSeen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {/* Keep in-memory receipts when storage is unavailable. */}
    setOpen(false);
  }, [seen, storageKey, unread]);
  useEffect(() => {
    const syncSeen = event => {
      if (event.key === storageKey) setSeen(readSeenNotifications(localStorage, storageKey));
    };
    window.addEventListener("storage", syncSeen);
    return () => window.removeEventListener("storage", syncSeen);
  }, [storageKey]);
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (!container.current?.contains(event.target)) closePanel();
    };
    const escape = event => {
      if (event.key === "Escape") {
        closePanel();
        container.current?.querySelector(".notification-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open, closePanel]);
  const count = unread.orders.length + unread.products.length;
  return <div className="admin-notifications" ref={container}>
      <button className="notification-trigger" onClick={() => open ? closePanel() : setOpen(true)} aria-label={`${count} business notifications`} aria-expanded={open}>
        <TbBell aria-hidden="true" />
        {count > 0 && <span>{Math.min(count, 99)}</span>}
      </button>
      {open && <section className="notification-panel" aria-label={t("Unseen notifications")}>
          <header>
            <div>
              <strong>{t("Notifications")}</strong>
              <small>{t("Unseen orders and inventory updates")}</small>
            </div>
            <button onClick={closePanel} className="notification-close" aria-label={t("Close notifications")}>
              <TbX />
            </button>
          </header>
          <div>
            {unread.orders.map(order => <Link key={order._id} to={`${base}/orders/${order._id}`} onClick={closePanel}>
                <TbShoppingBag />
                <span>
                  <strong>{t("New order # ")}{order._id.slice(-8)}</strong>
                  <small>
                    {order.shippingDetails?.name} ·{" "}
                    {new Date(order.createdAt).toLocaleString("en-BD", {
                timeZone: "Asia/Dhaka"
              })}
                  </small>
                </span>
              </Link>)}
            {unread.products.map(product => <Link key={product._id} to={`${base}/products/${product._id}/edit`} onClick={closePanel}>
                {t(product.stock === 0 ? <TbPackageOff /> : <TbBox />)}
                <span>
                  <strong>
                    {t(product.stock === 0 ? "Out of stock" : "Low stock")}:{" "}
                    {product.name}
                  </strong>
                  <small>
                    {product.stock}{t(" item ")}{t(product.stock === 1 ? "" : "s")}{" "}{t(" remaining")}</small>
                </span>
              </Link>)}
            {!count && <p>{t("No new items require your attention.")}</p>}
          </div>
          <footer>
            <Link to={`${base}/orders`} onClick={closePanel}>{t("View all orders")}</Link>
          </footer>
        </section>}
    </div>;
}
