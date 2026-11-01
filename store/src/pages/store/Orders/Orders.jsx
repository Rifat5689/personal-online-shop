import React, { useEffect } from "react";
import { ReviewForm } from "../../../features/feedback/Feedback";
import { TbPackage, TbCheck, TbTruckDelivery, TbMapPin, TbReceipt, TbCreditCard, TbClock } from "react-icons/tb";
import { Link, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "../../../application/providers/StoreProvider";
import { readStorage } from "../../../features/cart/utils/cartStorage";
import { request } from "../../../services/api";
import { QueryState, money } from "../../../components/common/QueryState";
const paymentLabel = (order) => ({ paid: "Payment received", refunded: "Refunded", partially_refunded: "Partially refunded" }[order.payment?.paymentStatus] || "Payment pending");

export function OrderSuccess() {
  const { state } = useLocation();
  const { storeSlug } = useStore();
  return (
    <div className="state-card">
      <span className="success-mark">✓</span>
      <h1>
        {state?.order ? "Thank you for your order!" : "Order Confirmation"}
      </h1>
      {state?.order && (
        <>
          <p>Order #{state.order._id.slice(-8)}</p>
          <p>Total: {money(state.order.totalPrice)}</p>
          <Link
            className="btn-primary"
            to={`/orders/${state.order._id}`}
            state={{ order: state.order }}
          >
            Track Order
          </Link>
        </>
      )}
      <Link className="text-button" to={`/orders`}>
        My Orders
      </Link>
      <Link to={`/products`}>Continue Shopping</Link>
    </div>
  );
}
export default function Orders() {
  const { store, storeSlug } = useStore();
  const orders = readStorage(`ownshop:orders:${store._id}`);
  return (
    <div className="shop-container">
      <h1>My Orders</h1>
      <p className="muted">Orders saved in this browser. Open an order for live tracking and to review delivered items.</p>
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th data-align="left">Order</th>
              <th data-align="center">Total</th>
              <th data-align="center">Status</th>
              <th data-align="center">Details</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td>#{order._id.slice(-8)}</td>
                <td>{money(order.totalPrice)}</td>
                <td>{order.status || "pending"}</td>
                <td>
                  <Link to={`/orders/${order._id}`}>
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <div className="state-card">
            <p>No orders yet.</p>
            <Link className="btn-primary" to={`/products`}>
              Shop Now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
export function OrderDetails() {
  const { id } = useParams();
  const { state } = useLocation();
  const { store, storeSlug } = useStore();
  const saved =
    state?.order ||
    readStorage(`ownshop:orders:${store._id}`).find(
      (order) => order._id === id,
    );
  const query = useQuery({
    queryKey: ["guestOrder", storeSlug, id],
    queryFn: () =>
      request("get", `/orders/store/${storeSlug}/${id}`, undefined, {
        headers: { "X-Tracking-Token": saved?.trackingToken },
      }),
    enabled: !!saved?.trackingToken,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (!query.data || !saved?.trackingToken) return;
    const key = `ownshop:orders:${store._id}`;
    try {
      const updated = { ...query.data, trackingToken: saved.trackingToken };
      localStorage.setItem(key, JSON.stringify([updated, ...readStorage(key).filter(item => item._id !== id)]));
    } catch { /* Live order details remain available if browser storage is full. */ }
  }, [query.data, saved?.trackingToken, store._id, id]);
  if (!saved?.trackingToken)
    return (
      <div className="state-card">
        <h1>Order unavailable</h1>
        <p>Open this order in the browser where it was placed.</p>
        <Link to={`/orders`}>Back to Orders</Link>
      </div>
    );
  const order = query.data;
  const items = order?.orderItems || [];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const steps = ["Placed", "Confirmed", "Preparing", "On the way", "Delivered"];
  const stage = { pending: 0, confirmed: 1, processing: 2, shipping: 3, shipped: 3, delivered: 4 }[order?.status] ?? -1;
  const copy = {
    pending: ["We've received your order", "Your order is awaiting confirmation from the store."],
    confirmed: ["Your order is confirmed", "The store has confirmed your order."],
    processing: ["Getting your order ready", "Your items are being prepared for delivery."],
    shipping: ["Your order is on the way", "Your order is in the delivery stage."],
    shipped: ["Your order has shipped", "Your order is on its way to your delivery address."],
    delivered: ["Delivered to you", "Thank you for shopping with us."],
    cancelled: ["This order was cancelled", "This order will no longer be delivered."],
    returned: ["This order was returned", "Contact the store if you need help with this order."],
  }[order?.status] || ["Order update", "Check here for the latest order status."];
  return (
    <div className="shop-container customer-order-page">
      <div className="customer-order-heading">
        <div><span className="ob-kicker">Your purchase</span><h1>Order details</h1><p>Order <strong>#{id.slice(-8).toUpperCase()}</strong></p></div>
        <Link to={`/orders`}>My orders</Link>
      </div>
      <QueryState query={query}>
        {order && <>
          <section className={`customer-order-progress ${stage < 0 ? "is-stopped" : ""}`} aria-label="Order status">
            <div className="customer-order-status-heading">
              <span className="customer-order-status-icon">{stage === 4 ? <TbCheck aria-hidden="true" /> : stage === 3 ? <TbTruckDelivery aria-hidden="true" /> : <TbPackage aria-hidden="true" />}</span>
              <div><span className="customer-order-status-badge">{order.status}</span><h2>{copy[0]}</h2><p>{copy[1]}</p></div>
            </div>
            {stage >= 0 && <ol className="customer-order-steps">{steps.map((label, index) =>
              <li key={label} className={index < stage ? "complete" : index === stage ? "current" : ""} aria-current={index === stage ? "step" : undefined}>
                <span>{index < stage ? <TbCheck aria-hidden="true" /> : index + 1}</span><strong>{label}</strong>
              </li>)}</ol>}
            {order.createdAt && <p className="customer-order-date">Placed {new Date(order.createdAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}</p>}
          </section>
          <div className="customer-order-grid">
            <div className="customer-order-main">
              <section className="customer-order-card">
                <div className="customer-order-card-heading"><h2><TbPackage aria-hidden="true" /> Your items</h2><span>{items.reduce((sum, item) => sum + item.quantity, 0)} items</span></div>
                {items.map((item) => <article className="customer-order-item" key={item.productId}>
                  <span className="customer-order-item-icon"><TbPackage aria-hidden="true" /></span>
                  <div><h3>{item.name}</h3><p>{money(item.price)} &times; {item.quantity}</p></div>
                  <strong>{money(item.price * item.quantity)}</strong>
                </article>)}
              </section>
              {order.status === "delivered" && <section className="feedback-panel"><h2>Review your purchase</h2><p className="muted">Tell other shoppers about the products you received.</p>{items.map(item => <ReviewForm key={item.productId} order={order} item={item} trackingToken={saved.trackingToken} />)}</section>}
              <section className="customer-order-card">
                <div className="customer-order-card-heading"><h2><TbMapPin aria-hidden="true" /> Delivery address</h2></div>
                <div className="customer-order-address"><strong>{order.shippingDetails?.name}</strong><p>{order.shippingDetails?.phone}</p><address>{order.shippingDetails?.address}</address></div>
              </section>
            </div>
            <aside className="customer-order-card customer-order-summary">
              <div className="customer-order-card-heading"><h2><TbReceipt aria-hidden="true" /> Order summary</h2></div>
              <dl><div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div><div><dt>Delivery</dt><dd>{money(order.shippingFee)}</dd></div>{(order.refundedAmount || 0) > 0 && <><div><dt>Refunded</dt><dd>{money(order.refundedAmount)}</dd></div><div><dt>Net amount</dt><dd>{money(Math.max(0, order.totalPrice - order.refundedAmount))}</dd></div></>}<div className="customer-order-total"><dt>Total</dt><dd>{money(order.totalPrice)}</dd></div></dl>
              <div className="customer-order-payment"><TbCreditCard aria-hidden="true" /><div><span>Payment method</span><strong>{order.payment?.paymentMethod || "Cash on delivery"}</strong></div></div>
              <div className={`customer-order-payment-state ${order.payment?.paymentStatus === "paid" ? "paid" : ""}`}>
                {order.payment?.paymentStatus === "paid" ? <TbCheck aria-hidden="true" /> : <TbClock aria-hidden="true" />}
                {paymentLabel(order)}
              </div>
              {store.supportEmail && <a className="customer-order-help" href={`mailto:${store.supportEmail}`}>Need help with your order?</a>}
              <Link className="customer-order-shop" to={`/products`}>Continue shopping</Link>
            </aside>
          </div>
        </>}
      </QueryState>
    </div>
  );
}
