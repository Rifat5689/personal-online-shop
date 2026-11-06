import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import Product from "../backend/src/modules/product/product.model.js";
import { Conversation, Message, AISettings } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { ShoppingSession, StagingAISettings } from "../backend/src/modules/whatsapp/whatsapp.shopping.models.js";
import { app } from "../backend/src/app.js";
const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
const mp4 = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from("ftypisom0000avc1")]);
test("manual photo/video uploads enforce AI off, privacy, reply windows and idempotent sends", { timeout: 60000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "media-tests", META_WHATSAPP_ACCESS_TOKEN: "private-meta-test", META_WHATSAPP_PHONE_NUMBER_ID: "123456", META_GRAPH_API_VERSION: "v25.0" });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  await Promise.all([Store.init(), User.init(), Conversation.init(), Message.init()]);
  const server = app.listen(0), original = globalThis.fetch;
  let uploads = 0, sends = 0, uncertain = false, takeover, activeChat;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://graph.facebook.com/")) {
      assert.equal(options.headers.Authorization, "Bearer private-meta-test");
      if (String(url).endsWith("/media")) { uploads++; if (takeover) await Conversation.updateOne({ _id: activeChat._id }, { $set: { aiEnabled: true } }); return new Response(JSON.stringify({ id: "987654321" })); }
      if (String(url).endsWith("/messages")) { sends++; const body = JSON.parse(options.body); assert.equal(body[body.type].id, "987654321"); if (uncertain) throw Error("Network interrupted"); return new Response(JSON.stringify({ messages: [{ id: `wamid.media-${sends}` }] })); }
      return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/video", mime_type: "video/mp4", file_size: mp4.length }));
    }
    if (String(url).startsWith("https://lookaside.fbsbx.com/")) return new Response(mp4);
    return original(url, options);
  };
  try {
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const admin = await User.create({ username: "media-admin", email: "media@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    activeChat = await Conversation.create({ store: store._id, phone: "8801300000000", lastInboundAt: new Date() });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp`, headers = { Authorization: `Bearer ${admin.generateAccessToken()}` };
    const send = (bytes = png, mime = "image/png", id = randomUUID(), caption = "Product photo") => { const form = new FormData(); form.append("file", new Blob([bytes], { type: mime }), "attachment"); form.append("caption", caption); form.append("requestId", id); return original(base + `/conversations/${activeChat._id}/media`, { method: "POST", headers, body: form }); };
    const id = randomUUID();
    const [first, repeated] = await Promise.all([send(png, "image/png", id), send(png, "image/png", id)]);
    assert.equal(first.status, 200); assert.equal(repeated.status, 200); assert.equal(uploads, 1); assert.equal(sends, 1);
    assert.equal((await send(png, "image/png", id)).status, 200); assert.equal(sends, 1);
    assert.equal((await send(mp4, "video/mp4", id)).status, 409);
    const video = await send(mp4, "video/mp4", randomUUID(), ""); assert.equal(video.status, 200);
    const row = (await video.json()).data; assert.equal(row.type, "video"); assert.equal(row.mediaId, "987654321");
    const preview = await original(base + `/messages/${row._id}/media`, { headers }); assert.equal(preview.status, 200); assert.equal(preview.headers.get("cache-control"), "private, no-store");
    assert.equal((await original(base + `/messages/${row._id}/media`)).status, 401);
    const other = await Store.create({ name: "Other", slug: "other" });
    const outsider = await User.create({ username: "other-media", email: "other-media@example.test", password: "123456", role: "ADMIN", tenantId: other._id });
    assert.ok([403, 404].includes((await original(base + `/messages/${row._id}/media`, { headers: { Authorization: `Bearer ${outsider.generateAccessToken()}` } })).status));
    assert.equal((await send(Buffer.from("html"), "image/png")).status, 400);
    assert.equal((await send(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")).status, 400);
    await AISettings.create({ store: store._id, enabled: true }); await Conversation.updateOne({ _id: activeChat._id }, { $set: { aiEnabled: true } });
    const before = sends; assert.equal((await send()).status, 409); assert.equal(sends, before);
    await Conversation.updateOne({ _id: activeChat._id }, { $set: { aiEnabled: false } });
    takeover = true; assert.equal((await send()).status, 409); assert.equal(sends, before); takeover = false;
    await AISettings.updateOne({ store: store._id }, { $set: { enabled: false } }); await Conversation.updateOne({ _id: activeChat._id }, { $set: { aiEnabled: false } });
    uncertain = true; const uncertainId = randomUUID(); const unknown = await send(png, "image/png", uncertainId);
    assert.equal((await unknown.json()).data.status, "unknown"); const after = sends;
    assert.equal((await send(png, "image/png", uncertainId)).status, 200); assert.equal(sends, after);
    await Conversation.updateOne({ _id: activeChat._id }, { $set: { lastInboundAt: new Date(0) } });
    assert.equal((await send()).status, 409);
  } finally { globalThis.fetch = original; server.close(); server.closeAllConnections(); await mongoose.disconnect(); await db.stop(); }
});
test("a full 40-message shopping history continues to send new replies exactly once", { timeout: 60000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_ROLE: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "history-tests", META_WHATSAPP_ACCESS_TOKEN: "qa", META_WHATSAPP_PHONE_NUMBER_ID: "123456", META_GRAPH_API_VERSION: "v25.0", WHATSAPP_TEST_RECIPIENTS: "8801300000000" });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } }); await mongoose.connect(db.getUri());
  const server = app.listen(0), original = globalThis.fetch; let sends = 0;
  globalThis.fetch = async (url, options) => String(url).startsWith("https://graph.facebook.com/") ? new Response(JSON.stringify({ messages: [{ id: `wamid.history-${++sends}` }] })) : original(url, options);
  try {
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const admin = await User.create({ username: "history-admin", email: "history@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    await Conversation.create({ store: store._id, phone: "8801300000000", lastInboundAt: new Date() });
    const product = await Product.create({ tenantId: store._id, name: "Product", slug: "product", price: 100 });
    await StagingAISettings.create({ store: store._id, instructions: "Reply briefly" });
    const session = await ShoppingSession.create({ store: store._id, owner: admin._id, phone: "8801300000000", history: Array.from({ length: 40 }, (_, i) => ({ direction: i % 2 ? "outbound" : "inbound", text: `Message ${i}`, ...(i % 2 ? { products: [{ id: String(product._id) }] } : {}) })) });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp/shopping/sessions/${session._id}`;
    const call = (path, method, body = {}) => original(base + path, { method, headers: { Authorization: `Bearer ${admin.generateAccessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    for (let round = 0; round < 2; round++) {
      assert.equal((await call("/ai", "PATCH", { enabled: true })).status, 200);
      assert.equal((await call("/preview", "POST", { prompt: "etar dam koto?" })).status, 200);
      assert.equal((await ShoppingSession.findById(session._id)).history.length, 40);
      assert.equal((await call("/send", "POST")).status, 200);
      assert.equal((await call("/send", "POST")).status, 409);
    }
    assert.equal(sends, 2);
  } finally { globalThis.fetch = original; server.close(); server.closeAllConnections(); await mongoose.disconnect(); await db.stop(); }
});
