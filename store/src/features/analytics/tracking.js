import { request } from "../../services/api";
const memory = new Map();
export function getAnalyticsSession(storeSlug) {
  const key = `ownshop:analytics:${storeSlug}`;
  let session = memory.get(key);
  try { session = JSON.parse(sessionStorage.getItem(key)) || session; } catch { /* Storage is optional. */ }
  if (!session || Date.now() - session.lastActive > 30 * 60000) {
    let source = "Direct";
    try { const referrer = new URL(document.referrer); if (referrer.hostname !== location.hostname) source = referrer.hostname; } catch { /* Direct entry. */ }
    session = { id: crypto.randomUUID(), source };
  }
  session.lastActive = Date.now();
  memory.set(key, session);
  try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* Keep the session in memory. */ }
  return session;
}
export function trackEvent(storeSlug, type, details = {}) {
  try {
    const session = getAnalyticsSession(storeSlug);
    const width = window.innerWidth;
    request("post", `/analytics/store/${encodeURIComponent(storeSlug)}/events`, {
      ...details, type, eventId: crypto.randomUUID(), sessionId: session.id,
      source: session.source, device: width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop",
    }).catch(() => {});
  } catch { /* Telemetry must never interrupt shopping. */ }
}
