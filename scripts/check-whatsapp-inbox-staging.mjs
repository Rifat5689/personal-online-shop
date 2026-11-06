// Existing Azure test settings JSON on stdin. Sends only to the owner's allowlist.
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import Product from "../backend/src/modules/product/product.model.js";
import { Conversation } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { ShoppingSession, StagingAISettings } from "../backend/src/modules/whatsapp/whatsapp.shopping.models.js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
let raw = ""; for await (const chunk of process.stdin) raw += chunk;
const env = Object.fromEntries(JSON.parse(raw).map(item => [item.name, item.value]));
if (env.DATABASE_ROLE !== "test" || env.DB_MIRROR_ENABLED === "true") throw Error("Staging isolation required");
Object.assign(process.env, env);
let chat, call, wasEnabled = false;
const report = [];
try {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const store = await Store.findOne({ slug: env.STORE_SLUG || "originsofbeauty" });
  const admin = await User.findOne({ tenantId: store._id, username: "origins", role: "ADMIN", isActive: { $ne: false } });
  if (!admin) throw Error("Staging owner not found");
  const headers = { Authorization: `Bearer ${admin.generateAccessToken()}`, "X-Store-Slug": store.slug };
  const api = "https://test-originsofbeauty.azurewebsites.net/api/v1";
  call = async (path, method = "GET", body) => {
    const response = await fetch(api + path, { method, headers: { ...headers, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(70000) });
    const payload = await response.json();
    if (!response.ok) throw Error(`Staging endpoint ${path} returned ${response.status}`);
    return payload.data;
  };
  const health = await call("/health");
  if (process.env.EXPECTED_RELEASE && health.release !== process.env.EXPECTED_RELEASE) throw Error("Staging release does not match");
  const settings = await call("/whatsapp/ai/settings");
  if (settings.primaryProvider !== "groq" || settings.fallbackProvider !== "gemini" || !settings.groqKeyConfigured || /encryptedGroqKey|encryptedKey|gsk_[A-Za-z0-9]{20,}/.test(JSON.stringify(settings))) throw Error("Provider settings verification failed");
  report.push({ check: "staging-release-and-private-provider-settings", passed: true });
  const connection = await call("/whatsapp/ai/connection", "POST", { provider: "groq" });
  if (connection.state !== "connected") throw Error("Groq connection failed");
  report.push({ check: "live-groq-connection-and-limits", passed: true, limits: connection.limits });
  const recipient = process.env.TEST_RECIPIENT || (env.WHATSAPP_TEST_RECIPIENTS || "").split(",").map(value => value.trim()).filter(Boolean)[0];
  if (!(env.WHATSAPP_TEST_RECIPIENTS || "").split(",").includes(recipient)) throw Error("Owner number is not allowlisted");
  chat = await Conversation.findOne({ store: store._id, phone: recipient });
  if (!chat?.lastInboundAt || Date.now() - +chat.lastInboundAt >= 86400000) throw Error("Owner must message the business to open the reply window");
  const localSession = await ShoppingSession.findOne({ store: store._id, phone: recipient, owner: admin._id }).sort({ createdAt: -1 });
  wasEnabled = Boolean(localSession?.aiEnabled);
  const scope = await call(`/whatsapp/conversations/${chat._id}/delete-scope`);
  report.push({ check: "shared-deletion-scope-read-only", passed: true, scope: scope.scope, productionAuthenticationRequired: scope.requiresProductionAuthentication });
  if (process.argv.includes("--send-media")) {
    await call(`/whatsapp/conversations/${chat._id}/ai`, "PATCH", { enabled: false });
    const product = await Product.findOne({ tenantId: store._id, isActive: true, deletedAt: null, "images.0.url": /^https:/ }).lean();
    const image = await fetch(product.images[0].url, { signal: AbortSignal.timeout(15000) });
    if (!image.ok) throw Error("Catalog photo unavailable");
    const imageBytes = Buffer.from(await image.arrayBuffer()), mime = image.headers.get("content-type")?.split(";")[0];
    for (const item of [{ type: "image", bytes: imageBytes, mime, name: "product.jpg" }, { type: "video", bytes: readFileSync("artifacts/whatsapp-test.mp4"), mime: "video/mp4", name: "staging-test.mp4" }]) {
      const form = new FormData(); form.append("file", new Blob([item.bytes], { type: item.mime }), item.name); form.append("caption", `Origins of Beauty — staging ${item.type} test`); form.append("requestId", randomUUID());
      const result = await call(`/whatsapp/conversations/${chat._id}/media`, "POST", form);
      if (!["sent", "delivered", "read"].includes(result.status)) throw Error(`Meta did not confirm ${item.type} submission`);
      const preview = await fetch(`${api}/whatsapp/messages/${result._id}/media`, { headers, signal: AbortSignal.timeout(30000) });
      if (!preview.ok || preview.headers.get("cache-control") !== "private, no-store") throw Error("Private media preview failed");
      report.push({ check: `personal-recipient-manual-${item.type}`, passed: true, metaStatus: result.status, privatePreview: true });
    }
  }
  mkdirSync("artifacts", { recursive: true }); writeFileSync("artifacts/whatsapp-inbox-staging-verification.json", JSON.stringify(report, null, 2));
  for (const item of report) console.log(JSON.stringify(item));
} catch (error) { console.error(JSON.stringify({ failed: true, reason: /^Staging |^Owner |^Catalog |^Meta |^Private |^Groq |^Provider /.test(error.message) ? error.message : "Staging inbox verification failed; sensitive details withheld." })); process.exitCode = 1; }
finally {
  if (chat && call && process.argv.includes("--send-media") && wasEnabled) await call(`/whatsapp/conversations/${chat._id}/ai`, "PATCH", { enabled: true }).catch(() => {});
  await mongoose.disconnect();
}
