import React from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../application/providers/AuthProvider";
import { adminStoreKey, validStoreSlug } from "./AdminPwaProvider";

export default function AdminAppLaunch() {
  const { user, loading } = useAuth();
  if (loading) return <div className="state-card" role="status">Opening OwnShop Admin...</div>;
  if (user && !["ADMIN", "ECO"].includes(user.role)) return <main className="state-card"><h1>Store administrator access required</h1><p>Open your store's admin login with a store administrator account.</p><Link to="/mobile">Choose a store</Link></main>;
  const slug = user?.store?.slug || localStorage.getItem(adminStoreKey);
  if (!validStoreSlug(slug)) return <Navigate to="/mobile" replace />;
  return <Navigate to={`/${slug}/secure/admin/${user ? "dashboard" : "login"}`} replace />;
}
