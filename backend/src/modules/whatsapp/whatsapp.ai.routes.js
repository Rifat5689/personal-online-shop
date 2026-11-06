import express from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import ApiError from "../../utils/ApiError.js";
import { AISettings, Conversation, Message } from "./whatsapp.model.js";
import { availableModels, encryptGeminiKey, geminiKey, generateAIReply } from "./whatsapp.gemini.js";
import { generateShoppingReply } from "./whatsapp.shopping.js";
import { settingsModel, shoppingEnabled } from "./whatsapp.shopping.models.js";
import { providerKey, providerModels, providerModel, testProviderConnection, generateProviderReplyResult, generateProviderReply, encryptProviderKey, supportsVision, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from "./whatsapp.providers.js";
export const aiRouter = express.Router();
const Settings = { findOne: (...args) => settingsModel().findOne(...args), findOneAndUpdate: (...args) => settingsModel().findOneAndUpdate(...args) };
const dto = settings => ({ enabled: settings?.enabled || false, instructions: settings?.instructions || "", model: settings?.model || "gemini-3.1-flash-lite", tone: settings?.tone || "Friendly", primaryProvider: settings?.primaryProvider || "gemini", fallbackProvider: settings?.fallbackProvider || "none", groqModel: settings?.groqModel || GROQ_TEXT_MODEL, groqVisionModel: settings?.groqVisionModel || GROQ_VISION_MODEL, providerConnections: settings?.providerConnections || {}, geminiKeyConfigured: Boolean(settings?.encryptedKey || process.env.GEMINI_API_KEY), groqKeyConfigured: Boolean(settings?.encryptedGroqKey || process.env.GROQ_API_KEY), keyConfigured: (settings?.primaryProvider || "gemini") === "groq" ? Boolean(settings?.encryptedGroqKey || process.env.GROQ_API_KEY) : Boolean(settings?.encryptedKey || process.env.GEMINI_API_KEY), connectionState: settings?.connectionState || "unconfigured", connectedAt: settings?.connectedAt || null, testRecipients: shoppingEnabled() ? (process.env.WHATSAPP_TEST_RECIPIENTS || "").split(",").filter(Boolean) : [], shoppingAvailable: shoppingEnabled(), stagingSettings: shoppingEnabled(), autoRepliesAvailable: !process.env.WHATSAPP_WEBHOOK_RELAY_URL });
aiRouter.use(rateLimit({ windowMs: 60000, limit: 20, keyGenerator: req => String(req.user._id), skip: req => req.method === "GET" || (req.method === "PATCH" && req.path === "/enabled" && req.body?.enabled === false) }));
aiRouter.get("/settings", async (req, res) => {
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  res.json({ data: dto(settings) });
});
aiRouter.patch("/enabled", async (req, res) => {
  if (typeof req.body?.enabled !== "boolean") throw new ApiError(400, "Choose AI on or off");
  if (req.body.enabled && process.env.WHATSAPP_WEBHOOK_RELAY_URL && !shoppingEnabled()) throw new ApiError(409, "This testing inbox mirrors production. Enable live automatic replies in the production inbox after the AI release is published there.");
  const current = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  if (req.body.enabled && (!current?.instructions?.trim() || !providerKey(current) || current.connectionState !== "connected")) throw new ApiError(400, "Save your instructions and connect the primary provider before enabling AI");
  const settings = await Settings.findOneAndUpdate({ store: req.store._id }, { $set: { enabled: req.body.enabled }, $inc: { revision: 1 } }, { upsert: true, new: true }).select("+encryptedKey +encryptedGroqKey");
  res.json({ data: dto(settings) });
});
aiRouter.put("/settings", async (req, res) => {
  const { enabled, instructions, model, tone, apiKey, removeKey, groqApiKey, removeGroqKey, primaryProvider = "gemini", fallbackProvider = "none", groqModel = GROQ_TEXT_MODEL, groqVisionModel = GROQ_VISION_MODEL } = req.body || {};
  if (enabled && process.env.WHATSAPP_WEBHOOK_RELAY_URL && !shoppingEnabled()) throw new ApiError(409, "Enable live automatic replies in the production inbox. You can save settings and preview responses here.");
  if (typeof enabled !== "boolean" || typeof instructions !== "string" || instructions.length > 12000 || !["Friendly", "Professional", "Short"].includes(tone) || typeof model !== "string" || !/^gemini-[a-z0-9.-]+$/i.test(model) || model.length > 100 || (apiKey !== undefined && (typeof apiKey !== "string" || apiKey.length > 512))) throw new ApiError(400, "Invalid AI settings");
  if (!["gemini", "groq"].includes(primaryProvider) || !["none", "gemini", "groq"].includes(fallbackProvider) || primaryProvider === fallbackProvider || ![groqModel, groqVisionModel].every(value => typeof value === "string" && /^[a-z0-9/_.-]{1,120}$/i.test(value)) || (groqApiKey !== undefined && (typeof groqApiKey !== "string" || groqApiKey.length > 512))) throw new ApiError(400, "Invalid provider settings");
  let settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  if (!settings) settings = new (settingsModel())({ store: req.store._id });
  if (removeKey === true) settings.encryptedKey = undefined;
  if (apiKey?.trim()) settings.encryptedKey = encryptGeminiKey(apiKey.trim());
  if (removeGroqKey === true) settings.encryptedGroqKey = undefined;
  if (groqApiKey?.trim()) settings.encryptedGroqKey = encryptProviderKey(groqApiKey.trim());
  if (primaryProvider === "groq" || fallbackProvider === "groq") {
    if (!providerKey(settings, "groq")) throw new ApiError(400, "Add a Groq API key first");
    const connection = await providerModels(settings, "groq");
    if (![groqModel, groqVisionModel].every(id => connection.models.includes(id)) || !supportsVision("groq", groqVisionModel)) throw new ApiError(400, "Select available Groq text and vision models");
    if (groqApiKey?.trim() || settings.groqModel !== groqModel || settings.providerConnections?.groq?.state !== "connected") await generateProviderReply({ ...settings.toObject(), primaryProvider: "groq", fallbackProvider: "none", groqModel, instructions, tone }, [], "Reply briefly in Bangla.");
    settings.providerConnections = { ...settings.providerConnections, groq: { state: "connected", checkedAt: new Date(), limits: connection.limits, limitsNote: connection.limitsNote } };
  }
  if (fallbackProvider === "gemini" && !providerKey(settings, "gemini")) throw new ApiError(400, "Configure the Gemini fallback key first");
  const key = geminiKey(settings);
  let models = [];
  if (primaryProvider === "gemini" && key && (apiKey?.trim() || model !== settings.model || settings.connectionState !== "connected")) {
    models = await availableModels(key);
    if (!models.includes(model)) throw new ApiError(400, "Select a currently available Gemini Flash model", models.map(id => ({ model: id })));
    await generateAIReply({ ...settings.toObject(), model, tone, instructions }, [], "Reply with a brief greeting.");
    settings.connectionState = "connected"; settings.connectedAt = new Date();
  } else if (!key) { settings.connectionState = "unconfigured"; settings.connectedAt = undefined; }
  if (primaryProvider === "groq") { settings.connectionState = "connected"; settings.connectedAt = new Date(); }
  if (enabled && (!providerKey(settings, primaryProvider) || !instructions.trim())) throw new ApiError(400, "Add a working primary provider API key and your instructions before enabling AI");
  Object.assign(settings, { enabled, instructions, model, tone, primaryProvider, fallbackProvider, groqModel, groqVisionModel }); settings.revision += 1;
  await settings.save();
  res.json({ data: { ...dto(settings), models } });
});
aiRouter.post("/models", async (req, res) => {
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  if (req.body?.apiKey !== undefined && (typeof req.body.apiKey !== "string" || req.body.apiKey.length > 512)) throw new ApiError(400, "Invalid API key field");
  const provider = req.body?.provider || "gemini";
  if (!["gemini", "groq"].includes(provider)) throw new ApiError(400, "Unsupported provider");
  res.json({ data: await providerModels(settings, provider, req.body?.apiKey?.trim()) });
});
aiRouter.post("/connection", async (req, res) => {
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  const provider = req.body?.provider || settings?.primaryProvider || "gemini";
  if (!["gemini", "groq"].includes(provider)) throw new ApiError(400, "Unsupported provider");
  let connection;
  try { connection = await testProviderConnection(settings, provider); }
  catch (error) {
    if (settings) {
      settings.set(`providerConnections.${provider}`, { state: "error", checkedAt: new Date() }); settings.markModified("providerConnections");
      if (provider === settings.primaryProvider) settings.connectionState = "error";
      await settings.save();
    }
    throw error;
  }
  const state = { state: "connected", checkedAt: new Date(), limits: connection.limits, limitsNote: connection.limitsNote };
  if (settings) { settings.set(`providerConnections.${provider}`, state); settings.markModified("providerConnections"); if (provider === settings.primaryProvider) { settings.connectionState = "connected"; settings.connectedAt = new Date(); } await settings.save(); }
  res.json({ data: { provider, ...state, ...connection } });
});
aiRouter.post("/preview", rateLimit({ windowMs: 60000, limit: 5, keyGenerator: req => String(req.user._id) }), async (req, res) => {
  if (typeof req.body?.prompt !== "string" || !req.body.prompt.trim() || req.body.prompt.length > 2000) throw new ApiError(400, "Enter a test message of 1–2000 characters");
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey +encryptedGroqKey");
  if (!settings?.instructions?.trim()) throw new ApiError(400, "Save your personality and instructions first");
  let history = [];
  if (req.body.conversationId) {
    if (!mongoose.isValidObjectId(req.body.conversationId)) throw new ApiError(400, "Invalid conversation");
    const chat = await Conversation.findOne({ _id: req.body.conversationId, store: req.store._id });
    if (!chat) throw new ApiError(404, "Conversation not found");
    history = (await Message.find({ store: req.store._id, conversation: chat._id, type: "text", status: { $nin: ["failed", "unknown", "sending"] } }).sort({ _id: -1 }).limit(40).lean()).reverse();
  }
  const result = shoppingEnabled() ? await generateShoppingReply({ store: req.store._id, settings, history, prompt: req.body.prompt }) : await generateProviderReplyResult(settings, history, req.body.prompt);
  res.json({ data: { reply: result.reply, model: result.modelUsed ?? result.model ?? null, provider: result.providerUsed || result.provider, usage: result.usage } });
});
