import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useStore } from "../application/providers/StoreProvider";
import { CartProvider, useCart } from "../features/cart/CartProvider";
import { QueryState, money } from "../components/common/QueryState";
import { useCatalog } from "../features/store/hooks/useCatalog";
import { priceOf } from "../features/cart/utils/cartStorage";
import LoadingSpinner from "../shared/components/LoadingSpinner";
import {

  TbHome,
  TbMenu2,
  TbPackage,
  TbSearch,
  TbShoppingBag,
  TbShoppingCart,
  TbUserCircle,
  TbX,
} from "react-icons/tb";
import { useCustomerAuth, CustomerAuthCard } from "../features/auth";
import { request } from "../services/api";

import { useStorefrontTracking } from "../features/analytics/hooks/useStorefrontTracking";
import { trackEvent } from "../features/analytics/tracking";

const customerKey = (storeId) => `ownshop:customer:${storeId}`;

function CustomerDialog({ open, onClose, customer, onLogout, store, storeSlug, onCustomerUpdated }) {
  const auth = useCustomerAuth({
    storeSlug,
    storeId: store?._id,
    defaultMode: "signin",
    onSuccess: (data) => {
      onCustomerUpdated(data);
      onClose();
    },
  });

  if (!open) return null;
  return (
    <div className="ob-modal" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="ob-modal-content"
      >
        <button className="ob-modal-close" onClick={onClose} aria-label="Close">
          <TbX aria-hidden="true" />
        </button>
        {customer ? (
          <div className="ob-modal-profile">
            <span className="ob-kicker">{store?.name || "Store"}</span>
            <h2 id="customer-title">Hi, {customer.username}</h2>
            <p>You are signed in to your account.</p>
            <button
              className="ob-primary"
              style={{ marginTop: "18px", width: "100%" }}
              onClick={onLogout}
            >
              Sign out on this browser
            </button>
          </div>
        ) : (
          <CustomerAuthCard
            auth={auth}
            store={store}
            storeSlug={storeSlug}
            onBack={onClose}
            isModal={true}
          />
        )}
      </section>
    </div>
  );
}


function StoreShell() {
  const { storeSlug, store } = useStore();
  useStorefrontTracking(storeSlug);
  const trackedStore = useRef(null);
  useEffect(() => {
    if (trackedStore.current === store._id) return;
    trackedStore.current = store._id;
    request("post", `/stores/slug/${encodeURIComponent(storeSlug)}/views`).catch(() => {
      // Analytics must not interrupt browsing or checkout.
    });
  }, [store._id, storeSlug]);
  const { count, notice, noticeId, dismissNotice } = useCart();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const loadingRequests = useIsFetching({ predicate: (query) => query.queryKey[0] !== "mobileNotifications" });
  const base = "";
  const brand = storeSlug === "originsofbeauty" ? <>Origins<em>ofBeauty</em></> : store.name;
  const [menuOpen, setMenuOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scrollDown, setScrollDown] = useState(false);
  const searchContainerRef = useRef(null);
  const isCheckout = location.pathname.replace(/\/$/, "") === `${base}/checkout`;
  const [customer, setCustomer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(customerKey(store._id)));
    } catch {
      return null;
    }
  });
  const links = useMemo(
    () => [
      ["Home", "/"],
      ["Products", `${base}/products`],
      ["My Orders", `${base}/orders`],
    ],
    [base],
  );
  const logout = () => {
    localStorage.removeItem(customerKey(store._id));
    setCustomer(null);

    setIdentityOpen(false);
  };
  useEffect(() => {
    setMenuOpen(false);
    setShowSuggestions(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    let previous = window.scrollY;
    let frame;
    const handleScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const current = Math.max(0, window.scrollY);
        if (current < 80) setScrollDown(false);
        else if (Math.abs(current - previous) > 8) setScrollDown(current > previous);
        if (Math.abs(current - previous) > 8 || current < 80) previous = current;
        frame = null;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => { window.removeEventListener("scroll", handleScroll); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchSuggestions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q || !products?.data) return [];
    return (products.data || [])
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.category?.name?.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [searchValue, products?.data]);

  const submitSearch = (event) => {
    event?.preventDefault?.();
    setShowSuggestions(false);
    if (searchValue.trim()) trackEvent(storeSlug, "search", { page: "products" });
    navigate(`${base}/products?q=${encodeURIComponent(searchValue.trim())}`);
  };
  return (
    <div className="ob-store" data-store-theme={["green", "blue", "midnight", "aurora"].includes(store.theme) ? store.theme : "pink"}>
      {!isCheckout && <><div className="ob-reference-header-space" aria-hidden="true" /><header className={`ob-header ob-reference-header${scrollDown ? " is-collapsed" : ""}`}>
        <div className="ob-nav">
          <button
            className="ob-menu-button" inert={scrollDown ? "" : undefined}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <TbMenu2 aria-hidden="true" />
          </button>
          <Link className="ob-brand" to={base || "/"} inert={scrollDown ? "" : undefined}>
            <span>
              {store.profileImage?.url ? (
                <img src={store.profileImage.url} alt="" />
              ) : (
                "O"
              )}
            </span>
            <strong>
              {brand}
            </strong>
          </Link>
          <div className="ob-search-wrapper" ref={searchContainerRef}>
            <form
              className="ob-search"
              role="search"
              onSubmit={submitSearch}
            >
              <span>
                <TbSearch aria-hidden="true" />
              </span>
              <input
                name="q"
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (searchValue.trim().length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                aria-label="Search products"
                placeholder="Search products..."
                autoComplete="off"
              />
              <button type="submit">Search</button>
            </form>
            {showSuggestions && searchValue.trim().length > 0 && (
              <div className="ob-search-suggestions">
                {searchSuggestions.length > 0 ? (
                  <>
                    <div className="ob-suggestions-list">
                      {searchSuggestions.map((product) => {
                        const imgUrl = product.images?.[0]?.url;
                        const price = priceOf(product);
                        return (
                          <div
                            key={product._id}
                            className="ob-suggestion-item"
                            onMouseDown={() => {
                              trackEvent(storeSlug, "product_click", { productId: product._id, page: "products" });
                              navigate(`${base}/products/${product.slug || product._id}`);
                              setSearchValue("");
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="ob-suggestion-img-wrap">
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={product.name}
                                  className="ob-suggestion-img"
                                />
                              ) : (
                                <span className="ob-suggestion-no-img">O</span>
                              )}
                            </div>
                            <div className="ob-suggestion-info">
                              <span className="ob-suggestion-name">{product.name}</span>
                              <div className="ob-suggestion-meta">
                                {product.category?.name && (
                                  <span className="ob-suggestion-cat">{product.category.name}</span>
                                )}
                                <span className="ob-suggestion-price">{money(price)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="ob-suggestions-all-btn"
                      onMouseDown={(e) => {
                        submitSearch(e);
                        setShowSuggestions(false);
                      }}
                    >
                      View all results for "{searchValue.trim()}" →
                    </button>
                  </>
                ) : (
                  <div className="ob-suggestion-empty">
                    <span>No products found matching "{searchValue.trim()}"</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <nav className="ob-desktop-nav" aria-label="Account and cart" inert={scrollDown ? "" : undefined}>
            <div className="ob-nav-extended-icons">
              <button
                type="button"
                onClick={() => {
                  if (customer) {
                    setIdentityOpen(true);
                  } else {
                    navigate(`${base}/login`);
                  }
                }}
                aria-label={
                  customer ? `Signed in as ${customer.username}` : "Sign In / Sign Up"
                }
                title={customer?.username ? `Signed in as ${customer.username}` : "Sign In / Sign Up"}
              >
                <TbUserCircle aria-hidden="true" /><span>{customer ? "Account" : "Sign In"}</span>
              </button>
            </div>
            <NavLink
              className="ob-cart-link"
              to={`${base}/cart`}
              aria-label={`Shopping bag with ${count} items`}
              title="Shopping bag"
            >
              <TbShoppingCart aria-hidden="true" />
              <b>{count}</b>
            </NavLink>
          </nav>
        </div>
      </header></>}
      <div
        className={`ob-drawer-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`ob-drawer ${menuOpen ? "open" : ""}`}>
        <div className="ob-drawer-head">
          <Link className="ob-brand" to={base || "/"}>
            <span>
              {store.profileImage?.url ? (
                <img src={store.profileImage.url} alt="" />
              ) : (
                "O"
              )}
            </span>
            <strong>
              {brand}
            </strong>
          </Link>
          <button className="ob-drawer-close-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <TbX aria-hidden="true" />
          </button>
        </div>

        {links.map(([label, to]) => (
          <NavLink end key={to} to={to}>
            {label === "Home" && <TbHome aria-hidden="true" />}
            {label === "Products" && <TbPackage aria-hidden="true" />}
            {label === "My Orders" && <TbShoppingBag aria-hidden="true" />}
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => {
            setMenuOpen(false);
            if (customer) {
              navigate(`${base}/account`);
            } else {
              navigate(`${base}/login`);
            }
          }}
        >
          <TbUserCircle aria-hidden="true" />
          {customer ? `Signed in as ${customer.username}` : "Sign In / Sign Up"}
        </button>
      </aside>
      {notice && (
        <div key={noticeId} className="ob-toast" role="status" aria-live="polite" aria-atomic="true">
          {notice === "Added to cart" && (
            <svg className="ob-toast-tick" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 7" pathLength="1" />
            </svg>
          )}
          {notice !== "Added to cart" && (
            <svg className="ob-toast-alert" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6" />
              <circle className="ob-toast-alert-dot" cx="12" cy="17" r="1" />
            </svg>
          )}
          <span className="ob-toast-message">{notice}</span>
          <button onClick={dismissNotice} aria-label="Dismiss notification">
            <TbX aria-hidden="true" />
          </button>
        </div>
      )}
      {loadingRequests > 0 && <div className="store-loading-indicator" role="status"><span className="spinner" aria-hidden="true" /><span>Loading…</span></div>}
      <main className="ob-main" key={location.pathname}>
        <Outlet context={{ customer, setCustomer, openIdentity: () => setIdentityOpen(true) }} />
      </main>
      <footer className="ob-footer">
        <div>
          <Link className="ob-brand" to={base || "/"}>
            <span>
              {store.profileImage?.url ? (
                <img src={store.profileImage.url} alt="" />
              ) : (
                "O"
              )}
            </span>
            <strong>
              {brand}
            </strong>
          </Link>
          <p>
            {store.description ||
              "Explore this store's collection."}
          </p>
        </div>
        <div>
          <strong>Explore</strong>
          <Link to={`${base}/products`}>All products</Link>
          <Link to={`${base}/orders`}>Track orders</Link>
        </div>
        <div>
          <strong>Customer care</strong>
          {store.supportEmail && <a href={`mailto:${store.supportEmail}`}>Contact us</a>}
          {store.showShippingFees && store.whatsappNumber && (
            <a
              href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp: {store.whatsappNumber}
            </a>
          )}
          {store.showShippingFees &&
            store.useZoneShippingFees &&
            store.shippingFees && (
              <span className="ob-footer-delivery">
                Delivery: {store.shippingFees.insideDhaka} BDT inside Dhaka ·{" "}
                {store.shippingFees.outsideDhaka} BDT outside Dhaka
              </span>
            )}
        </div>
        <small>
          © {new Date().getFullYear()} {store.name} · Powered by OwnShop
        </small>
      </footer>
      {!isCheckout && <nav className={`ob-bottom-nav ob-reference-bottom-nav${scrollDown ? " is-visible" : ""}`} aria-label="Store navigation" inert={scrollDown ? undefined : ""}>
        <NavLink end to={base || "/"} aria-label="Home" title="Home">
          <TbHome aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink to={`${base}/products`} aria-label="Shop" title="Shop">
          <TbShoppingBag aria-hidden="true" />
          <span>Shop</span>
        </NavLink>
        <NavLink to={`${base}/cart`} className="ob-mobile-bag" aria-label={`Cart with ${count} items`} title="Cart">
          <TbShoppingCart aria-hidden="true" /><b>{count}</b><span>Cart</span>
        </NavLink>
        <NavLink to={`${base}/account`} aria-label="Profile" title="Profile">
          <TbUserCircle aria-hidden="true" /><span>Profile</span>
        </NavLink>
      </nav>}
      <CustomerDialog
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        customer={customer}
        onLogout={logout}
        store={store}
        storeSlug={storeSlug}
        onCustomerUpdated={(data) => setCustomer(data)}
      />
    </div>
  );
}


export function BeautyStoreLayout() {
  const { store, query } = useStore();
  if (query.isPending)
    return (
      <div className="ob-route-loader">
        <LoadingSpinner label="Loading store..." />
      </div>
    );
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
