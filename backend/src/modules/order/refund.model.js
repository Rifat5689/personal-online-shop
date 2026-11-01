import { model, Schema } from "mongoose";
const schema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  orderId: { type: Schema.Types.ObjectId, required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  idempotencyKey: { type: String, required: true },
  requestHash: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  shippingFee: { type: Number, default: 0 },
  reason: { type: String, default: "" },
  items: [{ productId: Schema.Types.ObjectId, quantity: Number }],
}, { timestamps: true });
schema.index({ tenantId: 1, orderId: 1, idempotencyKey: 1 }, { unique: true });
export default model("OrderRefund", schema);
