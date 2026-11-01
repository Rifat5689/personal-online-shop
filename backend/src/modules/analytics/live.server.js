import {
  analyticsAllowedFor,
  entitlement,
  subscriptionConfig,
  billingStore,
} from "../subscription/subscription.service.js";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Presence from "./live.model.js";
import Product from "../product/product.model.js";
import Store from "../store/store.model.js";
import User from "../user/user.model.js";
const pages = new Set([
  "home",
  "products",
  "product",
  "category",
  "cart",
  "checkout",
  "orders",
  "account",
  "auth",
  "other",
]);

export async function liveSnapshot(tenantId) {
  const people = await Presence.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        expiresAt: { $gt: new Date() },
      },
    },
    { $sort: { updatedAt: -1, _id: 1 } },
    {
      $group: {
        _id: "$visitorId",
        page: { $first: "$page" },
        productId: { $first: "$productId" },
      },
    },
  ]);
  const pageCounts = new Map();
  const productCounts = new Map();
  for (const person of people) {
    pageCounts.set(person.page, (pageCounts.get(person.page) || 0) + 1);
    if (person.productId) {
      const id = String(person.productId);
      productCounts.set(id, (productCounts.get(id) || 0) + 1);
    }
  }
  const products = await Product.find({
    _id: { $in: [...productCounts.keys()] },
    tenantId,
    deletedAt: null,
    isActive: true,
  })
    .select("name slug")
    .lean();
  return {
    type: "snapshot",
    total: people.length,
    updatedAt: new Date().toISOString(),
    pages: [...pageCounts]
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count),
    products: products
      .map((p) => ({
        id: String(p._id),
        name: p.name,
        slug: p.slug,
        count: productCounts.get(String(p._id)),
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export function attachLiveAnalytics(server, { intervalMs = 3000 } = {}) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  let stopped = false;
  let broadcasting = false;
  const send = (ws, value) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 256000) ws.terminate();
      else ws.send(JSON.stringify(value));
    }
  };
  const upgrade = (req, socket, head) => {
    const origin = req.headers.origin;
    const allowed = (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim());
    const local =
      process.env.NODE_ENV !== "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
    if (
      req.url !== "/api/v1/analytics/live" ||
      !origin ||
      (!allowed.includes(origin) && !local) ||
      wss.clients.size >= 2000 ||
      stopped
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  };
  server.on("upgrade", upgrade);
  wss.on("connection", (ws) => {
    const id = randomUUID();
    let identity;
    let queue = Promise.resolve();
    let messages = 0;
    let windowStart = Date.now();
    let refreshTimer;
    let lastPong = Date.now();
    const authTimer = setTimeout(
      () => ws.close(1008, "Authentication required"),
      5000,
    );
    ws.on("error", () => {});
    ws.on("pong", () => {
      lastPong = Date.now();
    });
    const heartbeat = setInterval(() => {
      if (Date.now() - lastPong > 45000) ws.terminate();
      else ws.ping();
    }, 20000);
    ws.on("message", (raw) => {
      if (Date.now() - windowStart > 60000) {
        messages = 0;
        windowStart = Date.now();
      }
      if (++messages > 90) {
        ws.close(1008, "Too many updates");
        return;
      }
      queue = queue
        .then(async () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const message = JSON.parse(raw.toString());
          if (!identity) {
            if (message.type !== "auth")
              throw new Error("Authentication required");
            const claims = jwt.verify(
              message.ticket,
              process.env.ACCESS_TOKEN_SECRET,
              { audience: "live-analytics" },
            );
            if (
              !["admin", "visitor"].includes(claims.role) ||
              !(await Store.exists({ _id: claims.tenantId, status: "ACTIVE" }))
            )
              throw new Error("Store unavailable");
            if (claims.role === "admin") {
              const user = await User.findById(claims.userId)
                .select("role tenantId isActive analyticsAccess")
                .lean();
              if (
                !user ||
                user.isActive === false ||
                !["ADMIN", "ECO", "SUPER_ADMIN"].includes(user.role) ||
                (user.role !== "SUPER_ADMIN" &&
                  String(user.tenantId) !== claims.tenantId)
              )
                throw new Error("Access denied");
              if (!(await analyticsAllowedFor(claims.tenantId, user)))
                throw new Error("Analytics access denied");
            }
            if (ws.readyState !== WebSocket.OPEN) return;
            identity = claims;
            ws.liveIdentity = claims;
            clearTimeout(authTimer);
            refreshTimer = setTimeout(
              () => ws.close(4001, "Renew connection"),
              claims.role === "admin" ? 300000 : 1800000,
            );
            send(ws, { type: "ready" });
            if (claims.role === "admin")
              send(ws, await liveSnapshot(claims.tenantId));
            return;
          }
          if (identity.role !== "visitor" || message.type !== "presence")
            return;
          if (message.visible !== true) {
            await Presence.deleteOne({ _id: id });
            return;
          }
          const page = pages.has(message.page) ? message.page : "other";
          let productId = null;
          if (
            page === "product" &&
            typeof message.productSlug === "string" &&
            message.productSlug.length <= 200
          ) {
            const product = await Product.findOne({
              tenantId: identity.tenantId,
              slug: message.productSlug,
              isActive: true,
              deletedAt: null,
            })
              .select("_id")
              .lean();
            productId = product?._id || null;
          }
          await Presence.updateOne(
            { _id: id },
            {
              $set: {
                tenantId: identity.tenantId,
                visitorId: identity.visitorId,
                page,
                productId,
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() + 45000),
              },
            },
            { upsert: true },
          );
        })
        .catch(() => ws.close(1008, "Invalid live request"));
    });
    ws.on("close", () => {
      clearTimeout(authTimer);
      clearTimeout(refreshTimer);
      clearInterval(heartbeat);
      queue.finally(() => Presence.deleteOne({ _id: id }).catch(() => {}));
    });
  });
  const timer = setInterval(async () => {
    if (broadcasting || stopped) return;
    broadcasting = true;
    try {
      const tenants = new Set(
        [...wss.clients]
          .filter((ws) => ws.liveIdentity?.role === "admin")
          .map((ws) => ws.liveIdentity.tenantId),
      );
      const config = tenants.size ? await subscriptionConfig() : null;
      for (const tenantId of tenants) {
        const watchers = [...wss.clients].filter(
          (ws) =>
            ws.liveIdentity?.role === "admin" &&
            ws.liveIdentity.tenantId === tenantId,
        );
        const stored = await Store.findById(tenantId).lean();
        const store = stored ? await billingStore(stored) : null;
        const users = await User.find({
          _id: { $in: watchers.map((ws) => ws.liveIdentity.userId) },
        })
          .select("role tenantId isActive analyticsAccess")
          .lean();
        const allowed = watchers.filter((ws) => {
          const user = users.find(
            (item) => String(item._id) === ws.liveIdentity.userId,
          );
          const permit =
            store?.status === "ACTIVE" &&
            user?.isActive !== false &&
            user &&
            (user.role === "SUPER_ADMIN" ||
              (String(user.tenantId) === tenantId &&
                entitlement(store, user, config).analyticsAllowed));
          if (!permit) ws.close(4403, "Analytics access denied");
          return permit;
        });
        if (allowed.length) {
          const snapshot = await liveSnapshot(tenantId);
          for (const ws of allowed) send(ws, snapshot);
        }
      }
    } catch {
      for (const ws of wss.clients)
        if (ws.liveIdentity?.role === "admin")
          send(ws, { type: "unavailable" });
    } finally {
      broadcasting = false;
    }
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
    server.off("upgrade", upgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
