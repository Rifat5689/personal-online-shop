import { usePageTranslation } from "../../features/language/AdminLanguageProvider";
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useStore } from "../../application/providers/StoreProvider";
import { useAuth } from "../../application/providers/AuthProvider";
export function ProtectedRoute({
  roles,
  loginPath
}) {
  const {
    t
  } = usePageTranslation();
  const {
    user,
    loading
  } = useAuth();
  const {
    store,
    query
  } = useStore();
  if (loading || query.isPending) return <div className="state-card" role="status">{t("Checking session...")}</div>;
  if (!user || !roles.includes(user.role)) return <Navigate to={loginPath} replace />;
  if (user.role !== "SUPER_ADMIN" && !user.tenantId) return <div className="state-card" role="alert">{t("Your account needs a store assignment. Contact support.")}</div>;
  if (query.isError || !store) return <div className="state-card"><h1>{t("Page not found")}</h1></div>;
  if (String(user.tenantId?._id || user.tenantId) !== String(store._id)) return <Navigate to={loginPath} replace />;
  return <Outlet />;
}
