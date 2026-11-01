import { usePageTranslation } from "../../../features/language/AdminLanguageProvider";
import { useMerchantPanel } from "../../../application/providers/MerchantPanelProvider";
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TbPackage, TbCalendar, TbUser, TbPhone, TbMapPin, TbReceipt, TbTruck, TbChevronRight } from "react-icons/tb";
import { useOrdersPage, transitions, orderStatusLabel } from "../../../features/orders/hooks/useOrdersPage";
import { QueryState, money } from "../../../components/common/QueryState";
import { errorMessage } from "../../../services/api";
import { OrdersListView } from "../../../features/orders/components/OrdersListView";
import { RefundOrderButton, paymentLabel } from "../../../features/orders/components/RefundOrderDialog";
export default function Orders() {
  const {
    t
  } = usePageTranslation();
  const {
    id
  } = useParams();
  const {
    base
  } = useMerchantPanel();
  const hook = useOrdersPage(id);
  const client = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const order = hook.details.data;
  if (!id) return <OrdersListView hook={hook} />;
  const options = transitions[order?.status] || [];
  const selected = options.includes(nextStatus) ? nextStatus : "";
  const items = order?.orderItems || [];
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const date = order?.createdAt ? new Date(order.createdAt).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short"
  }) : "Date unavailable";
  return <div className="admin-order-detail">
      <nav className="order-page-breadcrumb" aria-label={t("Breadcrumb")}>
        <Link to={`${base}/orders`}>{t("Orders")}</Link><TbChevronRight aria-hidden="true" /><span>{t("Order details")}</span>
      </nav>
      <QueryState query={hook.details}>
        {order && <>
          <header className="order-page-heading">
            <span className="order-page-icon"><TbPackage aria-hidden="true" /></span>
            <div><p>{t("Order details")}</p><h1>{t("Order # ")}{id.slice(-8)}</h1><span className="order-page-date"><TbCalendar aria-hidden="true" />{date}</span></div>
            <span className={`store-reference-status ${order.status}`}>{t(orderStatusLabel(order.status))}</span>
          </header>
          <section className="order-page-card order-page-status" aria-label={t("Order status")}>
            <div><h2><TbTruck aria-hidden="true" />{t("Fulfilment")}</h2><p>{t(options.length ? "Update the order as it moves towards delivery." : "No further status changes are available.")}</p></div>
            {options.length > 0 && <form onSubmit={event => {
            event.preventDefault();
            if (!selected || hook.mutation.isPending) return;
            hook.mutation.mutate({
              method: "patch",
              id,
              data: {
                status: selected
              }
            }, {
              onSuccess: () => {
                setNextStatus("");
                client.invalidateQueries({
                  queryKey: ["adminOrder", id]
                });
                client.invalidateQueries({
                  queryKey: ["mobileNotifications", "orders"]
                });
              }
            });
          }}>
              <label className="sr-only" htmlFor="order-next-status">{t("Next order status")}</label>
              <select id="order-next-status" value={selected} onChange={event => setNextStatus(event.target.value)} disabled={hook.mutation.isPending}>
                <option value="">{t("Choose status")}</option>
                {options.map(status => <option key={status} value={status}>{t(orderStatusLabel(status))}</option>)}
              </select>
              <button type="submit" className="btn-primary" disabled={!selected || hook.mutation.isPending}>{t(hook.mutation.isPending ? "Updating…" : "Update status")}</button>
            </form>}
            {hook.mutation.isError && <p className="error" role="alert">{errorMessage(hook.mutation.error)}</p>}
            {hook.mutation.isSuccess && <p className="order-page-saved" role="status">{t("Order status updated.")}</p>}
          </section>
          <div className="order-page-grid">
            <div className="order-page-main">
              <section className="order-page-card">
                <div className="order-page-section-heading"><h2><TbPackage aria-hidden="true" />{t("Order items")}</h2><span>{items.reduce((total, item) => total + item.quantity, 0)}{t(" items")}</span></div>
                <div className="order-details-items-heading"><span>{t("Product")}</span><span>{t("Qty")}</span><span>{t("Amount")}</span></div>
                {items.map((item, index) => <div className="order-details-item" key={`${item.productId}-${index}`}>
                  <div><strong>{item.name}</strong><small>{money(item.price)}{t(" each")}</small></div><span>{item.quantity}</span><strong>{money(item.price * item.quantity)}</strong>
                </div>)}
                {!items.length && <p className="order-page-muted">{t("No items available.")}</p>}
              </section>
              <section className="order-page-card order-page-customer">
                <div><h2><TbUser aria-hidden="true" />{t("Customer")}</h2><strong>{order.shippingDetails?.name || "Customer"}</strong>
                  {order.shippingDetails?.phone && <a href={`tel:${order.shippingDetails.phone.replace(/[^+\d]/g, "")}`}><TbPhone aria-hidden="true" />{order.shippingDetails.phone}</a>}
                </div>
                <div><h2><TbMapPin aria-hidden="true" />{t("Delivery address")}</h2><p>{order.shippingDetails?.address || "No address provided"}</p></div>
              </section>
            </div>
            <aside className="order-page-card order-page-summary">
              <h2><TbReceipt aria-hidden="true" />{t("Payment summary")}</h2>
              <div className="order-page-payment-method"><span>{order.payment?.paymentMethod || "Payment method unavailable"}</span><span className={`order-details-payment-status ${order.payment?.paymentStatus === "paid" ? "paid" : ""}`}>{t(paymentLabel(order))}</span></div>
              <RefundOrderButton order={order} />
              <dl><div><dt>{t("Subtotal")}</dt><dd>{money(subtotal)}</dd></div><div><dt>{t("Shipping")}</dt><dd>{money(order.shippingFee)}</dd></div><div><dt>{t("Refunded")}</dt><dd>{money(order.refundedAmount)}</dd></div><div><dt>{t("Net amount")}</dt><dd>{money(Math.max(0, order.totalPrice - (order.refundedAmount || 0)))}</dd></div><div className="order-page-total"><dt>{t("Total")}</dt><dd>{money(order.totalPrice)}</dd></div></dl>
            </aside>
          </div>
        </>}
      </QueryState>
    </div>;
}
