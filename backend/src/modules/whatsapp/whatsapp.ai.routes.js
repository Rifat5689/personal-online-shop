import express from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import ApiError from "../../utils/ApiError.js";
import { AISettings, Conversation, Message } from "./whatsapp.model.js";
import { availableModels, encryptGeminiKey, geminiKey, generateAIReply } from "./whatsapp.gemini.js";
import { generateShoppingReply } from "./whatsapp.shopping.js";
import { settingsModel, shoppingEnabled } from "./whatsapp.shopping.models.js";
export const aiRouter = express.Router();
const Settings = { findOne: (...args) => settingsModel().findOne(...args), findOneAndUpdate: (...args) => settingsModel().findOneAndUpdate(...args) };
const dto = settings => ({ enabled: settings?.enabled || false, instructions: settings?.instructions || "", model: settings?.model || "gemini-3.1-flash-lite", tone: settings?.tone || "Friendly", keyConfigured: Boolean(settings?.encryptedKey || process.env.GEMINI_API_KEY), connectionState: settings?.connectionState || "unconfigured", connectedAt: settings?.connectedAt || null, testRecipients: shoppingEnabled() ? (process.env.WHATSAPP_TEST_RECIPIENTS || "").split(",").filter(Boolean) : [], shoppingAvailable: shoppingEnabled(), stagingSettings: shoppingEnabled(), autoRepliesAvailable: !process.env.WHATSAPP_WEBHOOK_RELAY_URL });
aiRouter.use(rateLimit({ windowMs: 60000, limit: 20, keyGenerator: req => String(req.user._id), skip: req => req.method === "GET" || (req.method === "PATCH" && req.path === "/enabled" && req.body?.enabled === false) }));
aiRouter.get("/settings", async (req, res) => {
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey");
  res.json({ data: dto(settings) });
});
aiRouter.patch("/enabled", async (req, res) => {
  if (typeof req.body?.enabled !== "boolean") throw new ApiError(400, "Choose AI on or off");
  if (req.body.enabled && process.env.WHATSAPP_WEBHOOK_RELAY_URL && !shoppingEnabled()) throw new ApiError(409, "This testing inbox mirrors production. Enable live automatic replies in the production inbox after the AI release is published there.");
  const current = await Settings.findOne({ store: req.store._id }).select("+encryptedKey");
  if (req.body.enabled && (!current?.instructions?.trim() || !geminiKey(current) || current.connectionState !== "connected")) throw new ApiError(400, "Save your instructions and connect Gemini before enabling AI");
  const settings = await Settings.findOneAndUpdate({ store: req.store._id }, { $set: { enabled: req.body.enabled }, $inc: { revision: 1 } }, { upsert: true, new: true }).select("+encryptedKey");
  res.json({ data: dto(settings) });
});
aiRouter.put("/settings", async (req, res) => {
  const { enabled, instructions, model, tone, apiKey, removeKey } = req.body || {};
  if (enabled && process.env.WHATSAPP_WEBHOOK_RELAY_URL && !shoppingEnabled()) throw new ApiError(409, "Enable live automatic replies in the production inbox. You can save settings and preview responses here.");
  if (typeof enabled !== "boolean" || typeof instructions !== "string" || instructions.length > 12000 || !["Friendly", "Professional", "Short"].includes(tone) || typeof model !== "string" || !/^gemini-[a-z0-9.-]+$/i.test(model) || model.length > 100 || (apiKey !== undefined && (typeof apiKey !== "string" || apiKey.length > 512))) throw new ApiError(400, "Invalid AI settings");
  let settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey");
  if (!settings) settings = new (settingsModel())({ store: req.store._id });
  if (removeKey === true) settings.encryptedKey = undefined;
  if (apiKey?.trim()) settings.encryptedKey = encryptGeminiKey(apiKey.trim());
  const key = geminiKey(settings);
  let models = [];
  if (key && (apiKey?.trim() || model !== settings.model || settings.connectionState !== "connected")) {
    models = await availableModels(key);
    if (!models.includes(model)) throw new ApiError(400, "Select a currently available Gemini Flash model", models.map(id => ({ model: id })));
    await generateAIReply({ ...settings.toObject(), model, tone, instructions }, [], "Reply with a brief greeting.");
    settings.connectionState = "connected"; settings.connectedAt = new Date();
  } else if (!key) { settings.connectionState = "unconfigured"; settings.connectedAt = undefined; }
  if (enabled && (!key || !instructions.trim())) throw new ApiError(400, "Add a working Gemini API key and your instructions before enabling AI");
  Object.assign(settings, { enabled, instructions, model, tone }); settings.revision += 1;
  await settings.save();
  res.json({ data: { ...dto(settings), models } });
});
aiRouter.post("/models", async (req, res) => {
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey");
  if (req.body?.apiKey !== undefined && (typeof req.body.apiKey !== "string" || req.body.apiKey.length > 512)) throw new ApiError(400, "Invalid API key field");
  const key = req.body?.apiKey?.trim() || geminiKey(settings);
  res.json({ data: { models: await availableModels(key) } });
});
aiRouter.post("/preview", rateLimit({ windowMs: 60000, limit: 5, keyGenerator: req => String(req.user._id) }), async (req, res) => {
  if (typeof req.body?.prompt !== "string" || !req.body.prompt.trim() || req.body.prompt.length > 2000) throw new ApiError(400, "Enter a test message of 1–2000 characters");
  const settings = await Settings.findOne({ store: req.store._id }).select("+encryptedKey");
  if (!settings?.instructions?.trim()) throw new ApiError(400, "Save your personality and instructions first");
  let history = [];
  if (req.body.conversationId) {
    if (!mongoose.isValidObjectId(req.body.conversationId)) throw new ApiError(400, "Invalid conversation");
    const chat = await Conversation.findOne({ _id: req.body.conversationId, store: req.store._id });
    if (!chat) throw new ApiError(404, "Conversation not found");
    history = (await Message.find({ store: req.store._id, conversation: chat._id, type: "text", status: { $nin: ["failed", "unknown", "sending"] } }).sort({ _id: -1 }).limit(12).lean()).reverse();
  }
  const reply = shoppingEnabled() ? (await generateShoppingReply({ store: req.store._id, settings, history, prompt: req.body.prompt })).reply : await generateAIReply(settings, history, req.body.prompt);
  res.json({ data: { reply, model: settings.model } });
});
