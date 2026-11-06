import mongoose from "mongoose";
const { Schema } = mongoose;
const conversation = new Schema({
  store: { type: Schema.Types.ObjectId, required: true },
  phone: { type: String, required: true }, name: String,
  lastInboundAt: Date, lastMessageAt: Date, preview: String,
  aiEnabled: { type: Boolean, default: false }, aiRevision: { type: Number, default: 0 },
  aiLeaseUntil: Date, aiLeaseOwner: String,
}, { timestamps: true });
conversation.index({ store: 1, phone: 1 }, { unique: true });
const message = new Schema({
  store: { type: Schema.Types.ObjectId, required: true },
  conversation: { type: Schema.Types.ObjectId, required: true, index: true },
  metaId: String, requestId: String,
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  mediaId: String, mediaHash: String, mediaMime: String, replyToMetaId: String, productIds: [Schema.Types.ObjectId], imageUrl: String,
  text: String, type: { type: String, default: "text" },
  status: String, statusAt: Date, error: String, timestamp: { type: Date, required: true },
  source: { type: String, enum: ["customer", "admin", "ai"], default: "admin" },
  aiReplyTo: Schema.Types.ObjectId,
  aiEligible: { type: Boolean, default: false }, aiSettingsRevision: Number, aiChatRevision: Number,
}, { timestamps: true });
message.index({ metaId: 1 }, { unique: true, partialFilterExpression: { metaId: { $type: "string" } } });
message.index({ store: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
message.index({ conversation: 1, timestamp: -1 });
message.index({ aiReplyTo: 1 }, { unique: true, partialFilterExpression: { aiReplyTo: { $type: "objectId" } } });
export const Conversation = mongoose.model("WhatsAppConversation", conversation);
export const Message = mongoose.model("WhatsAppMessage", message);
// Keep early delivery receipts: Meta may call back before the send request completes.
const receipt = new Schema({ metaId: { type: String, required: true, unique: true }, store: Schema.Types.ObjectId, status: String, statusAt: Date, error: String });
export const Receipt = mongoose.model("WhatsAppReceipt", receipt);
const aiSettings = new Schema({
  store: { type: Schema.Types.ObjectId, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  instructions: { type: String, default: "", maxlength: 12000 },
  model: { type: String, default: "gemini-3.1-flash-lite" },
  tone: { type: String, enum: ["Friendly", "Professional", "Short"], default: "Friendly" },
  encryptedKey: { type: String, select: false },
  encryptedGroqKey: { type: String, select: false },
  primaryProvider: { type: String, enum: ["gemini", "groq"], default: "gemini" },
  fallbackProvider: { type: String, enum: ["none", "gemini", "groq"], default: "none" },
  groqModel: { type: String, default: "openai/gpt-oss-20b" },
  groqVisionModel: { type: String, default: "qwen/qwen3.8-27b" },
  providerConnections: { type: Schema.Types.Mixed, default: {} },
  connectionState: { type: String, default: "unconfigured" },
  connectedAt: Date, revision: { type: Number, default: 0 },
}, { timestamps: true });
export const AISettings = mongoose.model("WhatsAppAISettings", aiSettings);
const aiJob = new Schema({
  store: { type: Schema.Types.ObjectId, required: true }, conversation: { type: Schema.Types.ObjectId, required: true },
  inbound: { type: Schema.Types.ObjectId, required: true, unique: true },
  status: { type: String, enum: ["queued", "processing", "sending", "sent", "skipped", "failed", "unknown"], default: "queued" },
  settingsRevision: Number, chatRevision: Number,
  leaseUntil: Date, owner: String, notBefore: { type: Date, default: Date.now }, error: String,
}, { timestamps: true });
aiJob.index({ status: 1, notBefore: 1, leaseUntil: 1 });
export const AIJob = mongoose.model("WhatsAppAIJob", aiJob);
