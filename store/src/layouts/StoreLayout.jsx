import React from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../application/providers/StoreProvider";
import { CartProvider, useCart } from "../features/cart/CartProvider";
import { QueryState } from "../components/common/QueryState";
function StoreShell() {
  const { storeSlug, store } = useStore();
  const { count, notice, dismissNotice } = useCart();
  const navigate = useNavigate();
  const base = `/`;
  const links = [
    ["Home", base],
    ["Categories", `${base}/categories`],
    [`Cart (${count})`, `${base}/cart`],
    ["Wishlist", `${base}/wishlist`],
    ["Account", `${base}/account`],
  ];
  return (
    <div className="store-shell">
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link className="brand" to={base}>
            <span>◉</span>
            {store.name}
          </Link>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(
                `${base}/products?q=${encodeURIComponent(new FormData(event.currentTarget).get("q"))}`,
              );
            }}
          >
            <input
              name="q"
              aria-label="Search products"
              placeholder="Search products, brands and more..."
            />
            <button aria-label="Search">⌕</button>
          </form>
          <nav>
            <Link to={`${base}/products`}>Shop</Link>
            <Link to={`${base}/categories`}>Categories</Link>
            <Link to={`${base}/account`} aria-label="Account">
              ♙
            </Link>
            <Link to={`${base}/wishlist`} aria-label="Wishlist">
              ♡
            </Link>
            <Link to={`${base}/cart`}>Cart ({count})</Link>
          </nav>
        </div>
      </header>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss notification" onClick={dismissNotice}>
            ×
          </button>
        </div>
      )}
      <main className="shop-main">
        <Outlet />
      </main>
      <footer className="shop-footer">
        <strong>{store.name}</strong>
        <p>{store.description}</p>
        <div className="row">
          <Link to={`${base}/products`}>Shop</Link>
          <Link to={`${base}/orders`}>My Orders</Link>
          {store.supportEmail && (
            <a href={`mailto:${store.supportEmail}`}>Contact</a>
          )}
        </div>
        <p>
          © {new Date().getFullYear()} {store.name} · Powered by OwnShop
        </p>
      </footer>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {links.map(([label, to]) => (
          <NavLink end key={to} to={to}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
export function StoreLayout() {
  const { store, query } = useStore();
  return (
    <QueryState query={query}>
      {store && (
        <CartProvider key={store._id} store={store}>
          <StoreShell />
        </CartProvider>
      )}
    </QueryState>
  );
}
