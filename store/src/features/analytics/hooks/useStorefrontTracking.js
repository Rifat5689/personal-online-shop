import { useLiveVisitors } from "./useLiveVisitors";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../tracking";
export function useStorefrontTracking(storeSlug) {
  useLiveVisitors(storeSlug);
  const location = useLocation();
  const last = useRef("");
  useEffect(() => {
    const key = `${storeSlug}:${location.key}`;
    if (last.current === key) return;
    last.current = key;
    const parts = location.pathname.split("/").filter(Boolean);
    const page = !parts.length ? "home" : parts[0] === "products" ? parts.length > 1 ? "product" : "products" : parts[0] === "categories" ? "category" : ["login", "signup", "signin", "register"].includes(parts[0]) ? "auth" : ["cart", "checkout", "orders", "account"].includes(parts[0]) ? parts[0] : "other";
    trackEvent(storeSlug, "page_view", { page });
    if (page === "checkout") trackEvent(storeSlug, "checkout_start", { page });
  }, [storeSlug, location.key, location.pathname]);
  useEffect(() => {
    let activeAt = Date.now();
    let previous = Date.now();
    const active = () => { activeAt = Date.now(); };
    const visibility = () => { previous = Date.now(); };
    for (const type of ["pointerdown", "pointermove", "keydown", "scroll"]) window.addEventListener(type, active, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      const now = Date.now();
      const seconds = Math.min(30, Math.floor((now - previous) / 1000));
      previous = now;
      if (!document.hidden && now - activeAt < 60000 && seconds > 0) trackEvent(storeSlug, "engagement", { seconds });
    }, 30000);
    return () => {
      clearInterval(timer);
      for (const type of ["pointerdown", "pointermove", "keydown", "scroll"]) window.removeEventListener(type, active);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [storeSlug]);
}
