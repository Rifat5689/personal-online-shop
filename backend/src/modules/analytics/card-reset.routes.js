import { Router } from "express";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import { requireRoles, requireTenant } from "../../middlewares/tenant.middleware.js";
import { requireAnalytics } from "../subscription/subscription.middleware.js";
import { analyticsAllowedFor } from "../subscription/subscription.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import Store from "../store/store.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import Event from "./analytics.model.js";
import { buildAnalytics } from "./analytics.service.js";
import { analyticsRange } from "./analytics.utils.js";
const ids = new Set([
  ...["products", "orders", "customers", "revenue", "pending", "views", "statistics", "recent-orders", "attention"].map(id => `overview-${id}`),
  ...["revenue", "orders", "sessions", "conversion", "pageViews", "clicks", "averageOrder", "refunds", "trend", "funnel", "engagement", "products", "sources", "devices", "pages", "statuses", "inventory", "insights", "highlights", "live"].map(id => `analytics-${id}`),
]);
export const cardResetRouter = Router();
cardResetRouter.use(verifyJwt, requireRoles("ADMIN", "ECO", "SUPER_ADMIN"), requireTenant);
cardResetRouter.get("/", asyncHandler(async (req, res) => {
  const store = await Store.findById(req.store._id).select("+cardResets");
  res.json(new ApiResponse(200, Object.fromEntries(store.cardResets || []), "Card reset times fetched"));
}));
cardResetRouter.use("/:cardId", (req, res, next) => {
  if (!ids.has(req.params.cardId)) return next(new ApiError(400, "Choose a valid report card"));
  if (req.params.cardId.startsWith("analytics-") || req.params.cardId === "overview-views") return requireAnalytics(req, res, next);
  next();
});
cardResetRouter.post("/:cardId", asyncHandler(async (req, res) => {
  const resetAt = new Date();
  await Store.updateOne({ _id: req.store._id }, { $set: { [`cardResets.${req.params.cardId}`]: resetAt } });
  res.json(new ApiResponse(200, { resetAt }, "Card reset"));
}));
cardResetRouter.get("/:cardId/report", asyncHandler(async (req, res) => {
  const store = await Store.findById(req.store._id).select("+cardResets");
  const since = store.cardResets?.get(req.params.cardId);
  if (!since) throw new ApiError(404, "This card has not been reset");
  if (req.params.cardId.startsWith("analytics-")) {
    return res.json(new ApiResponse(200, await buildAnalytics(req.store._id, analyticsRange(req.query), since), "Card report fetched"));
  }
  const scope = { tenantId: req.store._id, resetId: null, createdAt: { $gte: since } };
  const paid = { ...scope, "payment.paymentStatus": { $in: ["paid", "partially_refunded", "refunded"] }, status: { $nin: ["cancelled", "returned"] } };
  const net = { $max: [0, { $subtract: ["$totalPrice", { $ifNull: ["$refundedAmount", 0] }] }] };
  const days = req.query.days === "7" ? 7 : 30;
  const analyticsAllowed = await analyticsAllowedFor(req.store._id, req.user);
  const [products, totalOrders, pendingOrders, customers, revenue, totalViews, recentOrders, daily, lowStockProducts] = await Promise.all([
    Product.countDocuments({ tenantId: req.store._id, deletedAt: null, createdAt: { $gte: since } }),
    Order.countDocuments(scope), Order.countDocuments({ ...scope, status: "pending" }),
    Order.aggregate([{ $match: scope }, { $group: { _id: "$shippingDetails.phone" } }, { $count: "total" }]),
    Order.aggregate([{ $match: paid }, { $group: { _id: null, total: { $sum: net } } }]),
    analyticsAllowed ? Event.countDocuments({ ...scope, type: "page_view" }) : null,
    Order.find(scope).select("-idempotencyKey -requestHash").sort({ createdAt: -1 }).limit(5),
    Order.aggregate([{ $match: { ...paid, createdAt: { $gte: new Date(Math.max(since.getTime(), Date.now() - days * 86400000)) } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dhaka" } }, revenue: { $sum: net } } }, { $sort: { _id: 1 } }]),
    Product.countDocuments({ tenantId: req.store._id, deletedAt: null, isActive: true, stock: { $lt: 10 }, createdAt: { $gte: since } }),
  ]);
  res.json(new ApiResponse(200, { products, totalOrders, pendingOrders, totalCustomers: customers[0]?.total || 0, totalRevenue: revenue[0]?.total || 0, totalViews, recentOrders, daily, lowStockProducts }, "Card report fetched"));
}));
