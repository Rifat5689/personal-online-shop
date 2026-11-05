import mongoose from "mongoose";
import { AISettings } from "./whatsapp.model.js";
const { Schema } = mongoose;
export const shoppingEnabled = () => process.env.DATABASE_ROLE === "test" && process.env.WEBSITE_SITE_NAME !== "originsofbeauty";
// Separate collections survive the existing one-way production mirror.
export const StagingAISettings = mongoose.model("WhatsAppStagingAISettings", AISettings.schema.clone());
export const settingsModel = () => shoppingEnabled() ? StagingAISettings : AISettings;
const session = new Schema({
  store: { type: Schema.Types.ObjectId, required: true, index: true },
  owner: { type: Schema.Types.ObjectId, required: true },
  conversation: Schema.Types.ObjectId,
  phone: String, aiEnabled: { type: Boolean, default: true },
  revision: { type: Number, default: 0 }, leaseUntil: Date, lastSentLength: Number,
  history: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });
export const ShoppingSession = mongoose.model("WhatsAppShoppingSession", session);
const verification = new Schema({
  store: { type: Schema.Types.ObjectId, required: true, index: true },
  session: { type: Schema.Types.ObjectId, required: true },
  conversation: Schema.Types.ObjectId, customer: String,
  product: Schema.Types.ObjectId, productName: String,
  status: { type: String, enum: ["pending", "available", "unavailable", "resolved"], default: "pending" },
  resolvedBy: Schema.Types.ObjectId,
}, { timestamps: true });
verification.index({ store: 1, session: 1, product: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
export const AvailabilityVerification = mongoose.model("WhatsAppAvailabilityVerification", verification);
const job = new Schema({ store: Schema.Types.ObjectId, metaId: { type: String, unique: true, required: true }, phone: String, text: String, mediaId: String, replyToMetaId: String, timestamp: Date, status: { type: String, default: "queued" }, error: String }, { timestamps: true });
export const ShoppingJob = mongoose.model("WhatsAppShoppingJob", job);
export function testRecipientAllowed(phone) {
  return shoppingEnabled() && /^\d{8,15}$/.test(phone || "") && (process.env.WHATSAPP_TEST_RECIPIENTS || "").split(",").includes(phone);
}
