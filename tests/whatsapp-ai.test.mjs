import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import { AISettings, AIJob, Conversation, Message, Receipt } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { encryptGeminiKey, geminiKey, generateAIReply } from "../backend/src/modules/whatsapp/whatsapp.gemini.js";
import { queueIncomingAI, processAIJob } from "../backend/src/modules/whatsapp/whatsapp.ai.worker.js";
import { app } from "../backend/src/app.js";

test("Gemini settings, private keys, context, controls and durable automatic replies", { timeout: 120000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "ai-test-secret", WHATSAPP_AI_ENCRYPTION_KEY: randomBytes(32).toString("base64"), META_APP_SECRET: "meta-ai-test-secret", META_WHATSAPP_ACCESS_TOKEN: "meta-test", META_WHATSAPP_PHONE_NUMBER_ID: "123456789", META_GRAPH_API_VERSION: "v25.0" });
  delete process.env.GEMINI_API_KEY;
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0), originalFetch = globalThis.fetch;
  let generated = 0, sent = 0, captured, failGemini = false, uncertainSend = false;
  globalThis.fetch = async (url, options) => {
    const address = String(url instanceof Request ? url.url : url);
    if (address.includes("generativelanguage.googleapis.com")) {
      assert.equal(address.includes("key="), false);
      const headers = new Headers(options?.headers || (url instanceof Request ? url.headers : {}));
      assert.equal(headers.get("x-goog-api-key"), "qa-gemini-private-key");
      if (address.includes(":generateContent")) {
        generated++; captured = JSON.parse(options?.body || await url.clone().text());
        if (failGemini) return new Response(JSON.stringify({ error: { code: 503, message: "Unavailable" } }), { status: 503 });
        return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "Hello! How can I help?" }] }, finishReason: "STOP" }] }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ models: [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] }] }), { headers: { "Content-Type": "application/json" } });
    }
    if (address.startsWith("https://graph.facebook.com/")) {
      sent++; if (uncertainSend) throw Error("Network interrupted");
      return new Response(JSON.stringify({ messages: [{ id: `wamid.ai-${sent}` }] }));
    }
    return originalFetch(url, options);
  };
  try {
    await Promise.all([Store.init(), User.init(), Conversation.init(), Message.init(), Receipt.init(), AISettings.init(), AIJob.init()]);
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const admin = await User.create({ username: "ai-admin", email: "ai@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    const headers = { Authorization: `Bearer ${admin.generateAccessToken()}`, "Content-Type": "application/json" };
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp`;
    const call = async (path, method = "GET", body) => fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await fetch(base + "/ai/settings")).status, 401);
    const empty = (await (await call("/ai/settings")).json()).data;
    assert.equal(empty.enabled, false); assert.equal(empty.keyConfigured, false);
    const reads = await Promise.all(Array.from({ length: 25 }, () => call("/ai/settings")));
    reads.forEach(response => assert.equal(response.status, 200, "Live refreshes must not consume provider request limits"));
    const chat = await Conversation.create({ store: store._id, phone: "8801700000000", lastInboundAt: new Date() });
    assert.equal(chat.aiEnabled, false);
    const webhookBody = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "123456789" }, messages: [{ id: "wamid.original-off", from: chat.phone, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Originally received while AI was off" } }] } }] }] });
    const webhook = () => fetch(base + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(webhookBody).digest("hex") }, body: webhookBody });
    assert.equal((await webhook()).status, 200);
    assert.equal(await AIJob.countDocuments(), 0);
    const body = { enabled: false, instructions: "I run Origins of Beauty. Reply warmly in Bangla or Banglish. Do not invent product details.", tone: "Friendly", model: "gemini-3.8-flash" };
    assert.equal((await call("/ai/settings", "PUT", body)).status, 200);
    assert.equal((await call("/ai/enabled", "PATCH", { enabled: true })).status, 400);
    const saved = await call("/ai/settings", "PUT", { ...body, apiKey: "qa-gemini-private-key" });
    assert.equal(saved.status, 200);
    const safe = JSON.stringify(await saved.json());
    assert.equal(safe.includes("qa-gemini-private-key"), false); assert.equal(safe.includes("encryptedKey"), false);
    let settings = await AISettings.findOne({ store: store._id }).select("+encryptedKey");
    assert.notEqual(settings.encryptedKey, "qa-gemini-private-key"); assert.equal(geminiKey(settings), "qa-gemini-private-key");
    const preview = await call("/ai/preview", "POST", { prompt: "Hi there" });
    assert.equal(preview.status, 200); assert.equal(sent, 0);
    assert.match(captured.systemInstruction.parts.map(part => part.text).join(" "), /Reply warmly in Bangla/);
    assert.equal(captured.generationConfig.thinkingConfig.thinkingLevel, "LOW");
    assert.equal(captured.generationConfig.maxOutputTokens, 4096);
    assert.equal((await call("/ai/enabled", "PATCH", { enabled: true })).status, 200);
    assert.equal((await call(`/conversations/${chat._id}/ai`, "PATCH", { enabled: true })).status, 200);
    assert.equal((await webhook()).status, 200);
    assert.equal(await AIJob.countDocuments(), 0, "Retries must not retroactively enable AI for an old message");
    const inbound = async text => {
      const current = await Conversation.findById(chat._id); settings = await AISettings.findOne({ store: store._id }).select("+encryptedKey");
      const message = await Message.create({ store: store._id, conversation: chat._id, direction: "inbound", source: "customer", text, type: "text", timestamp: new Date(), status: "received", aiEligible: true, aiChatRevision: current.aiRevision, aiSettingsRevision: settings.revision });
      await queueIncomingAI(message); return message;
    };
    const claim = inboundId => AIJob.findOneAndUpdate({ inbound: inboundId, status: "queued" }, { $set: { status: "processing", owner: "qa-worker", leaseUntil: new Date(Date.now() + 90000) } }, { new: true });
    const first = await inbound("Can you help me?");
    await Promise.all([queueIncomingAI(first), queueIncomingAI(first)]);
    assert.equal(await AIJob.countDocuments({ inbound: first._id }), 1);
    const claims = await Promise.all([claim(first._id), claim(first._id)]);
    assert.equal(claims.filter(Boolean).length, 1);
    await processAIJob(claims.find(Boolean));
    assert.equal(sent, 1);
    assert.equal((await Message.findOne({ aiReplyTo: first._id })).source, "ai");
    assert.equal(captured.contents.at(-1).parts[0].text, "Can you help me?");
    const off = await inbound("Global off must override this chat");
    await call("/ai/enabled", "PATCH", { enabled: false });
    const before = generated; await processAIJob(await claim(off._id));
    assert.equal(generated, before); assert.equal(sent, 1);
    await call("/ai/enabled", "PATCH", { enabled: true });
    const chatOff = await inbound("Conversation off must stop generation");
    await call(`/conversations/${chat._id}/ai`, "PATCH", { enabled: false });
    await processAIJob(await claim(chatOff._id));
    assert.equal(generated, before); assert.equal(sent, 1);
    await call(`/conversations/${chat._id}/ai`, "PATCH", { enabled: true });
    const during = await inbound("Disable while generating");
    await processAIJob(await claim(during._id), { generate: async () => { await AISettings.updateOne({ store: store._id }, { $set: { enabled: false }, $inc: { revision: 1 } }); return "Must not be sent"; } });
    assert.equal(sent, 1); assert.equal((await AIJob.findOne({ inbound: during._id })).status, "skipped");
    // Global OFF must work even if the Gemini service is unavailable.
    failGemini = true;
    assert.equal((await call("/ai/enabled", "PATCH", { enabled: false })).status, 200);
    assert.equal((await call("/ai/enabled", "PATCH", { enabled: true })).status, 200);
    const failure = await inbound("Provider failure");
    await processAIJob(await claim(failure._id));
    assert.equal(sent, 1); assert.equal((await AIJob.findOne({ inbound: failure._id })).status, "failed");
    failGemini = false; uncertainSend = true;
    const uncertain = await inbound("Uncertain delivery");
    const job = await claim(uncertain._id); await processAIJob(job);
    assert.equal(sent, 2); assert.equal((await AIJob.findOne({ inbound: uncertain._id })).status, "unknown");
    await processAIJob(job); assert.equal(sent, 2);
    uncertainSend = false;
    const manual = await call(`/conversations/${chat._id}/messages`, "POST", { text: "A staff reply", requestId: "550e8400-e29b-41d4-a716-446655440000" });
    assert.equal(manual.status, 200); assert.equal((await Conversation.findById(chat._id)).aiEnabled, false);
    const cipher = encryptGeminiKey("qa-gemini-private-key");
    assert.equal(geminiKey({ encryptedKey: cipher }), "qa-gemini-private-key");
    assert.throws(() => geminiKey({ encryptedKey: cipher.slice(0, -4) + "AAAA" }));
    process.env.WHATSAPP_WEBHOOK_RELAY_URL = "https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net/api/v1/whatsapp/webhook";
    assert.equal((await call("/ai/enabled", "PATCH", { enabled: true })).status, 409);
    assert.equal((await call(`/conversations/${chat._id}/ai`, "PATCH", { enabled: false })).status, 409);
    assert.equal((await call(`/conversations/${chat._id}/messages`, "POST", { text: "Testing cannot cancel production jobs", requestId: "550e8400-e29b-41d4-a716-446655440001" })).status, 409);
  } finally {
    delete process.env.WHATSAPP_WEBHOOK_RELAY_URL;
    globalThis.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db.stop();
  }
});
