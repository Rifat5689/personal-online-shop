import {
  usePageTranslation,
  AdminLanguageProvider,
} from "../features/language/AdminLanguageProvider";
import { useMerchantPanel } from "../application/providers/MerchantPanelProvider";
import React, { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  TbCrown,
  TbDeviceMobile,
  TbArrowLeft,
  TbRecycle,
  TbBuildingStore,
  TbBox,
  TbCategory,
  TbHomeStats,
  TbChartBar,
  TbLayoutGrid,
  TbLogout,
  TbMenu2,
  TbPackage,
  TbSettings,
  TbShoppingCart,
  TbSmartHome,
  TbUsers,
  TbX,
} from "react-icons/tb";
import { useAuth } from "../application/providers/AuthProvider";
import { errorMessage } from "../services/api";
import AdminNotifications from "../features/notifications/AdminNotifications";
const navigation = [
  ["Overview", "dashboard", TbHomeStats],
  ["Analytics", "analytics", TbChartBar],
  ["Products", "products", TbPackage],
  ["Categories", "categories", TbCategory],
  ["Orders", "orders", TbShoppingCart],
  ["Customers", "customers", TbUsers],
  ["Store Settings", "settings", TbSettings],
];
function MerchantLayoutContent() {
  const { t } = usePageTranslation();
  const { storeSlug, base, ownerAccess, ownerName } = useMerchantPanel();
  const links = [
    ...navigation,
    ...(!ownerAccess ? [["Store App", "store-app", TbDeviceMobile]] : []),
    ...(ownerAccess ? [["Recycle products", "recycle", TbRecycle]] : []),
  ].map(([label, path, Icon]) => [label, `${base}/${path}`, Icon]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingMutations = useIsMutating();
  const pendingQueries = useIsFetching({
    predicate: (query) => query.queryKey[0] !== "mobileNotifications",
  });
  useEffect(() => {
    const close = (event) => event.key === "Escape" && setSidebarOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate(
        ownerAccess
          ? "/login"
          : storeSlug === "demo-shop"
            ? "/demoadmin"
            : `${base}/login`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  };
  const storefrontPath = `/`;
  const storefrontUrl = ownerAccess
    ? `${import.meta.env.VITE_STOREFRONT_URL || "http://localhost:3001"}${storefrontPath}`
    : storefrontPath;
  return (
    <div className="app-container">
      {sidebarOpen && (
        <button
          className="drawer-overlay"
          aria-label={t("Close menu")}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="admin-sidebar"
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
      >
        <div className="sidebar-header">
          <TbShoppingCart className="sidebar-logo" aria-hidden="true" />
          <h2>{t("Store Admin")}</h2>
          <button
            className="drawer-close"
            aria-label={t("Close menu")}
            onClick={() => setSidebarOpen(false)}
          >
            <TbX />
          </button>
        </div>
        <div className="sidebar-profile">
          <span className="profile-circle">
            {user?.username?.[0]?.toUpperCase()}
          </span>
          <div>
            <strong>{user?.username}</strong>
            <small>
              {t(ownerAccess ? `Viewed by ${ownerName}` : "Store Manager")}
            </small>
          </div>
        </div>
        <nav aria-label={t("Admin navigation")}>
          <ul>
            {links.map(([label, to, Icon]) => (
              <li key={to}>
                <NavLink to={to} onClick={() => setSidebarOpen(false)}>
                  {React.createElement(Icon, {
                    "aria-hidden": true,
                  })}
                  {t(label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          {ownerAccess && (
            <Link className="merchant-return" to="/admins">
              <TbArrowLeft aria-hidden="true" />
              {t("Back to admins")}
            </Link>
          )}
          <button onClick={signOut} disabled={signingOut}>
            <TbLogout aria-hidden="true" />
            {t(signingOut ? "Signing out..." : "Logout")}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="row topbar-left">
            <button
              className="mobile-menu-btn"
              aria-label={t("Open menu")}
              aria-controls="admin-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <TbMenu2 />
            </button>
            <div className="topbar-store-badge">
              <div className="store-badge-icon" aria-hidden="true">
                <TbBuildingStore />
              </div>
              <span className="store-badge-name">
                {user?.store?.name || "Your Store"}
              </span>
            </div>
          </div>
          <div className="row topbar-right">
            {(pendingMutations > 0 || pendingQueries > 0) && (
              <span className="admin-network-status" role="status">
                <span className="spinner" aria-hidden="true" />
                <span>{t(pendingMutations > 0 ? "Saving…" : "Loading…")}</span>
              </span>
            )}
            <AdminNotifications base={base} />
            <span className="profile-circle desktop-only">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
        </header>
        <div className="content-area">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div key={location.pathname} className="admin-page-transition">
            <Outlet />
          </div>
        </div>
      </main>
      <nav
        className="admin-bottom-nav"
        aria-label={t("Mobile admin navigation")}
      >
        <NavLink
          to={`${base}/dashboard`}
          end
          className={({ isActive }) => (isActive ? "active" : "")}
          aria-label={t("Overview")}
        >
          <TbSmartHome aria-hidden="true" />
          <span>{t("Home")}</span>
        </NavLink>
        <NavLink to={`${base}/analytics`} aria-label={t("Analytics")}>
          <TbChartBar aria-hidden="true" />
          <span>{t("Analytics")}</span>
        </NavLink>
        <NavLink
          to={`${base}/products`}
          className={({ isActive }) => (isActive ? "active" : "")}
          aria-label={t("Products")}
        >
          <TbBox aria-hidden="true" />
          <span>{t("Products")}</span>
        </NavLink>
        <NavLink
          to={`${base}/orders`}
          className={({ isActive }) => (isActive ? "active" : "")}
          aria-label={t("Orders")}
        >
          <TbLayoutGrid aria-hidden="true" />
          <span>{t("Orders")}</span>
        </NavLink>
        <Link
          to={storefrontUrl}
          target="_blank"
          aria-label={t("Store")}
        >
          <TbBuildingStore aria-hidden="true" />
          <span>{t("Store")}</span>
        </Link>
      </nav>
    </div>
  );
}

export function ProfessionalAdminLayout() {
  return (
    <AdminLanguageProvider>
      <MerchantLayoutContent />
    </AdminLanguageProvider>
  );
}
