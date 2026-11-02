import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import { Conversation, Message, Receipt } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { app } from "../backend/src/app.js";

test("WhatsApp API: auth, signed webhook, durable deduplication, send, receipts and window", { timeout: 120000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "qa-secret", META_APP_SECRET: "qa-meta-secret", WHATSAPP_VERIFY_TOKEN: "qa-verify", META_WHATSAPP_PHONE_NUMBER_ID: "123456789", META_WHATSAPP_ACCESS_TOKEN: "qa-token", META_GRAPH_API_VERSION: "v25.0" });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0);
  const originalFetch = globalThis.fetch;
  let sent = 0;
  let relayed = 0, relayFails = false;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net/api/v1/whatsapp/webhook") {
      relayed++;
      const expected = "sha256=" + createHmac("sha256", "qa-meta-secret").update(options.body).digest("hex");
      assert.equal(options.headers["x-hub-signature-256"], expected);
      assert.equal(JSON.parse(options.body).object, "whatsapp_business_account");
      return new Response("", { status: relayFails ? 503 : 200 });
    }
    if (String(url).startsWith("https://graph.facebook.com/")) {
      sent++;
      assert.equal(options.headers.Authorization, "Bearer qa-token");
      assert.equal(JSON.parse(options.body).text.body, "Hello customer");
      return new Response(JSON.stringify({ messages: [{ id: "wamid.outgoing" }] }), { status: 200 });
    }
    return originalFetch(url, options);
  };
  try {
    await Promise.all([Store.init(), User.init(), Conversation.init(), Message.init(), Receipt.init()]);
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const admin = await User.create({ username: "qaadmin", email: "qa@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    const headers = { Authorization: `Bearer ${admin.generateAccessToken()}`, "Content-Type": "application/json" };
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp`;
    assert.equal((await fetch(base + "/conversations")).status, 401);
    assert.equal((await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123")).status, 403);
    assert.equal(await (await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=qa-verify&hub.challenge=123")).text(), "123");
    const event = (value) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "123456789" }, ...value } }] }] });
    const post = (value, valid = true) => {
      const body = JSON.stringify(event(value));
      return fetch(base + "/webhook", { method: "POST", body, headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=" + createHmac("sha256", valid ? "qa-meta-secret" : "bad").update(body).digest("hex") } });
    };
    const incoming = { messages: [{ id: "wamid.incoming", from: "8801700000000", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Hi" } }], contacts: [{ wa_id: "8801700000000", profile: { name: "Customer" } }] };
    assert.equal((await post(incoming, false)).status, 401);
    assert.equal(await Message.countDocuments(), 0);
    const duplicateResponses = await Promise.all([post(incoming), post(incoming), post(incoming)]);
    duplicateResponses.forEach(r => assert.equal(r.status, 200));
    assert.equal(await Message.countDocuments(), 1);
    assert.equal(await Conversation.countDocuments(), 1);
    const chat = await Conversation.findOne();
    const path = base + `/conversations/${chat._id}/messages`;
    assert.equal((await (await fetch(path, { headers })).json()).data.canReply, true);
    // Receipt before Graph response is persisted and applied after send.
    assert.equal((await post({ statuses: [{ id: "wamid.outgoing", status: "read", timestamp: String(Math.floor(Date.now() / 1000)) }] })).status, 200);
    const payload = { text: "Hello customer", requestId: randomUUID() };
    const send = () => fetch(path, { method: "POST", headers, body: JSON.stringify(payload) });
    const response = await send();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "read");
    assert.equal((await send()).status, 200);
    assert.equal(sent, 1);
    await post({ statuses: [{ id: "wamid.outgoing", status: "sent", timestamp: String(Math.floor(Date.now() / 1000) - 60) }] });
    assert.equal((await Message.findOne({ metaId: "wamid.outgoing" })).status, "read");
    await Conversation.updateOne({ _id: chat._id }, { $set: { lastInboundAt: new Date(Date.now() - 86400001) } });
    assert.equal((await fetch(path, { method: "POST", headers, body: JSON.stringify({ ...payload, requestId: randomUUID() }) })).status, 409);
    assert.equal(sent, 1);
    const foreign = await Store.create({ name: "Other", slug: "other" });
    const foreignChat = await Conversation.create({ store: foreign._id, phone: "8801800000000" });
    assert.equal((await fetch(base + `/conversations/${foreignChat._id}/messages`, { headers })).status, 404);
    const list = JSON.stringify(await (await fetch(base + "/conversations", { headers })).json());
    assert.equal(list.includes("qa-token"), false);
    assert.equal(list.includes("qa-meta-secret"), false);
    const user = await User.create({ username: "customer", email: "customer@example.test", password: "test", role: "user" });
    assert.equal((await fetch(base + "/conversations", { headers: { Authorization: `Bearer ${user.generateAccessToken()}` } })).status, 401);
    const count = await Message.countDocuments();
    process.env.WHATSAPP_WEBHOOK_RELAY_URL = "https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net/api/v1/whatsapp/webhook";
    assert.equal((await post(incoming, false)).status, 401);
    assert.equal(relayed, 0);
    assert.equal((await post(incoming)).status, 200);
    assert.equal(relayed, 1);
    assert.equal(await Message.countDocuments(), count);
    relayFails = true;
    assert.equal((await post(incoming)).status, 503);
    process.env.WHATSAPP_WEBHOOK_RELAY_URL = "https://example.invalid/";
    assert.equal((await post(incoming)).status, 503);
    assert.equal(relayed, 2);
  } finally {
    delete process.env.WHATSAPP_WEBHOOK_RELAY_URL;
    globalThis.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await db.stop();
  }
});
