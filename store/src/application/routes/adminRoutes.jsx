import React from "react";
import { Routes, Route, Navigate, Link, useParams } from "react-router-dom";
import { ProfessionalAdminLayout as AdminLayout } from "../../layouts/ProfessionalAdminLayout";
import { ProtectedRoute } from "../../components/common/ProtectedRoute";
import Dashboard from "../../pages/admin/Dashboard";
import Products from "../../pages/admin/Products";
import Login from "../../pages/admin/Login/Login";
import Categories from "../../pages/admin/Categories/Categories";
import Orders from "../../pages/admin/Orders/Orders";
import Customers from "../../pages/admin/Customers/ProfessionalCustomers";
import { SettingsView } from "../../features/settings/components/SettingsView";
import { useStore } from "../providers/StoreProvider";
import { PageMetadata } from "../../components/common/PageMetadata";
import StoreAppPage from "../../features/pwa/StoreAppPage";
const AnalyticsPage = React.lazy(() => import("../../features/analytics/components/AnalyticsPage"));
const WhatsAppPage = React.lazy(() => import("../../features/whatsapp/WhatsAppPage"));

export default function AdminRoutes() {
  const storeSlug = "originsofbeauty";
  const base = `/secure/admin`;
  const loginPath = storeSlug === "demo-shop" ? "/demoadmin" : `${base}/login`;
  const { query } = useStore();
  if (query.isPending)
    return (
      <div className="state-card" role="status">
        Loading store...
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="state-card">
        <h1>Page not found</h1>
      </div>
    );
  return (
    <>
      <PageMetadata title="Merchant Login | Store Admin" noindex />
      <Routes>
        <Route path="login" element={storeSlug === "demo-shop" ? <Navigate to="/demoadmin" replace /> : <Login demo={import.meta.env.VITE_DEMO_MODE === "true"} />} />
        <Route
          element={
            <ProtectedRoute
              roles={["ADMIN", "ECO"]}
              loginPath={loginPath}
            />
          }
        >
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="whatsapp" element={<React.Suspense fallback={<div role="status">Loading inbox…</div>}><WhatsAppPage /></React.Suspense>} />
            <Route path="analytics" element={<><React.Suspense fallback={<div className="state-card" role="status">Loading analytics...</div>}><AnalyticsPage /></React.Suspense></>} />
            {["products", "products/create", "products/:id/edit"].map(
              (path) => (
                <Route key={path} path={path} element={<Products />} />
              ),
            )}
            <Route path="categories" element={<Categories />} />
            {["orders", "orders/:id"].map((path) => (
              <Route key={path} path={path} element={<Orders />} />
            ))}
            {["customers", "customers/:id"].map((path) => (
              <Route key={path} path={path} element={<Customers />} />
            ))}
            <Route path="settings" element={<SettingsView />} />
            <Route path="store-app" element={<StoreAppPage />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="state-card">
              <h1>Page not found</h1>
              <Link to={`${base}/dashboard`}>Dashboard</Link>
            </div>
          }
        />
      </Routes>
    </>
  );
}
