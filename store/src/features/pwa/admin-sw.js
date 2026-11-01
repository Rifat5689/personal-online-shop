import { precacheAndRoute, matchPrecache, cleanupOutdatedCaches } from "workbox-precaching";

// This allowlist contains build-time static assets only. No HTML app shell,
// API responses, images uploaded by users, credentials or tenant data.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// No skipWaiting or automatic reload: upgrades activate after existing tabs close.
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const adminPath = url.pathname === "/admin-app" || url.pathname.startsWith("/admin-app/") || /^\/[^/]+\/secure\/admin(?:\/|$)/.test(url.pathname) || url.pathname === "/mobile" || url.pathname === "/demoadmin";
  if (event.request.mode !== "navigate" || url.origin !== self.location.origin || !adminPath) return;
  event.respondWith(fetch(event.request, { cache: "no-store" }).catch(async () =>
    await matchPrecache("/admin-app/offline.html") || Response.error(),
  ));
});
