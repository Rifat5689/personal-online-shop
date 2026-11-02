import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import User from "../user/user.model.js";
import Store from "../store/store.model.js";

export function createChatTicket(user, store) {
  return jwt.sign({ userId: String(user._id), storeId: String(store._id) }, process.env.ACCESS_TOKEN_SECRET, { audience: "whatsapp-live", expiresIn: "45s", jwtid: randomUUID() });
}

export function attachWhatsAppLive(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  let stream, retry, stopped = false;
  const send = (socket, event) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 64000) return socket.terminate();
    socket.send(JSON.stringify(event));
  };
  const broadcast = (event, storeId) => {
    for (const socket of wss.clients) if (socket.chatIdentity && (!storeId || socket.chatIdentity.storeId === storeId)) send(socket, event);
  };
  const watch = () => {
    if (stopped || stream || mongoose.connection.readyState !== 1 || !wss.clients.size) return;
    stream = mongoose.connection.watch([{ $match: { "ns.coll": { $in: ["whatsappconversations", "whatsappmessages", "whatsappaisettings", "whatsappaijobs"] } } }], { fullDocument: "updateLookup", maxAwaitTimeMS: 1000 });
    stream.on("change", event => {
      const storeId = event.fullDocument?.store && String(event.fullDocument.store);
      // Notifications carry no message text. Every data read still passes HTTP admin auth.
      broadcast({ type: "invalidate" }, storeId);
    });
    stream.on("error", () => {
      const previous = stream; stream = null;
      void previous?.close().catch(() => {});
      broadcast({ type: "unavailable" });
      clearTimeout(retry);
      if (!stopped) retry = setTimeout(() => { watch(); broadcast({ type: "resync" }); }, 5000);
    });
  };
  const upgrade = (req, socket, head) => {
    if (req.url !== "/api/v1/whatsapp/live") return;
    const origins = (process.env.CORS_ORIGIN || "").split(",").map(origin => origin.trim());
    if (stopped || !origins.includes(req.headers.origin) || wss.clients.size >= 100 || mongoose.connection.readyState !== 1) return socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws));
  };
  server.on("upgrade", upgrade);
  wss.on("connection", socket => {
    let authenticating = false, alive = true;
    const authTimer = setTimeout(() => socket.close(1008, "Authentication required"), 5000);
    const renewTimer = setTimeout(() => socket.close(4001, "Renew connection"), 300000);
    socket.on("error", () => {});
    socket.on("pong", () => { alive = true; });
    const heartbeat = setInterval(async () => {
      if (!alive) return socket.terminate();
      alive = false; socket.ping();
      if (socket.chatIdentity) {
        const { userId, storeId } = socket.chatIdentity;
        try {
          const allowed = await User.exists({ _id: userId, tenantId: storeId, role: { $in: ["ADMIN", "ECO"] }, isActive: { $ne: false } });
          const store = await Store.exists({ _id: storeId, status: "ACTIVE", slug: process.env.STORE_SLUG || "originsofbeauty" });
          if (!allowed || !store) return socket.close(4403, "Access denied");
          send(socket, { type: "heartbeat" });
        } catch { socket.close(1011, "Connection unavailable"); }
      }
    }, 20000);
    socket.on("message", async raw => {
      if (socket.chatIdentity || authenticating) return socket.close(1008, "Unexpected request");
      authenticating = true;
      try {
        const event = JSON.parse(raw.toString());
        if (event.type !== "auth" || typeof event.ticket !== "string") throw Error("Invalid ticket");
        const claims = jwt.verify(event.ticket, process.env.ACCESS_TOKEN_SECRET, { audience: "whatsapp-live", algorithms: ["HS256"] });
        const allowed = await User.exists({ _id: claims.userId, tenantId: claims.storeId, role: { $in: ["ADMIN", "ECO"] }, isActive: { $ne: false } });
        const store = await Store.exists({ _id: claims.storeId, status: "ACTIVE", slug: process.env.STORE_SLUG || "originsofbeauty" });
        if (!allowed || !store) throw Error("Access denied");
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.chatIdentity = { userId: claims.userId, storeId: claims.storeId };
        clearTimeout(authTimer);
        watch();
        send(socket, { type: "ready" });
      } catch { socket.close(1008, "Invalid authentication"); }
    });
    socket.on("close", () => { clearTimeout(authTimer); clearTimeout(renewTimer); clearInterval(heartbeat); });
  });
  return () => {
    stopped = true; clearTimeout(retry); server.off("upgrade", upgrade);
    for (const socket of wss.clients) socket.terminate();
    wss.close(); void stream?.close().catch(() => {});
  };
}
