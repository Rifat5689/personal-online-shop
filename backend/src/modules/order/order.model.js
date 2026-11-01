import { model, Schema } from "mongoose";
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    refundedQuantity: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orderItems: [orderItemSchema],
    reviews: { type: [new Schema({
      productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
      text: { type: String, required: true, trim: true, maxlength: 3000 },
      displayName: { type: String, required: true, trim: true, maxlength: 100 },
      deletedAt: { type: Date, default: null },
      images: { type: [{ url: String, public_id: String }], default: [] },
      createdAt: { type: Date, default: Date.now },
    })], default: [] },
    shippingDetails: { name: String, phone: String, address: String },
    analyticsSessionId: { type: String, default: null },
    customerUsername: { type: String, trim: true, maxlength: 40, default: "" },
    shippingZone: {
      type: String,
      enum: ["insideDhaka", "outsideDhaka"],
      default: "insideDhaka",
    },
    shippingFee: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    payment: {
      paymentMethod: {
        type: String,
        enum: ["cash on delivery"],
        default: "cash on delivery",
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "partially_refunded", "refunded"],
        default: "pending",
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipping",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "pending",
    },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundedShippingFee: { type: Number, default: 0, min: 0 },
    resetId: { type: Schema.Types.ObjectId, default: null, index: true },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    trackingToken: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
orderSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tenantId: { $type: "objectId" },
      idempotencyKey: { $type: "string" },
    },
  },
);
const Order = model("Order", orderSchema);
export default Order;
