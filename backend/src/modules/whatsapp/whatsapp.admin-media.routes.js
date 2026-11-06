import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import ApiError from "../../utils/ApiError.js";
import { Conversation, Message, AISettings } from "./whatsapp.model.js";
import { ShoppingSession, StagingAISettings, shoppingEnabled, testRecipientAllowed } from "./whatsapp.shopping.models.js";
import { validateAdminMedia, uploadWhatsAppMedia, downloadWhatsAppVideo, downloadWhatsAppImage } from "./whatsapp.media.js";
import { sendWhatsAppText } from "./whatsapp.send.js";
import { windowOpen } from "./whatsapp.security.js";
export const adminMediaRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024, files: 1, fields: 3 } }).single("file");
const multipart = (req, res, next) => upload(req, res, error => next(error ? new ApiError(400, "Attach one photo up to 5 MB or MP4 video up to 16 MB") : undefined));
async function aiActive(chat) {
  const Settings = shoppingEnabled() ? StagingAISettings : AISettings;
  const global = await Settings.exists({ store: chat.store, enabled: true });
  return Boolean(global && (shoppingEnabled() ? await ShoppingSession.exists({ store: chat.store, phone: chat.phone, aiEnabled: true }) : chat.aiEnabled));
}
adminMediaRouter.get("/messages/:id/media", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid media message");
  const message = await Message.findOne({ _id: req.params.id, store: req.store._id, type: { $in: ["image", "video"] } });
  if (!message?.mediaId) throw new ApiError(404, "Media unavailable or expired");
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (message.type === "video") return res.type("video/mp4").send(await downloadWhatsAppVideo(message.mediaId));
  const image = await downloadWhatsAppImage(message.mediaId);
  res.type(image.inlineData.mimeType).send(Buffer.from(image.inlineData.data, "base64"));
});
adminMediaRouter.post("/conversations/:id/media", rateLimit({ windowMs: 60000, limit: 15, keyGenerator: req => String(req.user._id) }), multipart, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid conversation");
  const chat = await Conversation.findOne({ _id: req.params.id, store: req.store._id });
  if (!chat) throw new ApiError(404, "Conversation not found");
  const text = req.body?.caption || "", requestId = req.body?.requestId;
  if (!req.file || typeof text !== "string" || text.length > 1024 || !/^[a-f0-9-]{36}$/i.test(requestId || "")) throw new ApiError(400, "Choose a file, an optional caption up to 1024 characters, and a unique request ID");
  const type = validateAdminMedia(req.file.buffer, req.file.mimetype), mediaHash = createHash("sha256").update(req.file.buffer).digest("hex");
  const sameRequest = previous => {
    if (String(previous.conversation) !== String(chat._id) || previous.mediaHash !== mediaHash || previous.text !== text.trim()) throw new ApiError(409, "Request ID already used for another message");
    return res.json({ data: previous });
  };
  const previous = await Message.findOne({ store: req.store._id, requestId });
  if (previous) return sameRequest(previous);
  if (!windowOpen(chat.lastInboundAt)) throw new ApiError(409, "The 24-hour reply window is closed. Ask the customer to message you again.");
  if (shoppingEnabled() && !testRecipientAllowed(chat.phone)) throw new ApiError(403, "Staging media can only be sent to the approved test recipient");
  if (process.env.WHATSAPP_WEBHOOK_RELAY_URL && chat.aiEnabled && await AISettings.exists({ store: req.store._id, enabled: true })) throw new ApiError(409, "Use the production inbox for production AI takeover");
  if (await aiActive(chat)) throw new ApiError(409, "Turn off AI for this conversation before sending attachments");
  let message;
  try { message = await Message.create({ store: chat.store, conversation: chat._id, direction: "outbound", source: "admin", text: text.trim(), type, mediaHash, mediaMime: req.file.mimetype, requestId, status: "uploading", timestamp: new Date() }); }
  catch (error) { if (error.code === 11000) return sameRequest(await Message.findOne({ store: req.store._id, requestId })); throw error; }
  try {
    await Conversation.updateOne({ _id: chat._id }, { $set: { aiEnabled: false }, $inc: { aiRevision: 1 } });
    if (shoppingEnabled()) await ShoppingSession.updateMany({ store: chat.store, phone: chat.phone }, { $set: { aiEnabled: false }, $inc: { revision: 1 } });
    const mediaId = await uploadWhatsAppMedia(req.file.buffer, req.file.mimetype);
    const fresh = await Conversation.findById(chat._id);
    if (await aiActive(fresh)) throw new ApiError(409, "AI was enabled during upload. Attachment was not sent.");
    return res.json({ data: await sendWhatsAppText({ chat: fresh, text, requestId, source: "admin", imageMediaId: mediaId, mediaType: type, messageRecord: message }) });
  } catch (error) {
    if (message.status === "uploading") await Message.updateOne({ _id: message._id }, { $set: { status: "failed", error: "Attachment was not sent. Check AI controls, file format and connection." } });
    throw error;
  }
});
