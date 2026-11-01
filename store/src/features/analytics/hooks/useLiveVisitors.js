import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { connectLive } from "../liveConnection";
let fallbackId;
function visitorId() {
  try {
    let id = localStorage.getItem("ownshop:live-visitor");
    if (!/^[a-f0-9-]{36}$/i.test(id || "")) { id = crypto.randomUUID(); localStorage.setItem("ownshop:live-visitor", id); }
    return id;
  } catch { return fallbackId ||= crypto.randomUUID(); }
}
export function useLiveVisitors(storeSlug) {
  const { pathname } = useLocation();
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const publish = useRef(() => {});
  useEffect(() => {
    if (!storeSlug) return;
    let activeAt = Date.now();
    let connection;
    const send = () => {
      const parts = currentPath.current.split("/").filter(Boolean);
      const page = !parts.length ? "home" : parts[0] === "products" ? parts.length > 1 ? "product" : "products" : parts[0] === "categories" ? "category" : ["login", "signup", "signin", "register"].includes(parts[0]) ? "auth" : ["cart", "checkout", "orders", "account"].includes(parts[0]) ? parts[0] : "other";
      connection?.send({ type: "presence", page, productSlug: page === "product" ? decodeURIComponent(parts[1]) : undefined, visible: !document.hidden && Date.now() - activeAt < 300000 });
    };
    const active = () => { const idle = Date.now() - activeAt >= 300000; activeAt = Date.now(); if (idle) send(); };
    const hide = () => connection?.send({ type: "presence", visible: false });
    const visibility = () => { if (!document.hidden) activeAt = Date.now(); send(); };
    connection = connectLive({ ticketPath: `/analytics/store/${encodeURIComponent(storeSlug)}/live-ticket`, ticketBody: { visitorId: visitorId() }, onMessage: message => { if (message.type === "ready") send(); } });
    publish.current = () => { activeAt = Date.now(); send(); };
    const timer = setInterval(send, 15000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    for (const event of ["pointerdown", "keydown", "scroll"]) window.addEventListener(event, active, { passive: true });
    return () => {
      publish.current = () => {};
      clearInterval(timer); connection.close();
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
      for (const event of ["pointerdown", "keydown", "scroll"]) window.removeEventListener(event, active);
    };
  }, [storeSlug]);
  useEffect(() => { publish.current(); }, [pathname]);
}
