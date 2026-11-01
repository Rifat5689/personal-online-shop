import React from "react";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { TbChevronRight, TbShoppingBag, TbUserCircle, TbHelpCircle } from "react-icons/tb";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCart } from "../../../features/cart/CartProvider";
import { ProductCard } from "../../../features/store/components/ProductCard";

export function Wishlist() {
  const { wishlist } = useCart();
  const { storeSlug } = useStore();
  return (
    <div className="shop-container">
      <h1>Your Wishlist</h1>
      {wishlist.length ? <div className="product-grid">{wishlist.map((product) => <ProductCard key={product._id} product={product} />)}</div> :
        <div className="state-card"><p>Your wishlist is empty.</p><Link className="btn-primary" to={`/products`}>Browse Products</Link></div>}
    </div>
  );
}

export default function Account() {
  const { storeSlug, store } = useStore();
  const { customer, openIdentity } = useOutletContext();
  const navigate = useNavigate();

  return (
    <div className="shop-container ob-account-page">
      <div className="ob-account-heading"><span className="ob-brand"><span>O</span><strong>{storeSlug === "originsofbeauty" ? <>Origins<em>ofBeauty</em></> : store.name}</strong></span></div>
      <button
        className="ob-profile-card"
        onClick={() => {
          if (!customer) {
            navigate(`/login`);
          } else {
            openIdentity();
          }
        }}
      >
        <TbUserCircle aria-hidden="true" />
        <span>
          <strong>{customer?.username || "Guest"}</strong>
          <small>{customer ? "Manage your profile" : "Tap to sign in"}</small>
        </span>
        <TbChevronRight aria-hidden="true" />
      </button>
      <div className="ob-account-links">
        <Link to={`/orders`}><TbShoppingBag aria-hidden="true" />My Orders<TbChevronRight aria-hidden="true" /></Link>
        <Link to={`/cart`}><TbShoppingBag aria-hidden="true" />My Cart<TbChevronRight aria-hidden="true" /></Link>
        {customer && (
          <button
            type="button"
            className="ob-account-signout-row"
            onClick={openIdentity}
          >
            <TbUserCircle aria-hidden="true" />Sign Out<TbChevronRight aria-hidden="true" />
          </button>
        )}
        {store.supportEmail && <a href={`mailto:${store.supportEmail}`}><TbHelpCircle aria-hidden="true" />Help & Support<TbChevronRight aria-hidden="true" /></a>}
      </div>
    </div>
  );
}

