import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const Context = createContext(null);
export const adminStoreKey = "ownshop:mobile-store";
export const validStoreSlug = value => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);
const standalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

export function AdminPwaProvider({ children }) {
  const { pathname, search } = useLocation();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(standalone);
  const [updateReady, setUpdateReady] = useState(false);
  const [installError, setInstallError] = useState("");
  const adminRoute = pathname.startsWith("/secure/admin") || pathname === "/admin-app" || pathname.startsWith("/admin-app/") || /^\/[^/]+\/secure\/admin(?:\/|$)/.test(pathname) || pathname === "/mobile" || pathname === "/demoadmin";
  const enabled = adminRoute && import.meta.env.VITE_APP_CLIENT !== "super-admin";

  useEffect(() => {
    if (!enabled) return;
    const match = pathname.match(/^\/([^/]+)\/secure\/admin(?:\/|$)/);
    const hint = match?.[1] || new URLSearchParams(search).get("store");
    if (validStoreSlug(hint)) localStorage.setItem(adminStoreKey, hint);
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/admin-app/manifest.webmanifest";
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = "/admin-app/icons/apple-touch-icon.png";
    const appleCapable = document.createElement("meta");
    appleCapable.name = "apple-mobile-web-app-capable";
    appleCapable.content = "yes";
    const appleTitle = document.createElement("meta");
    appleTitle.name = "apple-mobile-web-app-title";
    appleTitle.content = "OwnShop Admin";
    document.head.append(manifest, appleIcon, appleCapable, appleTitle);
    return () => { manifest.remove(); appleIcon.remove(); appleCapable.remove(); appleTitle.remove(); };
  }, [enabled, pathname, search]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const detectInstalled = async () => {
      if (standalone()) { setInstalled(true); return; }
      try {
        const apps = await navigator.getInstalledRelatedApps?.();
        if (active && apps?.some(app => app.platform === "webapp" && (
          new URL(app.url || "/", location.origin).href === `${location.origin}/admin-app/manifest.webmanifest` ||
          new URL(app.id || "/", location.origin).href === `${location.origin}/admin-app`
        ))) setInstalled(true);
      } catch { /* Browsers without installed-app detection still support standalone detection. */ }
    };
    detectInstalled();
    window.addEventListener("focus", detectInstalled);
    const capture = event => { event.preventDefault(); setInstallPrompt(event); };
    const complete = () => { setInstalled(true); setInstallPrompt(null); };
    const mode = window.matchMedia("(display-mode: standalone)");
    const modeChange = () => setInstalled(standalone());
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    mode.addEventListener("change", modeChange);
    return () => {
      active = false;
      window.removeEventListener("focus", detectInstalled);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      mode.removeEventListener("change", modeChange);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let stopped = false;
    let interval;
    let registration;
    const check = () => { if (navigator.onLine) registration?.update().catch(() => {}); };
    navigator.serviceWorker.register("/admin-sw.js", { scope: "/", updateViaCache: "none" }).then(value => {
      if (stopped) return;
      registration = value;
      if (value.waiting) setUpdateReady(true);
      value.addEventListener("updatefound", () => {
        const worker = value.installing;
        worker?.addEventListener("statechange", () => {
          if (!stopped && worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
      check();
      interval = window.setInterval(check, 60 * 60 * 1000);
    }).catch(() => { if (!stopped) setInstallError("App installation is unavailable. You can continue using the admin panel in your browser."); });
    return () => { stopped = true; window.clearInterval(interval); };
  }, [enabled]);

  const install = async () => {
    if (!installPrompt) return "unavailable";
    setInstallError("");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      return choice.outcome;
    } catch { setInstallError("Installation could not start. Use your browser menu to install the app."); return "failed"; }
    finally { setInstallPrompt(null); }
  };
  return <Context.Provider value={{ installed, canInstall: !!installPrompt, install, installError, updateReady }}>{children}</Context.Provider>;
}
export const useAdminPwa = () => useContext(Context);
