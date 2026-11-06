import { deleteChatRouter } from "./whatsapp.delete.routes.js";
import { adminMediaRouter } from "./whatsapp.admin-media.routes.js";
import express from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import { requireRoles, requireTenant } from "../../middlewares/tenant.middleware.js";
import Store from "../store/store.model.js";
import { Conversation, Message, Receipt, AISettings, AIJob } from "./whatsapp.model.js";
import { validSignature, windowOpen } from "./whatsapp.security.js";
import { createChatTicket } from "./whatsapp.live.js";
import ApiError from "../../utils/ApiError.js";
import { aiRouter } from "./whatsapp.ai.routes.js";
import { queueIncomingAI } from "./whatsapp.ai.worker.js";
import { applyReceipt, sendWhatsAppText } from "./whatsapp.send.js";

import { queueStagingEvent } from "./whatsapp.shopping.worker.js";
import { downloadWhatsAppImage } from "./whatsapp.media.js";
import { shoppingEnabled, AvailabilityVerification, StagingAISettings, ShoppingSession, ShoppingJob, testRecipientAllowed } from "./whatsapp.shopping.models.js";
import { shoppingRouter } from "./whatsapp.shopping.routes.js";

export const webhookRouter = express.Router();
webhookRouter.get("/", (req, res) => {
  if (process.env.WHATSAPP_VERIFY_TOKEN && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN && typeof req.query["hub.challenge"] === "string")
    return res.type("text/plain").send(req.query["hub.challenge"]);
  res.sendStatus(403);
});
webhookRouter.post("/", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  if (!validSignature(req.body, req.get("x-hub-signature-256"), process.env.META_APP_SECRET)) return res.sendStatus(401);
  const relay = process.env.WHATSAPP_WEBHOOK_RELAY_URL;
  if (relay) {
    // The existing public testing URL can remain Meta's callback. Only production
    // processes events; its database mirror supplies the testing inbox.
    const destination = "https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net/api/v1/whatsapp/webhook";
    if (relay !== destination || process.env.WEBSITE_SITE_NAME === "originsofbeauty") return res.sendStatus(503);
    try {
      const forwarded = await fetch(destination, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": req.get("x-hub-signature-256") }, body: req.body, signal: AbortSignal.timeout(20000) });
      if (forwarded.ok) await queueStagingEvent(req.body);
      return res.sendStatus(forwarded.ok ? 200 : 503);
    } catch { return res.sendStatus(503); }
  }
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); } catch { return res.sendStatus(400); }
  if (event.object !== "whatsapp_business_account") return res.sendStatus(400);
  const store = await Store.findOne({ slug: process.env.STORE_SLUG || "originsofbeauty" });
  if (!store) return res.sendStatus(503);
  for (const entry of event.entry || []) for (const change of entry.changes || []) {
    const value = change.value;
    if (change.field !== "messages" || value?.metadata?.phone_number_id !== process.env.META_WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const item of value.messages || []) {
      if (!item.id || !/^\d{6,20}$/.test(item.from)) continue;
      const timestamp = new Date(Number(item.timestamp) * 1000);
      if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime() > Date.now() + 60000) continue;
      const text = item.type === "text" ? String(item.text?.body || "") : item[item.type]?.caption || `[${item.type || "unsupported"} message]`;
      let chat;
      try {
        chat = await Conversation.findOneAndUpdate({ store: store._id, phone: item.from }, { $setOnInsert: { name: value.contacts?.find(c => c.wa_id === item.from)?.profile?.name || item.from } }, { upsert: true, new: true });
      } catch (err) { if (err.code !== 11000) throw err; chat = await Conversation.findOne({ store: store._id, phone: item.from }); }
      const aiSettings = item.type === "text" && chat.aiEnabled ? await AISettings.findOne({ store: store._id }) : null;
      await Message.updateOne({ metaId: item.id }, { $setOnInsert: { store: store._id, conversation: chat._id, direction: "inbound", source: "customer", text, mediaId: ["image", "video"].includes(item.type) ? item[item.type]?.id : undefined, replyToMetaId: item.context?.id, type: item.type, status: "received", timestamp, aiEligible: Boolean(aiSettings?.enabled && chat.aiEnabled), aiSettingsRevision: aiSettings?.revision, aiChatRevision: chat.aiRevision } }, { upsert: true }).catch(err => { if (err.code !== 11000) throw err; });
      // Safe to repeat after a partial webhook failure; older retries cannot rewind the window or preview.
      await Conversation.updateOne({ _id: chat._id }, { $max: { lastInboundAt: timestamp } });
      await Conversation.updateOne({ _id: chat._id, $or: [{ lastMessageAt: { $lte: timestamp } }, { lastMessageAt: null }] }, { $set: { lastMessageAt: timestamp, preview: text.slice(0, 160) } });
      await queueIncomingAI(await Message.findOne({ metaId: item.id }));
    }
    for (const status of value.statuses || []) {
      if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
      const timestamp = new Date(Number(status.timestamp) * 1000);
      if (!Number.isFinite(timestamp.getTime())) continue;
      if (!status.id) continue;
      const receipt = { store: store._id, metaId: status.id, status: status.status, statusAt: timestamp, error: status.errors?.map(e => `${e.code}: ${e.title || "Message failed"}`).join("; ") || "" };
      // Preserve the highest successful state even when Meta delivers events out of order.
      await Receipt.updateOne({ metaId: status.id }, { $setOnInsert: receipt }, { upsert: true }).catch(err => { if (err.code !== 11000) throw err; });
      const ranks = { sent: 1, delivered: 2, read: 3 };
      const earlier = status.status === "failed" ? ["sent"] : Object.keys(ranks).filter(k => ranks[k] < ranks[status.status]);
      await Receipt.updateOne({ metaId: status.id, status: { $in: earlier } }, { $set: receipt });
      await applyReceipt(await Receipt.findOne({ metaId: status.id }));
    }
  }
  res.sendStatus(200);
});

export const whatsappRouter = express.Router();
whatsappRouter.use(verifyJwt, requireRoles("ADMIN", "ECO"), requireTenant);
whatsappRouter.use(adminMediaRouter);
whatsappRouter.use(deleteChatRouter);
whatsappRouter.use("/ai", aiRouter);
whatsappRouter.use("/shopping", shoppingRouter);
whatsappRouter.get("/messages/:id/image", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid image message");
  const message = await Message.findOne({ _id: req.params.id, store: req.store._id, type: "image" });
  const stagingImage = message && shoppingEnabled() ? await ShoppingJob.findOne({ store: req.store._id, metaId: message.metaId }) : null;
  const mediaId = message?.mediaId || stagingImage?.mediaId;
  if (!mediaId) throw new ApiError(404, "Image is unavailable or expired");
  const image = await downloadWhatsAppImage(mediaId);
  res.set("Cache-Control", "private, no-store").type(image.inlineData.mimeType).send(Buffer.from(image.inlineData.data, "base64"));
});
whatsappRouter.post("/live-ticket", rateLimit({ windowMs: 60000, limit: 30, keyGenerator: req => String(req.user._id) }), (req, res) => {
  res.json({ data: { ticket: createChatTicket(req.user, req.store) } });
});
whatsappRouter.get("/conversations", async (req, res) => {
  let conversations = await Conversation.find({ store: req.store._id }).sort({ lastMessageAt: -1 }).limit(200).lean();
  const settings = await AISettings.findOne({ store: req.store._id });
  let displayedSettings = settings;
  if (shoppingEnabled()) {
    displayedSettings = await StagingAISettings.findOne({ store: req.store._id });
    const sessions = await ShoppingSession.find({ store: req.store._id, owner: req.user._id }).sort({ createdAt: -1 }).lean();
    conversations = conversations.map(chat => testRecipientAllowed(chat.phone) ? { ...chat, stagingTest: true, productionAIEnabled: Boolean(settings?.enabled && chat.aiEnabled), aiEnabled: Boolean(sessions.find(session => session.phone === chat.phone)?.aiEnabled) } : chat);
  }
  const pendingVerifications = shoppingEnabled() ? await AvailabilityVerification.countDocuments({ store: req.store._id, status: "pending" }) : 0;
  res.json({ data: { pendingVerifications, shoppingAvailable: shoppingEnabled(), productionAIEnabled: settings?.enabled || false, conversations, aiEnabled: displayedSettings?.enabled || false, autoRepliesAvailable: !process.env.WHATSAPP_WEBHOOK_RELAY_URL, configured: Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID && /^v\d+\.0$/.test(process.env.META_GRAPH_API_VERSION || "")), serverTime: new Date() } });
});
async function getChat(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid conversation");
  const chat = await Conversation.findOne({ _id: req.params.id, store: req.store._id });
  if (!chat) throw new ApiError(404, "Conversation not found");
  return chat;
}
whatsappRouter.patch("/conversations/:id/ai", async (req, res) => {
  const chat = await getChat(req);
  if (shoppingEnabled() && testRecipientAllowed(chat.phone)) {
    if (typeof req.body.enabled !== "boolean") throw new ApiError(400, "Choose AI on or off");
    if (req.body.enabled) {
      const existing = await ShoppingSession.findOne({ store: req.store._id, phone: chat.phone, owner: req.user._id }).sort({ createdAt: -1 });
      if (existing) await ShoppingSession.updateOne({ _id: existing._id }, { $set: { aiEnabled: true }, $inc: { revision: 1 } });
      else await ShoppingSession.create({ store: req.store._id, phone: chat.phone, owner: req.user._id, conversation: chat._id });
    } else await ShoppingSession.updateMany({ store: req.store._id, phone: chat.phone }, { $set: { aiEnabled: false }, $inc: { revision: 1 } });
    return res.json({ data: { aiEnabled: req.body.enabled } });
  }
  if (process.env.WHATSAPP_WEBHOOK_RELAY_URL) throw new ApiError(409, "Conversation AI controls are managed in the production inbox");
  if (typeof req.body.enabled !== "boolean") throw new ApiError(400, "Choose AI on or off");
  const updated = await Conversation.findOneAndUpdate({ _id: chat._id, store: req.store._id }, { $set: { aiEnabled: req.body.enabled }, $inc: { aiRevision: 1 } }, { new: true });
  res.json({ data: { aiEnabled: updated.aiEnabled } });
});
whatsappRouter.get("/conversations/:id/messages", async (req, res) => {
  const chat = await getChat(req);
  const before = req.query.before;
  if (before && !mongoose.isValidObjectId(before)) throw new ApiError(400, "Invalid cursor");
  await Message.updateMany({ store: req.store._id, conversation: chat._id, source: "admin", type: { $in: ["image", "video"] }, status: { $in: ["uploading", "sending"] }, createdAt: { $lt: new Date(Date.now() - 120000) } }, { $set: { status: "unknown", error: "Attachment delivery could not be confirmed after an interruption. Verify before sending again." } });
  const messages = await Message.find({ store: req.store._id, conversation: chat._id, ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(100).lean();
  const job = shoppingEnabled() && testRecipientAllowed(chat.phone) ? await ShoppingJob.findOne({ store: req.store._id, phone: chat.phone }).sort({ createdAt: -1 }).select("status error updatedAt").lean() : await AIJob.findOne({ store: req.store._id, conversation: chat._id }).sort({ createdAt: -1 }).select("status error updatedAt").lean();
  if (shoppingEnabled()) for (const message of messages.filter(item => item.type === "image" && !item.mediaId)) { const imageJob = await ShoppingJob.findOne({ store: req.store._id, metaId: message.metaId }).select("mediaId").lean(); if (imageJob?.mediaId) message.mediaId = imageJob.mediaId; }
  res.json({ data: { messages: messages.reverse(), aiJob: job, canReply: windowOpen(chat.lastInboundAt), windowExpiresAt: chat.lastInboundAt ? new Date(+chat.lastInboundAt + 86400000) : null, hasMore: messages.length === 100 } });
});
whatsappRouter.post("/conversations/:id/messages", rateLimit({ windowMs: 60000, limit: 30, keyGenerator: req => String(req.user._id) }), async (req, res) => {
  const chat = await getChat(req);
  const { text, requestId } = req.body;
  if (typeof text !== "string" || !text.trim() || text.length > 4096 || !/^[a-f0-9-]{36}$/i.test(requestId || "")) throw new ApiError(400, "Text (1–4096 characters) and a unique request ID are required");
  const previous = await Message.findOne({ store: req.store._id, requestId });
  if (previous) {
    if (String(previous.conversation) !== String(chat._id) || previous.type !== "text" || previous.text !== text.trim()) throw new ApiError(409, "Request ID already used for another message");
    return res.json({ data: previous });
  }
  if (!windowOpen(chat.lastInboundAt)) throw new ApiError(409, "The 24-hour reply window is closed. Ask the customer to message you again.");
  if (process.env.WHATSAPP_WEBHOOK_RELAY_URL && (!shoppingEnabled() || !testRecipientAllowed(chat.phone) || chat.aiEnabled) && await AISettings.exists({ store: req.store._id, enabled: true })) throw new ApiError(409, "Take over this chat before replying manually so pending automatic replies are cancelled.");
  if (shoppingEnabled()) await ShoppingSession.updateMany({ store: req.store._id, phone: chat.phone }, { $set: { aiEnabled: false }, $inc: { revision: 1 } });
  await Conversation.updateOne({ _id: chat._id }, { $set: { aiEnabled: false }, $inc: { aiRevision: 1 } });
  const message = await sendWhatsAppText({ chat, text, requestId, source: "admin" });
  res.json({ data: message });
});
