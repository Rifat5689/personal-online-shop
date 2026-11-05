import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import ApiError from "../../utils/ApiError.js";
import { Conversation } from "./whatsapp.model.js";
import { shoppingEnabled, settingsModel, ShoppingSession, AvailabilityVerification, testRecipientAllowed } from "./whatsapp.shopping.models.js";
import { generateShoppingReply } from "./whatsapp.shopping.js";
import { validateImage } from "./whatsapp.media.js";
import { sendShoppingResponse } from "./whatsapp.shopping.send.js";
export const shoppingRouter = express.Router();
shoppingRouter.use((req, res, next) => { if (!shoppingEnabled()) throw new ApiError(404, "Staging shopping assistant is unavailable"); next(); });
shoppingRouter.use(rateLimit({ windowMs: 60000, limit: 15, keyGenerator: req => String(req.user._id), skip: req => req.method === "GET" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });
async function sessionFor(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid test session");
  const session = await ShoppingSession.findOne({ _id: req.params.id, store: req.store._id, owner: req.user._id });
  if (!session) throw new ApiError(404, "Test session not found");
  return session;
}
shoppingRouter.post("/sessions", async (req, res) => {
  const { conversationId, phone } = req.body || {};
  let chat;
  if (conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) throw new ApiError(400, "Invalid conversation");
    chat = await Conversation.findOne({ _id: conversationId, store: req.store._id });
    if (!chat) throw new ApiError(404, "Conversation not found");
  }
  if (phone && !testRecipientAllowed(phone)) throw new ApiError(403, "Recipient is not approved for staging tests");
  const session = await ShoppingSession.create({ store: req.store._id, owner: req.user._id, conversation: chat?._id, phone: phone || undefined });
  res.json({ data: { id: session._id, mode: "preview", testSendingAvailable: Boolean(phone) } });
});
shoppingRouter.patch("/sessions/:id/ai", async (req, res) => {
  const session = await sessionFor(req);
  if (typeof req.body.enabled !== "boolean") throw new ApiError(400, "Choose AI on or off");
  await ShoppingSession.updateMany(req.body.enabled || !session.phone ? { _id: session._id } : { store: session.store, phone: session.phone }, { $set: { aiEnabled: req.body.enabled }, $inc: { revision: 1 } });
  res.json({ data: { aiEnabled: req.body.enabled } });
});
shoppingRouter.post("/sessions/:id/preview", upload.single("image"), async (req, res) => {
  const session = await sessionFor(req);
  const prompt = req.body?.prompt || (req.file ? "ছবির প্রোডাক্টটি খুঁজে দিন।" : "");
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) throw new ApiError(400, "Enter a customer message under 2000 characters");
  if (!session.aiEnabled) throw new ApiError(409, "Human takeover is active for this test session");
  const settings = await settingsModel().findOne({ store: req.store._id }).select("+encryptedKey");
  if (!settings?.instructions?.trim()) throw new ApiError(400, "Save AI settings first");
  const claimed = await ShoppingSession.findOneAndUpdate({ _id: session._id, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now() + 70000) } });
  if (!claimed) throw new ApiError(409, "A response is already being generated");
  try {
    const image = req.file ? validateImage(req.file.buffer, req.file.mimetype) : undefined;
    const result = await generateShoppingReply({ store: req.store._id, settings, history: session.history, prompt, image });
    const fresh = await ShoppingSession.findById(session._id);
    if (!fresh.aiEnabled || fresh.revision !== session.revision) throw new ApiError(409, "AI was stopped during generation");
    const history = [...session.history, { direction: "inbound", text: prompt, type: image ? "image" : "text" }, { direction: "outbound", text: result.reply, products: result.products.map(p => ({ id: p.id })), format: result.format }].slice(-12);
    await ShoppingSession.updateOne({ _id: session._id, revision: session.revision }, { $set: { history } });
    if (result.needsVerification) for (const product of result.products.length ? result.products : [{ id: null, name: "Customer request" }]) {
      await AvailabilityVerification.updateOne({ store: req.store._id, session: session._id, product: product.id, status: "pending" }, { $setOnInsert: { conversation: session.conversation, customer: session.phone || "Admin test session", productName: product.name } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
    }
    res.json({ data: { ...result, sessionId: session._id, sent: false } });
  } finally { await ShoppingSession.updateOne({ _id: session._id }, { $unset: { leaseUntil: 1 } }); }
});
shoppingRouter.post("/sessions/:id/send", async (req, res) => {
  const session = await sessionFor(req);
  if (!testRecipientAllowed(session.phone)) throw new ApiError(403, "Only the approved personal test recipient can receive messages");
  const chat = await Conversation.findOne({ store: req.store._id, phone: session.phone });
  if (!chat) throw new ApiError(409, "The test recipient must message the business first");
  const last = session.history.at(-1);
  if (!last || last.direction !== "outbound") throw new ApiError(400, "Generate a test preview first");
  // Atomic revision claim makes repeated send clicks idempotent.
  const claimed = await ShoppingSession.findOneAndUpdate({ _id: session._id, revision: session.revision, lastSentLength: { $ne: session.history.length } }, { $inc: { revision: 1 }, $set: { aiEnabled: false, lastSentLength: session.history.length } });
  if (!claimed) throw new ApiError(409, "Test response already claimed");
  const result = await sendShoppingResponse({ chat, result: { reply: last.text, products: last.products || [], format: last.format }, requestId: `shopping-${session._id}-${session.history.length}`, stagingOnly: true });
  res.json({ data: { messages: result } });
});
shoppingRouter.get("/verifications", async (req, res) => {
  res.json({ data: await AvailabilityVerification.find({ store: req.store._id, status: { $ne: "resolved" } }).sort({ createdAt: -1 }).limit(100).lean() });
});
shoppingRouter.patch("/verifications/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !["available", "unavailable", "resolved"].includes(req.body?.status)) throw new ApiError(400, "Invalid verification action");
  const request = await AvailabilityVerification.findOneAndUpdate({ _id: req.params.id, store: req.store._id }, { $set: { status: req.body.status, resolvedBy: req.user._id } }, { new: true });
  if (!request) throw new ApiError(404, "Verification not found");
  // Recording a human decision never confirms an order or sends a message.
  res.json({ data: request });
});
