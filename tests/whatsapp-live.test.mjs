import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import { WebSocket } from "../backend/node_modules/ws/wrapper.mjs";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import { Conversation, Message } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { attachWhatsAppLive } from "../backend/src/modules/whatsapp/whatsapp.live.js";
import { attachLiveAnalytics } from "../backend/src/modules/analytics/live.server.js";
import { app } from "../backend/src/app.js";

const receive = (socket, type) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off("message", listener); reject(Error(`No ${type} event`)); }, 10000);
  const listener = raw => { const event = JSON.parse(raw); if (event.type === type) { clearTimeout(timer); socket.off("message", listener); resolve(event); } };
  socket.on("message", listener);
});
test("WhatsApp WebSockets require admin tickets and push database changes without polling", { timeout: 60000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "ws-test-secret", CORS_ORIGIN: "http://localhost:3001" });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0);
  const stopAnalytics = attachLiveAnalytics(server), stopChat = attachWhatsAppLive(server);
  const sockets = [];
  try {
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const user = await User.create({ username: "ws-admin", email: "ws@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    const chat = await Conversation.create({ store: store._id, phone: "8801700000000" });
    const root = `http://127.0.0.1:${server.address().port}/api/v1`;
    assert.equal((await fetch(root + "/whatsapp/live-ticket", { method: "POST" })).status, 401);
    const response = await fetch(root + "/whatsapp/live-ticket", { method: "POST", headers: { Authorization: `Bearer ${user.generateAccessToken()}` } });
    assert.equal(response.status, 200);
    const { ticket } = (await response.json()).data;
    const url = root.replace("http:", "ws:") + "/whatsapp/live";
    const socket = new WebSocket(url, { origin: "http://localhost:3001" }); sockets.push(socket);
    const ready = receive(socket, "ready");
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    socket.send(JSON.stringify({ type: "auth", ticket })); await ready;
    const incoming = receive(socket, "invalidate");
    const row = await Message.create({ store: store._id, conversation: chat._id, direction: "inbound", text: "Live message", timestamp: new Date() });
    assert.deepEqual(await incoming, { type: "invalidate" });
    const receipt = receive(socket, "invalidate");
    await Message.updateOne({ _id: row._id }, { $set: { status: "read" } }); await receipt;
    // Mirrored replace events use the same change stream and must update the testing inbox.
    const mirrored = receive(socket, "invalidate");
    await Message.replaceOne({ _id: row._id }, { store: store._id, conversation: chat._id, direction: "inbound", text: "Mirrored update", timestamp: new Date() }); await mirrored;
    const invalid = new WebSocket(url, { origin: "http://localhost:3001" }); sockets.push(invalid);
    const closed = new Promise(resolve => invalid.once("close", code => resolve(code)));
    invalid.once("open", () => invalid.send(JSON.stringify({ type: "auth", ticket: "invalid" })));
    assert.equal(await closed, 1008);
    const denied = new WebSocket(url, { origin: "https://untrusted.example" }); sockets.push(denied);
    const rejected = new Promise(resolve => { denied.once("unexpected-response", (_req, res) => { res.resume(); denied.terminate(); resolve(res.statusCode); }); denied.on("error", () => {}); });
    assert.equal(await rejected, 403);
  } finally {
    sockets.forEach(socket => socket.terminate()); stopChat(); stopAnalytics();
    await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db.stop();
  }
});
