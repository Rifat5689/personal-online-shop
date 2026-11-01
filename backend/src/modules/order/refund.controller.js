import mongoose from "mongoose";
import { createHash } from "node:crypto";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Order from "./order.model.js";
import Refund from "./refund.model.js";

export const recordRefund = asyncHandler(async (req, res) => {
  const key = req.get("Idempotency-Key");
  if (!key || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) throw new ApiError(400, "A valid refund request key is required");
  const items = req.body.items;
  const includeShipping = req.body.includeShipping === true;
  if (!Array.isArray(items) || items.length > 100 || (!items.length && !includeShipping) || items.some(item => !item || !/^[a-f0-9]{24}$/i.test(item.productId || "") || !Number.isInteger(item.quantity) || item.quantity < 1) || new Set(items.map(item => item.productId)).size !== items.length)
    throw new ApiError(400, "Select valid products and refund quantities");
  if (req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.length > 500)) throw new ApiError(400, "Refund reason must be under 500 characters");
  const reason = (req.body.reason || "").trim();
  const hash = createHash("sha256").update(JSON.stringify({ items, includeShipping, reason })).digest("hex");
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findOne({ _id: req.params.id, tenantId: req.store._id, resetId: null }).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      const existing = await Refund.findOne({ tenantId: req.store._id, orderId: order._id, idempotencyKey: key }).session(session);
      if (existing) {
        if (existing.requestHash !== hash) throw new ApiError(409, "Refund request key was already used for a different refund");
        return;
      }
      if (["cancelled", "returned"].includes(order.status) || !["paid", "partially_refunded"].includes(order.payment.paymentStatus)) throw new ApiError(409, "Only paid orders can be refunded");
      let cents = 0;
      for (const item of items) {
        const line = order.orderItems.find(line => String(line.productId) === item.productId);
        if (!line || item.quantity > line.quantity - (line.refundedQuantity || 0)) throw new ApiError(409, "Refund quantity exceeds the remaining purchased quantity");
        line.refundedQuantity = (line.refundedQuantity || 0) + item.quantity;
        cents += Math.round(line.price * 100) * item.quantity;
      }
      const shippingCents = includeShipping ? Math.round((order.shippingFee - (order.refundedShippingFee || 0)) * 100) : 0;
      cents += shippingCents;
      const totalRefundedCents = Math.round((order.refundedAmount || 0) * 100) + cents;
      if (cents <= 0 || totalRefundedCents > Math.round(order.totalPrice * 100)) throw new ApiError(409, "Refund exceeds the remaining paid amount");
      order.refundedAmount = totalRefundedCents / 100;
      order.refundedShippingFee = ((Math.round((order.refundedShippingFee || 0) * 100)) + shippingCents) / 100;
      order.payment.paymentStatus = totalRefundedCents === Math.round(order.totalPrice * 100) ? "refunded" : "partially_refunded";
      await order.save({ session });
      await Refund.create([{ tenantId: req.store._id, orderId: order._id, recordedBy: req.user._id, idempotencyKey: key, requestHash: hash, amount: cents / 100, shippingFee: shippingCents / 100, items, reason }], { session });
    });
  } finally { await session.endSession(); }
  return res.json(new ApiResponse(200, order, "Refund recorded and revenue updated"));
});
