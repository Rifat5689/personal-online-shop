import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useEffect, useId, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbX, TbPackage, TbUser, TbMapPin, TbReceipt, TbPhone, TbCalendar } from "react-icons/tb";
import { QueryState, money } from "../../../components/common/QueryState";
import { request } from "../../../services/api";
import { RefundOrderButton, paymentLabel } from "./RefundOrderDialog";
import { orderStatusLabel } from "../hooks/useOrdersPage";
export function OrderDetailsDialog({
  orderId,
  onClose
}) {
  const {
    t
  } = usePageTranslation();
  const dialog = useRef(null);
  const titleId = useId();
  const query = useQuery({
    queryKey: ["adminOrder", orderId],
    queryFn: ({
      signal
    }) => request("get", `/orders/${orderId}`, undefined, {
      signal
    }),
    enabled: !!orderId
  });
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const order = query.data;
  const items = order?.orderItems || [];
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const date = order?.createdAt ? new Date(order.createdAt).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short"
  }) : "—";
  return <dialog ref={dialog} className="order-details-dialog" aria-labelledby={titleId} onClose={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
  }}>
      <header className="order-details-header">
        <span className="order-details-heading-icon">
          <TbPackage aria-hidden="true" />
        </span>
        <div>
          <h2 id={titleId}>{t("Order details")}</h2>
          <p>#{orderId.slice(-8)}</p>
        </div>
        <button type="button" className="order-actions-close" aria-label={t("Close order details")} autoFocus onClick={() => dialog.current.close()}>
          <TbX aria-hidden="true" />
        </button>
      </header>
      <div className="order-details-body">
        <QueryState query={query}>
          {order && <>
              <div className="order-details-overview">
                <span className={`store-reference-status ${orderStatusLabel(order.status)}`}>
                  {t(orderStatusLabel(order.status))}
                </span>
                <span>
                  <TbCalendar aria-hidden="true" />
                  {date}
                </span>
              </div>
              <div className="order-details-info-grid">
                <section className="order-details-panel">
                  <h3>
                    <TbUser aria-hidden="true" />{t("Customer")}</h3>
                  <strong>{order.shippingDetails?.name || "Customer"}</strong>
                  {order.shippingDetails?.phone && <a href={`tel:${order.shippingDetails.phone.replace(/[^+\d]/g, "")}`}>
                      <TbPhone aria-hidden="true" />
                      {order.shippingDetails.phone}
                    </a>}
                </section>
                <section className="order-details-panel">
                  <h3>
                    <TbMapPin aria-hidden="true" />{t("Delivery address")}</h3>
                  <p>
                    {order.shippingDetails?.address || "No address provided"}
                  </p>
                </section>
              </div>
              <section className="order-details-items">
                <h3>
                  <TbPackage aria-hidden="true" />{t("Order items")}<span>{items.length}</span>
                </h3>
                <div className="order-details-items-heading">
                  <span>{t("Product")}</span>
                  <span>{t("Qty")}</span>
                  <span>{t("Amount")}</span>
                </div>
                {items.map((item, index) => <div className="order-details-item" key={`${item.productId}-${index}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{money(item.price)}{t(" each")}</small>
                    </div>
                    <span>{item.quantity}</span>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>)}
                {!items.length && <p>{t("No items available.")}</p>}
              </section>
              <section className="order-details-payment">
                <div>
                  <h3>
                    <TbReceipt aria-hidden="true" />{t("Payment")}</h3>
                  <p>{order.payment?.paymentMethod || "—"}</p>
                  <span className={`order-details-payment-status ${order.payment?.paymentStatus === "paid" ? "paid" : ""}`}>
                    {t(paymentLabel(order))}
                  </span>
                </div>
                <RefundOrderButton order={order} />
                <dl>
                  <div>
                    <dt>{t("Subtotal")}</dt>
                    <dd>{money(subtotal)}</dd>
                  </div>
                  <div>
                    <dt>{t("Shipping")}</dt>
                    <dd>{money(order.shippingFee)}</dd>
                  </div>
                  <div><dt>{t("Refunded")}</dt><dd>{money(order.refundedAmount)}</dd></div>
                  <div><dt>{t("Net amount")}</dt><dd>{money(Math.max(0, order.totalPrice - (order.refundedAmount || 0)))}</dd></div>
                  <div className="order-details-total">
                    <dt>{t("Total")}</dt>
                    <dd>{money(order.totalPrice)}</dd>
                  </div>
                </dl>
              </section>
            </>}
        </QueryState>
      </div>
      <footer className="order-details-footer">
        <span>{t("Order # ")}{orderId.slice(-8)}</span>
        <button type="button" className="btn-primary" onClick={() => dialog.current.close()}>{t("Close details")}</button>
      </footer>
    </dialog>;
}
