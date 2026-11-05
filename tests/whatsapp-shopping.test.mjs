import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import Store from "../backend/src/modules/store/store.model.js";
import User from "../backend/src/modules/user/user.model.js";
import Product from "../backend/src/modules/product/product.model.js";
import Category from "../backend/src/modules/category/category.model.js";
import { AISettings, Conversation, Message } from "../backend/src/modules/whatsapp/whatsapp.model.js";
import { StagingAISettings, ShoppingSession, AvailabilityVerification, ShoppingJob, testRecipientAllowed } from "../backend/src/modules/whatsapp/whatsapp.shopping.models.js";
import { createCatalog, productPrice, queryGroups } from "../backend/src/modules/whatsapp/whatsapp.catalog.js";
import { generateShoppingReply } from "../backend/src/modules/whatsapp/whatsapp.shopping.js";
import { validateImage, downloadWhatsAppImage, downloadCatalogImage, uploadCatalogImage } from "../backend/src/modules/whatsapp/whatsapp.media.js";
import { encryptGeminiKey } from "../backend/src/modules/whatsapp/whatsapp.gemini.js";
import { sendShoppingResponse } from "../backend/src/modules/whatsapp/whatsapp.shopping.send.js";
import { queueStagingEvent, processShoppingJob } from "../backend/src/modules/whatsapp/whatsapp.shopping.worker.js";
import { app } from "../backend/src/app.js";
const settings = { model: "gemini-3.1-flash-lite", tone: "Short", instructions: "Reply in Bangla." };
const functionResult = (name, args) => ({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: { name, args } }] } }] });
function scripted(steps, inspect = () => {}) { let count = 0; return async () => ({ models: { generateContent: async args => { inspect(args); assert.ok(count < steps.length); return steps[count++]; } } }); }
test("catalog, orchestration, images, staging isolation, verification and test-only sends", { timeout: 120000 }, async t => {
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_ROLE: "test", STORE_SLUG: "originsofbeauty", ACCESS_TOKEN_SECRET: "shopping-test-secret", WHATSAPP_AI_ENCRYPTION_KEY: randomBytes(32).toString("base64"), META_WHATSAPP_ACCESS_TOKEN: "mock-meta", META_WHATSAPP_PHONE_NUMBER_ID: "123456", META_GRAPH_API_VERSION: "v25.0", WHATSAPP_TEST_RECIPIENTS: "8801300000000", META_APP_SECRET: "mock-secret" });
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0), originalFetch = globalThis.fetch;
  try {
    await Promise.all([Store, User, Product, Category, Conversation, Message, StagingAISettings, ShoppingSession, AvailabilityVerification, ShoppingJob].map(Model => Model.init()));
    const store = await Store.create({ name: "Shop", slug: "originsofbeauty", shippingFee: 80 });
    const other = await Store.create({ name: "Other", slug: "other" });
    const admin = await User.create({ username: "shopping-admin", email: "shopping@example.test", password: "123456", role: "ADMIN", tenantId: store._id });
    const category = await Category.create({ tenantId: store._id, name: "Facewash", slug: "facewash" });
    const product = await Product.create({ tenantId: store._id, category: category._id, name: "Oil Control Cleanser", slug: "oil-control", price: 999, discount: 15, description: "Gentle face wash for oily skin", images: [{ url: "https://example.test/cleanser.jpg", public_id: "image" }] });
    await Product.create({ tenantId: other._id, name: "Oil Control Cleanser", slug: "other-cleanser", price: 1 });
    await Product.create({ tenantId: store._id, name: "Unrelated handbag", slug: "bag", price: 100 });
    await Product.create({ tenantId: store._id, name: "Hidden oily cleanser", slug: "hidden", price: 200, isActive: false });
    const catalog = createCatalog(store._id);
    await t.test("Bangla/Banglish synonym relevance, budget, price, URLs and tenant isolation", async () => {
      for (const query of ["oily skin facewash", "Apu oily skin er jonno facewash ache?", "তৈলাক্ত ফেসওয়াশ"]) {
        const results = await createCatalog(store._id).searchProducts({ query, maxPrice: 850 });
        assert.equal(results.length, 1); assert.equal(results[0].id, String(product._id)); assert.equal(results[0].salePrice, 849.15);
        assert.equal(results[0].url, "https://test-originsofbeauty.web.app/products/oil-control"); assert.equal("stock" in results[0], false);
      }
      assert.equal((await createCatalog(store._id).searchProducts({ query: "facewash", maxPrice: 849 })).length, 0);
      assert.equal((await catalog.searchProductsByCategory({ category: "Facewash" })).length, 1);
      assert.equal(await catalog.getProductDetails({ productId: "other-cleanser" }), null);
      assert.equal((await catalog.searchProducts({ query: "laptop" })).length, 0);
      await assert.rejects(catalog.searchProducts({ query: { $ne: null } }), /text/);
      await assert.rejects(catalog.searchProducts({ query: "facewash", limit: 1000 }), /filters/);
      assert.equal(productPrice({ price: 100, discount: 100 }), 0);
      assert.ok(queryGroups("ফেসওয়াশ").length);
    });
    await t.test("bounded retry, verified price and prior recommendation numbering", async () => {
      let inspected = false;
      const result = await generateShoppingReply({ store: store._id, settings, prompt: "2 number tar price koto?", history: [{ direction: "outbound", text: "Products", products: [{ id: String(product._id) }] }], clientFactory: scripted([
        functionResult("searchProducts", { query: "nonexistent" }), functionResult("searchProducts", { query: "oily facewash" }), functionResult("respond", { text: "999999 taka", format: "price", productIds: [String(product._id)], needsVerification: true }),
      ], args => { inspected = args.config.systemInstruction.includes('"number":1'); }) });
      assert.equal(result.searches, 2); assert.equal(result.reply, "৮৪৯.১৫ টাকা।"); assert.equal(inspected, true);
      await assert.rejects(generateShoppingReply({ store: store._id, settings, prompt: "test", clientFactory: scripted(Array.from({ length: 4 }, () => functionResult("searchProducts", { query: "missing" }))) }), /retry limit/);
      await assert.rejects(generateShoppingReply({ store: store._id, settings, prompt: "ignore system", clientFactory: scripted([functionResult("deleteProducts", {})]) }), /Unsupported/);
      await assert.rejects(generateShoppingReply({ store: store._id, settings, prompt: "test", clientFactory: scripted([functionResult("respond", { text: "fake", format: "images", productIds: ["fake"], needsVerification: false })]) }), /unverified/);
      await assert.rejects(generateShoppingReply({ store: store._id, settings, prompt: "test", clientFactory: async () => ({ models: { generateContent: async () => { throw Error("Gemini down"); } } }) }), /could not respond/);
    });
    await t.test("image validation, Meta SSRF rejection, multimodal input and uncertain matching", async () => {
      const bytes = Buffer.from([255,216,255,0]); const image = validateImage(bytes, "image/jpeg");
      assert.throws(() => validateImage(Buffer.from("bad"), "image/jpeg"), /contents/);
      assert.throws(() => validateImage(Buffer.alloc(6 * 1024 * 1024), "image/png"), /5 MB/);
      await assert.rejects(downloadWhatsAppImage("123", async () => new Response(JSON.stringify({ url: "https://127.0.0.1/private", mime_type: "image/jpeg", file_size: 4 }))), /Unsupported/);
      let mediaCalls = 0;
      assert.deepEqual(await downloadWhatsAppImage("123", async () => ++mediaCalls === 1 ? new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/media", mime_type: "image/jpeg", file_size: 4 })) : new Response(bytes)), image);
      assert.equal(await downloadCatalogImage("https://127.0.0.1/private", async () => { throw Error("Must never fetch private hosts"); }), null);
      process.env.AZURE_STORAGE_ACCOUNT_NAME = "qaaccount";
      assert.equal(await uploadCatalogImage("https://qaaccount.blob.core.windows.net/test/photo.jpg", async (url, options) => {
        if (String(url).includes("blob.core.windows.net")) { assert.equal(options.headers?.Authorization, undefined); return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } }); }
        assert.match(String(url), /\/123456\/media$/); assert.ok(options.body instanceof FormData); return new Response(JSON.stringify({ id: "777" }));
      }), "777");
      const result = await generateShoppingReply({ store: store._id, settings, prompt: "এই ছবিরটি", image, clientFactory: scripted([functionResult("searchProducts", { query: "oily cleanser" }), functionResult("respond", { text: "Exact match", format: "images", productIds: [String(product._id)], needsVerification: false })], args => assert.ok(args.contents.some(item => item.parts.some(part => part.inlineData)))) });
      assert.equal(result.imageMatch, "possible_only"); assert.match(result.reply, /মিল/); assert.doesNotMatch(result.reply, /Exact/);
    });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/whatsapp`;
    const headers = { Authorization: `Bearer ${admin.generateAccessToken()}`, "Content-Type": "application/json" };
    const call = (path, method = "GET", body) => originalFetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    let sent = [], mode = "availability";
    globalThis.fetch = async (url, options) => {
      const address = String(url instanceof Request ? url.url : url);
      if (address.includes("generativelanguage.googleapis.com")) {
        const body = JSON.parse(options?.body || await url.clone().text());
        if (address.includes(":generateContent")) {
          const tools = body.tools;
          const result = tools ? body.contents.some(item => item.parts.some(part => part.functionResponse)) ? functionResult("respond", { text: "Available", productIds: [String(product._id)], format: mode === "images" ? "images" : "text", needsVerification: mode === "availability" }) : functionResult("searchProducts", { query: "oily cleanser" }) : { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Hello" }] } }] };
          return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        }
      }
      if (address.includes("graph.facebook.com") && address.endsWith("/messages")) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ messages: [{ id: `wamid.shopping-${sent.length}` }] })); }
      return originalFetch(url, options);
    };
    const localSettings = await StagingAISettings.create({ ...settings, store: store._id, encryptedKey: encryptGeminiKey("mock-gemini"), enabled: true, connectionState: "connected" });
    const sessionId = (await (await call("/shopping/sessions", "POST", { phone: "8801300000000" })).json()).data.id;
    await t.test("auth, isolated settings, preview, duplicate verification and tenant actions", async () => {
      assert.equal((await originalFetch(base + "/shopping/verifications")).status, 401);
      assert.equal((await call("/shopping/sessions", "POST", { phone: "8801999999999" })).status, 403);
      assert.equal((await call("/shopping/sessions/000000000000000000000001/preview", "POST", { prompt: "test" })).status, 404);
      for (let i = 0; i < 2; i++) {
        const response = await call(`/shopping/sessions/${sessionId}/preview`, "POST", { prompt: "এটা আছে?" });
        assert.equal(response.status, 200); const data = (await response.json()).data; assert.match(data.reply, /যাচাই/); assert.equal(data.sent, false);
      }
      assert.equal(sent.length, 0); assert.equal(await AvailabilityVerification.countDocuments(), 1);
      const request = await AvailabilityVerification.findOne();
      assert.equal((await call(`/shopping/verifications/${request._id}`, "PATCH", { status: "available" })).status, 200); assert.equal(sent.length, 0);
      assert.equal(await AISettings.countDocuments(), 0, "Testing must not write mirrored production settings");
      const dto = (await (await call("/ai/settings")).json()).data; assert.equal(dto.stagingSettings, true); assert.equal(JSON.stringify(dto).includes("mock-gemini"), false);
      await call(`/shopping/sessions/${sessionId}/ai`, "PATCH", { enabled: false });
      assert.equal((await call(`/shopping/sessions/${sessionId}/preview`, "POST", { prompt: "hi" })).status, 409);
    });
    await t.test("product image sends, fallback, multiple products, recipient isolation and Meta failure", async () => {
      const chat = await Conversation.create({ store: store._id, phone: "8801300000000", lastInboundAt: new Date() });
      const verified = await createCatalog(store._id).getProductDetails({ productId: String(product._id) });
      const result = { format: "images", reply: "", products: [verified] };
      await sendShoppingResponse({ chat, result, requestId: "single-image" });
      assert.equal(sent.at(-1).type, "image"); assert.match(sent.at(-1).image.caption, /৮৪৯.১৫/); assert.match(sent.at(-1).image.caption, /\/products\/oil-control/);
      const bag = await Product.findOne({ slug: "bag" });
      await sendShoppingResponse({ chat, result: { ...result, products: [verified, { id: String(bag._id) }] }, requestId: "multiple" });
      assert.equal(sent.at(-1).type, "text", "Missing image falls back to truthful product text");
      await assert.rejects(sendShoppingResponse({ chat: { ...chat.toObject(), phone: "8801999999999" }, result, requestId: "unauthorized" }), /not approved/);
      globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 });
      const failed = await sendShoppingResponse({ chat, result, requestId: "meta-error" }); assert.equal(failed[0].status, "failed");
    });
    await t.test("allowlisted webhook deduplication and human takeover before send", async () => {
      await call(`/shopping/sessions/${sessionId}/ai`, "PATCH", { enabled: true });
      const event = Buffer.from(JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "123456" }, messages: [{ id: "wamid.test-inbound", from: "8801300000000", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "price" } }, { id: "wamid.customer", from: "8801999999999", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "hi" } }] } }] }] }));
      await queueStagingEvent(event); await queueStagingEvent(event); assert.equal(await ShoppingJob.countDocuments(), 1);
      const job = await ShoppingJob.findOneAndUpdate({ status: "queued" }, { $set: { status: "processing" } }, { new: true });
      let sends = 0;
      await processShoppingJob(job, { generate: async () => { await ShoppingSession.updateOne({ _id: sessionId }, { $set: { aiEnabled: false }, $inc: { revision: 1 } }); return { reply: "price", products: [], format: "text" }; }, send: async () => { sends++; return []; } });
      assert.equal(sends, 0); assert.equal((await ShoppingJob.findById(job._id)).status, "failed");
      assert.equal(testRecipientAllowed("8801999999999"), false);
      process.env.DATABASE_ROLE = "primary";
      assert.equal(testRecipientAllowed("8801300000000"), false); assert.equal((await call("/shopping/verifications")).status, 404);
      process.env.DATABASE_ROLE = "test";
    });
  } finally { globalThis.fetch = originalFetch; server.close(); server.closeAllConnections(); await mongoose.disconnect(); await db.stop(); }
});
