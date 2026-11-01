import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  visitorId: { type: String, required: true },
  page: String,
  productId: { type: mongoose.Schema.Types.ObjectId, default: null },
  updatedAt: Date,
  expiresAt: Date,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ tenantId: 1, expiresAt: 1 });
export default mongoose.model("LivePresence", schema);
