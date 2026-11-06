import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import { StagingAISettings } from "../backend/src/modules/whatsapp/whatsapp.shopping.models.js";
import { app } from "../backend/src/app.js";
test("Groq settings encrypt secrets and connection exposes only safe model and limit metadata", { timeout: 60000 }, async () => {
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_ROLE: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "qa-providers", WHATSAPP_AI_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0), original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.groq.com/")) {
      assert.equal(options.headers.Authorization, "Bearer private-groq-test-key");
      return new Response(JSON.stringify(String(url).endsWith("/models") ? { data: [{ id: "openai/gpt-oss-20b", active: true }, { id: "qwen/qwen3.8-27b", active: true }, { id: "whisper-large-v3" }] } : { choices: [{ finish_reason: "stop", message: { content: "হ্যালো" } }] }), { headers: { "x-ratelimit-limit-tokens": "8000" } });
    }
    return original(url, options);
  };
  try {
    const store = await Store.create({ name: "QA", slug: "originsofbeauty" });
    const admin = await User.create({ username: "provider-admin", email: "provider@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp/ai`;
    const call = (path, method = "GET", body) => original(base + path, { method, headers: { Authorization: `Bearer ${admin.generateAccessToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const body = { enabled: false, instructions: "Reply in Bangla", tone: "Friendly", model: "gemini-3.1-flash-lite", primaryProvider: "groq", fallbackProvider: "none", groqModel: "openai/gpt-oss-20b", groqVisionModel: "qwen/qwen3.8-27b", groqApiKey: "private-groq-test-key" };
    const response = await call("/settings", "PUT", body);
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(await response.json()).includes("private-groq-test-key"), false);
    const raw = await StagingAISettings.findOne({ store: store._id }).select("+encryptedGroqKey");
    assert.ok(raw.encryptedGroqKey); assert.notEqual(raw.encryptedGroqKey, body.groqApiKey);
    assert.equal((await StagingAISettings.findOne({ store: store._id })).encryptedGroqKey, undefined);
    const settings = await (await call("/settings")).json();
    assert.equal(settings.data.groqKeyConfigured, true); assert.equal(settings.data.encryptedGroqKey, undefined);
    const connection = await (await call("/connection", "POST", { provider: "groq" })).json();
    assert.equal(connection.data.state, "connected"); assert.equal(connection.data.limits["x-ratelimit-limit-tokens"], "8000");
    assert.equal(connection.data.models.includes("whisper-large-v3"), false);
    assert.equal((await call("/settings", "PUT", { ...body, groqVisionModel: "openai/gpt-oss-20b" })).status, 400);
    assert.equal((await call("/settings", "PUT", { ...body, fallbackProvider: "groq" })).status, 400);
    assert.equal((await call("/enabled", "PATCH", { enabled: true })).status, 200);
    assert.equal((await call("/enabled", "PATCH", { enabled: false })).status, 200);
  } finally { globalThis.fetch = original; server.close(); server.closeAllConnections(); await mongoose.disconnect(); await db.stop(); }
});
