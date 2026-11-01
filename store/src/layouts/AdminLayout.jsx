import React, { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../application/providers/AuthProvider";
import { errorMessage } from "../services/api";
import { TbHome, TbBox, TbClipboardList, TbBuildingStore } from "react-icons/tb";
const navigation = [
  ["Dashboard", "dashboard", "▧"],
  ["Products", "products", "◇"],
  ["Categories", "categories", "▦"],
  ["Orders", "orders", "▤"],
  ["Customers", "customers", "♙"],
  ["Store Settings", "settings", "⚙"],
];
export function AdminLayout() {
  const { storeSlug } = useParams();
  const base = `/secure/admin`;
  const links = navigation.map(([label, path, icon]) => [label, `${base}/${path}`, icon]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate(`${base}/login`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <div className="app-container">
      {sidebarOpen && (
        <button
          className="drawer-overlay"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="admin-sidebar"
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
      >
        <div className="sidebar-header">
          <h2>Store Admin</h2>
          <button
            className="drawer-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="sidebar-profile">
          <span className="profile-circle">
            {user?.username?.[0]?.toUpperCase()}
          </span>
          <div>
            <strong>{user?.username}</strong>
            <small>Store Manager</small>
          </div>
        </div>
        <nav aria-label="Admin navigation">
          <ul>
            {links.map(([label, to, icon]) => (
              <li key={to}>
                <NavLink to={to} onClick={() => setSidebarOpen(false)}>
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-menu-btn"
              aria-label="Open menu"
              aria-controls="admin-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="muted">Your Store</span>
          </div>
          <div className="row">
            {user?.store?.slug && (
              <Link
                className="btn-primary"
                to={`/${user.store.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View Storefront ↗
              </Link>
            )}
            <span className="profile-circle">
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
          <Outlet />
        </div>
      </main>
      <nav className="admin-bottom-nav" aria-label="Mobile admin navigation">
        {[
          ["Home", links[0][1], TbHome],
          ["Products", links[1][1], TbBox],
          ["Orders", links[3][1], TbClipboardList],
          ["Store", `/`, TbBuildingStore],
        ].map(([label, to, Icon]) => (
          <NavLink key={to} to={to}>
            {React.createElement(Icon, { "aria-hidden": true })}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}