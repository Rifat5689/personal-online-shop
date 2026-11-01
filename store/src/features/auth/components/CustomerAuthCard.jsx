import React from "react";
import {
  TbChevronLeft,
  TbUser,
  TbLock,
  TbEye,
  TbEyeOff,
} from "react-icons/tb";

export function CustomerAuthCard({
  auth,
  store,
  storeSlug,
  onBack,
  isModal = false,
}) {
  const {
    mode,
    switchMode,
    form,
    setField,
    showPassword,
    toggleShowPassword,
    pending,
    error,
    submit,
  } = auth;

  const isOrigins = storeSlug === "originsofbeauty";
  const brandTitle = isOrigins ? (
    <>
      Origins <em>of</em> Beauty
    </>
  ) : (
    store?.name || "Origins of Beauty"
  );

  return (
    <div
      className={`ob-auth-card ${isModal ? "ob-auth-card-modal" : ""}`}
      role="region"
      aria-label="Customer authentication"
    >
      {/* Top Bar with Back Button */}
      <div className="ob-auth-topbar">
        {onBack && (
          <button
            type="button"
            className="ob-auth-back-btn"
            onClick={onBack}
            aria-label="Go back"
          >
            <TbChevronLeft aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Brand Logo & Name */}
      <div className="ob-auth-brand-section">
        <div className="ob-auth-logo-badge" aria-hidden="true">
          {store?.profileImage?.url ? (
            <img
              src={store.profileImage.url}
              alt=""
              className="ob-auth-logo-img"
            />
          ) : (
            <span>O</span>
          )}
        </div>
        <div className="ob-auth-brand-text">{brandTitle}</div>
      </div>

      {/* Title & Subtitle */}
      <div className="ob-auth-header">
        <h1 className="ob-auth-title">
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="ob-auth-subtitle">
          {mode === "signin"
            ? "Sign in to continue to your account"
            : isOrigins
              ? "Join Origins of Beauty"
              : `Join ${store?.name || "our store"}`}
        </p>
      </div>

      {/* Segmented Control Tabs */}
      <div className="ob-auth-tabs" role="tablist" aria-label="Sign in or Sign up">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={`ob-auth-tab ${mode === "signin" ? "active" : ""}`}
          onClick={() => switchMode("signin")}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={`ob-auth-tab ${mode === "signup" ? "active" : ""}`}
          onClick={() => switchMode("signup")}
        >
          Sign Up
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="ob-auth-error" role="alert">
          {error}
        </div>
      )}

      {/* Form */}
      <form className="ob-auth-form" onSubmit={submit} noValidate>
        {/* Username input */}
        <div className="ob-auth-field">
          <label htmlFor="ob-username-input" className="ob-auth-label">
            Username
          </label>
          <div className="ob-auth-input-wrapper">
            <span className="ob-auth-input-icon" aria-hidden="true">
              <TbUser />
            </span>
            <input
              id="ob-username-input"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              className="ob-auth-input"
              placeholder={
                mode === "signin" ? "Enter your username" : "Choose a username"
              }
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
            />
          </div>
        </div>

        {/* Password input */}
        <div className="ob-auth-field">
          <label htmlFor="ob-password-input" className="ob-auth-label">
            Password
          </label>
          <div className="ob-auth-input-wrapper">
            <span className="ob-auth-input-icon" aria-hidden="true">
              <TbLock />
            </span>
            <input
              id="ob-password-input"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              className="ob-auth-input"
              placeholder={
                mode === "signin" ? "Enter your password" : "Create a password"
              }
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
            />
            <button
              type="button"
              className="ob-auth-eye-btn"
              onClick={toggleShowPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <TbEyeOff aria-hidden="true" />
              ) : (
                <TbEye aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="ob-auth-submit-btn"
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="ob-auth-spinner" aria-hidden="true" />
              <span>{mode === "signin" ? "Signing In..." : "Signing Up..."}</span>
            </>
          ) : (
            <span>{mode === "signin" ? "Sign In" : "Sign Up"}</span>
          )}
        </button>
      </form>

      {/* Footer Switch Link */}
      <div className="ob-auth-footer">
        {mode === "signin" ? (
          <p>
            Don't have an account?{" "}
            <button
              type="button"
              className="ob-auth-link"
              onClick={() => switchMode("signup")}
            >
              Sign Up
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              className="ob-auth-link"
              onClick={() => switchMode("signin")}
            >
              Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

