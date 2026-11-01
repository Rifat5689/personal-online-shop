import mongoose from "mongoose";
import { randomBytes, createHash } from "node:crypto";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Order from "./order.model.js";
import Product from "../product/product.model.js";
import Customer from "../customer/customer.model.js";
import {

  calculatePrice,
  validateCheckout,
  transitions,
} from "./order.utils.js";

const createOrder = asyncHandler(async (req, res) => {
  validateCheckout(req.body);
  const key = req.get("Idempotency-Key");
  if (!key || !/^[a-zA-Z0-9-]{16,100}$/.test(key))
    throw new ApiError(400, "A valid Idempotency-Key is required");
  const shippingDetails = Object.fromEntries(
    ["name", "phone", "address"].map((field) => [
      field,
      req.body.shippingDetails[field].trim(),
    ]),
  );
  shippingDetails.phone = shippingDetails.phone.replace(/\D/g, "");
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        orderItems: req.body.orderItems,
        shippingDetails,
        shippingZone: req.body.shippingZone,
        customerUsername: req.body.customerUsername,
      }),
    )
    .digest("hex");
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findOne({
        tenantId: req.store._id,
        idempotencyKey: key,
      })
        .select("+trackingToken")
        .session(session);
      if (order) {
        if (order.resetId) throw new ApiError(409, "This checkout belongs to a reset. Start a new checkout.");
        if (order.requestHash !== requestHash)
          throw new ApiError(
            409,
            "Checkout key was already used for a different order",
          );
        return;
      }
      const items = [];
      for (const item of req.body.orderItems) {
        const product = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            tenantId: req.store._id,
            isActive: true,
            deletedAt: null,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { new: true, session },
        );
        if (!product)
          throw new ApiError(
            409,
            "A product is unavailable or has insufficient stock. Please review your cart.",
          );
        items.push({
          productId: product._id,
          name: product.name,
          price: calculatePrice(product),
          quantity: item.quantity,
        });
      }
      const shippingZone = req.body.shippingZone === "outsideDhaka" ? "outsideDhaka" : "insideDhaka";
      const insideFee = req.store.shippingFees?.insideDhaka ?? 70;
      const outsideFee = req.store.shippingFees?.outsideDhaka ?? 120;
      const zoneFee = shippingZone === "outsideDhaka" ? outsideFee : insideFee;
      const shippingFee = req.store.useZoneShippingFees
        ? zoneFee
        : (req.store.shippingFee !== undefined && req.store.shippingFee !== null ? req.store.shippingFee : zoneFee);
      const totalPrice =
        Math.round(
          (items.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
          ) +
            shippingFee) *
            100,
        ) / 100;
      [order] = await Order.create(
        [
          {
            tenantId: req.store._id,
            orderItems: items,
            shippingDetails,
            analyticsSessionId: /^[a-f0-9-]{36}$/i.test(req.body.analyticsSessionId || "") ? req.body.analyticsSessionId : null,
            customerUsername: String(req.body.customerUsername || "").trim(),
            shippingZone,
            shippingFee,
            totalPrice,
            payment: {
              paymentMethod: "cash on delivery",
              paymentStatus: "pending",
            },
            idempotencyKey: key,
            requestHash,
            trackingToken: randomBytes(32).toString("hex"),
          },
        ],
        { session },
      );

    });
  } finally {
    await session.endSession();
  }

  // An optional customer update must never abort the committed order transaction.
  const customerIdentifier = String(req.body.customerUsername || "").trim() || shippingDetails.name;
  if (customerIdentifier) {
    try {
      await Customer.findOneAndUpdate(
        {
          tenantId: req.store._id,
          usernameLower: customerIdentifier.toLowerCase(),
        },
        {
          $setOnInsert: {
            tenantId: req.store._id,
            username: customerIdentifier,
            usernameLower: customerIdentifier.toLowerCase(),
            createdAt: new Date(),
          },
          $set: { lastSeenAt: new Date() },
        },
        { upsert: true, setDefaultsOnInsert: true, maxTimeMS: 2000, timeoutMS: 3000 },
      );
    } catch {
      // Customer synchronization is best effort; the order is already committed.
    }
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        _id: order._id,
        totalPrice: order.totalPrice,
        status: order.status,
        trackingToken: order.trackingToken,
      },
      "Order placed",
    ),
  );
});
const getOrder = asyncHandler(async (req, res) => {
  const token = req.get("X-Tracking-Token");
  if (!token) throw new ApiError(401, "Order tracking token required");
  const order = await Order.findOne({
    _id: req.params.id,
    tenantId: req.store._id,
    trackingToken: token,
    resetId: null,
  }).select("-idempotencyKey -requestHash");
  if (!order) throw new ApiError(404, "Order not found");
  return res.json(new ApiResponse(200, order, "Order fetched"));
});
const getAllOrders = asyncHandler(async (req, res) => {
  const query =
    req.user.role === "SUPER_ADMIN" ? { resetId: null } : { tenantId: req.store._id, resetId: null };
  if (req.query.status && req.query.status !== "all")
    query.status = req.query.status;
  return res.json(
    new ApiResponse(
      200,
      await Order.find(query)
        .select("-idempotencyKey -requestHash")
        .sort({ createdAt: -1 })
        .limit(500),
      "Orders fetched",
    ),
  );
});
const getAdminOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    tenantId: req.store._id,
    resetId: null,
  }).select("-idempotencyKey -requestHash");
  if (!order) throw new ApiError(404, "Order not found");
  return res.json(new ApiResponse(200, order, "Order fetched"));
});
const updateOrder = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findOne({
        _id: req.params.id,
        tenantId: req.store._id,
        resetId: null,
      }).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      if (req.body.paymentStatus !== undefined) {
        if (status !== undefined || req.body.paymentStatus !== "paid") throw new ApiError(400, "Choose a valid payment action");
        if (["cancelled", "returned"].includes(order.status) || !["pending", "paid"].includes(order.payment.paymentStatus)) throw new ApiError(409, "This order cannot be marked paid");
        if (order.payment.paymentStatus !== "paid") {
          order.payment.paymentStatus = "paid";
          order.paidAt = new Date();
          order.paidBy = req.user._id;
          await order.save({ session });
        }
        return;
      }
      if (!transitions[order.status]?.includes(status))
        throw new ApiError(400, "Invalid order status transition");
      if (status === "cancelled" || status === "returned") {
        for (const item of order.orderItems)
          await Product.updateOne(
            { _id: item.productId, tenantId: req.store._id },
            { $inc: { stock: item.quantity } },
            { session },
          );
      }
      order.status = status;
      if (status === "delivered" && order.payment.paymentStatus === "pending") {
        order.payment.paymentStatus = "paid";
        order.paidAt = new Date();
        order.paidBy = req.user._id;
      }
      if (status === "returned" && !order.refundedAmount) order.payment.paymentStatus = "pending";
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return res.json(new ApiResponse(200, order, "Order updated"));
});
const getCustomers = asyncHandler(async (req, res) => {
  const customers = await Order.aggregate([
    { $match: { tenantId: req.store._id, resetId: null } },
    {
      $group: {
        _id: "$shippingDetails.phone",
        name: { $last: "$shippingDetails.name" },
        address: { $last: "$shippingDetails.address" },
        username: { $last: "$customerUsername" },
        orders: { $sum: 1 },
        total: { $sum: "$totalPrice" },
      },
    },
  ]);
  return res.json(new ApiResponse(200, customers, "Customers fetched"));
});
export {
  createOrder,
  getOrder,
  getAllOrders,
  getAdminOrder,
  updateOrder,
  getCustomers,
};
