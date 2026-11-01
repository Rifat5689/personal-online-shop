import React from "react";
import { Link } from "react-router-dom";
import { useCheckout } from "../../../features/orders/hooks/useCheckout";
import { money } from "../../../components/common/QueryState";
import { errorMessage } from "../../../services/api";
import { priceOf } from "../../../features/cart/utils/cartStorage";

export default function Checkout() {
  const {
    shipping,
    setShipping,
    shippingZone,
    setShippingZone,
    shippingFee,
    subtotal,
    checkoutItems,
    mutation,
    store,
    storeSlug,
  } = useCheckout();

  if (!checkoutItems.length)
    return (
      <div className="state-card">
        <h1>Your cart is empty</h1>
        <Link className="btn-primary" to={`/products`}>
          Browse Products
        </Link>
      </div>
    );

  return (
    <div className="shop-container ob-checkout-page">
      <h1>Checkout</h1>
      <p className="breadcrumb">Shipping → Payment → Confirmation</p>
      <form
        className="checkout-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <section className="card form-stack ob-billing-section">
          <h2>Shipping Address</h2>
          {["name", "phone", "address"].map((field) => (
            <label key={field}>
              {field === "name"
                ? "Full Name"
                : field === "phone"
                  ? "Phone Number"
                  : "Delivery Address"}
              <input
                className="ob-billing-input"
                required
                maxLength={field === "address" ? 500 : 100}
                type={field === "phone" ? "tel" : "text"}
                autoComplete={
                  field === "name"
                    ? "name"
                    : field === "phone"
                      ? "tel"
                      : "street-address"
                }
                value={shipping[field]}
                onChange={(event) =>
                  setShipping({ ...shipping, [field]: event.target.value })
                }
              />
            </label>
          ))}
          <h2>Payment Method</h2>
          <label className="row">
            <input type="radio" name="payment" checked readOnly /> Cash on
            Delivery
          </label>
          <p className="muted">Pay your merchant when your order arrives.</p>
          <h2>Delivery Area</h2>
          <div className="checkout-zone-options">
            <label>
              <input
                type="radio"
                name="shippingZone"
                value="insideDhaka"
                checked={shippingZone === "insideDhaka"}
                onChange={() => setShippingZone("insideDhaka")}
              />
              <span>
                Inside Dhaka{" "}
                <strong>
                  {money(store?.shippingFees?.insideDhaka ?? 70)}
                </strong>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="shippingZone"
                value="outsideDhaka"
                checked={shippingZone === "outsideDhaka"}
                onChange={() => setShippingZone("outsideDhaka")}
              />
              <span>
                Outside Dhaka{" "}
                <strong>
                  {money(store?.shippingFees?.outsideDhaka ?? 120)}
                </strong>
              </span>
            </label>
          </div>
        </section>
        <aside className="card order-summary ob-checkout-summary">
          <h2>Order Summary</h2>
          <div className="ob-checkout-items-list">
            {checkoutItems.map((item) => {
              const imgUrl = item.product?.images?.[0]?.url;
              const price = priceOf(item.product);
              return (
                <div key={item.product._id} className="ob-checkout-item-card">
                  <div className="ob-checkout-item-img-wrap">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.product.name}
                        className="ob-checkout-item-img"
                      />
                    ) : (
                      <span className="ob-checkout-no-img">O</span>
                    )}
                    <span className="ob-checkout-qty-badge">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="ob-checkout-item-info">
                    <strong className="ob-checkout-item-title">
                      {item.product.name}
                    </strong>
                    <small className="ob-checkout-item-price">
                      {money(price)} × {item.quantity}
                    </small>
                  </div>
                  <strong className="ob-checkout-item-total">
                    {money(price * item.quantity)}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="summary-line">
            Subtotal <strong>{money(subtotal)}</strong>
          </div>
          <div className="summary-line">
            Shipping <strong>{money(shippingFee)}</strong>
          </div>
          <div className="total">
            Total <strong>{money(subtotal + shippingFee)}</strong>
          </div>
          <p className="muted">
            Availability and prices are confirmed when you place your order.
          </p>
          {mutation.isError && (
            <p role="alert" className="error">
              {errorMessage(mutation.error)}
            </p>
          )}
          <button className="btn-primary" disabled={mutation.isPending} aria-busy={mutation.isPending}>
            {mutation.isPending && <span className="store-button-spinner" aria-hidden="true" />}
            {mutation.isPending ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </form>
    </div>
  );

}
