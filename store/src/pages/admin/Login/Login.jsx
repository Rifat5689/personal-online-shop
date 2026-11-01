import { usePageTranslation } from "../../../features/language/AdminLanguageProvider";
import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../../application/providers/AuthProvider";
import { TbEye, TbEyeOff } from "react-icons/tb";
import { useLogin } from "../../../features/auth/hooks/useLogin";
export default function Login({
  demo = false
}) {
  const {
    t
  } = usePageTranslation();
  const {
    storeSlug: routeStoreSlug
  } = useParams();
  const storeSlug = "originsofbeauty";
  const hook = useLogin(["ADMIN", "ECO"], `/secure/admin/dashboard`, demo);
  const [showPassword, setShowPassword] = useState(false);
  const { user, loading } = useAuth();
  if (!loading && ["ADMIN", "ECO"].includes(user?.role) && user?.store?.slug === storeSlug)
    return <Navigate to={`/secure/admin/dashboard`} replace />;
  return <main className="auth-page">
      <form className="auth-card form-stack" onSubmit={hook.submit}>
        <div className="auth-brand">{t("◉ OwnShop")}</div>
        <h1>{t("Merchant Login")}</h1>
        <p>{t("Sign in to manage your store.")}</p>
        {hook.isDemo && <p>{t("Demo credentials are filled in. Select Sign In to explore the merchant dashboard.")}</p>}
        <label>{t("Email or Username")}<input autoComplete="username" required value={hook.form.username} onChange={event => hook.setForm({
          ...hook.form,
          username: event.target.value
        })} />
        </label>
        <label>{t("Password")}<div style={{
          position: "relative",
          display: "flex",
          alignItems: "center"
        }}>
            <input autoComplete="current-password" type={showPassword ? "text" : "password"} required style={{
            width: "100%",
            paddingRight: "40px"
          }} value={hook.form.password} onChange={event => hook.setForm({
            ...hook.form,
            password: event.target.value
          })} />
            <button type="button" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? "Hide password" : "Show password"} style={{
            position: "absolute",
            right: "10px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#71717a",
            display: "flex",
            alignItems: "center",
            padding: "4px"
          }}>
              {t(showPassword ? <TbEyeOff size={18} /> : <TbEye size={18} />)}
            </button>
          </div>
        </label>

        {hook.error && <p role="alert" className="error">
            {hook.error}
          </p>}
        <button className="btn-primary" disabled={hook.pending}>
          {t(hook.pending ? "Signing In..." : "Sign In")}
        </button>
        <Link to={`/`}>{t("View Store")}</Link>
        {hook.isDemo && <Link to="/products">{t("Browse demo products")}</Link>}
      </form>
    </main>;
}
