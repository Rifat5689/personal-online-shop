import mongoose from "mongoose";
export const eventTypes = ["page_view", "product_view", "product_click", "add_to_cart", "checkout_start", "search", "engagement"];
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  eventId: { type: String, required: true },
  sessionId: { type: String, required: true },
  type: { type: String, enum: eventTypes, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, default: null },
  page: { type: String, default: "other" },
  source: { type: String, default: "Direct" },
  device: { type: String, enum: ["mobile", "tablet", "desktop"], default: "desktop" },
  seconds: { type: Number, default: 0 },
  resetId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });
schema.index({ tenantId: 1, eventId: 1 }, { unique: true });
schema.index({ tenantId: 1, resetId: 1, createdAt: 1 });
schema.index({ tenantId: 1, sessionId: 1, createdAt: 1 });
export default mongoose.model("AnalyticsEvent", schema);
