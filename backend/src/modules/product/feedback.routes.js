import { Router } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { clientKey } from "../../utils/clientIp.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { resolveStore, requireTenant, requireRoles } from "../../middlewares/tenant.middleware.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import { productImages } from "../../middlewares/product-images.middleware.js";
import { uploadProductImage, deleteProductImages } from "../../services/product-images.service.js";
import Product from "./product.model.js";
import Order from "../order/order.model.js";

const questionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  reply: { type: String, default: "", maxlength: 3000 },
  repliedAt: Date,
}, { timestamps: true });
questionSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
export const ProductQuestion = mongoose.model("ProductQuestion", questionSchema);
export const feedbackRouter = Router();
const send = (res, data, status = 200) => res.status(status).json(new ApiResponse(status, data, "Feedback updated"));
const text = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(400, `${label} is required (up to ${max} characters)`);
  return value.trim();
};
const product = asyncHandler(async (req, _res, next) => {
  req.product = await Product.findOne({ _id: req.params.productId, tenantId: req.store._id, deletedAt: null, isActive: true });
  if (!req.product) throw new ApiError(404, "Product not found");
  next();
});
const writeLimit = rateLimit({ windowMs: 15 * 60000, limit: 15, keyGenerator: clientKey, standardHeaders: "draft-8", legacyHeaders: false });
const reviewPipeline = (tenantId, productId) => [
  { $match: { tenantId, resetId: null, "reviews.productId": productId } },
  { $unwind: "$reviews" },
  { $match: { "reviews.productId": productId, "reviews.deletedAt": null } },
  { $set: { "reviews.displayName": { $ifNull: ["$shippingDetails.name", "$reviews.displayName"] } } },
  { $replaceRoot: { newRoot: "$reviews" } },
];
feedbackRouter.get("/store/:storeSlug/products/:productId", resolveStore, product, asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const filter = { tenantId: req.store._id, productId: req.product._id };
  const [reviews, questions, questionCount] = await Promise.all([
    Order.aggregate([
      ...reviewPipeline(req.store._id, req.product._id),
      { $facet: {
        items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 10 }, { $limit: 10 }, { $project: { "images.public_id": 0 } }],
        summary: [{ $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }],
      } },
    ]),
    ProductQuestion.find(filter).select("text reply repliedAt createdAt").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10),
    ProductQuestion.countDocuments(filter),
  ]);
  send(res, { reviews: reviews[0]?.items || [], summary: reviews[0]?.summary[0] || { count: 0, average: 0 }, questions, questionCount });
}));
feedbackRouter.post("/store/:storeSlug/products/:productId/questions", writeLimit, resolveStore, product, asyncHandler(async (req, res) => {
  const entry = await ProductQuestion.create({ tenantId: req.store._id, productId: req.product._id, text: text(req.body.text, 1000, "Question") });
  send(res, { _id: entry._id }, 201);
}));
const reviewAccess = asyncHandler(async (req, _res, next) => {
  const token = req.get("X-Tracking-Token");
  if (!token) throw new ApiError(401, "Order tracking token required");
  req.order = await Order.findOne({ _id: req.params.orderId, tenantId: req.store._id, trackingToken: token, resetId: null });
  if (!req.order) throw new ApiError(404, "Order not found");
  if (req.order.status !== "delivered") throw new ApiError(409, "Reviews are available after delivery");
  if (!req.order.orderItems.some(item => String(item.productId) === req.params.productId)) throw new ApiError(400, "This product is not in your order");
  if (req.order.reviews.some(item => String(item.productId) === req.params.productId)) throw new ApiError(409, "You have already reviewed this product in this order");
  next();
});
feedbackRouter.post("/store/:storeSlug/orders/:orderId/products/:productId/reviews", writeLimit, resolveStore, reviewAccess, productImages, asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "Choose a rating from 1 to 5");
  const review = { productId: req.params.productId, rating, text: text(req.body.text, 3000, "Review"), displayName: req.order.shippingDetails?.name?.trim().slice(0, 100) || "Customer", images: [] };
  try {
    for (const file of req.files || []) review.images.push(await uploadProductImage(file, req.store._id));
    const result = await Order.updateOne({ _id: req.order._id, tenantId: req.store._id, status: "delivered", resetId: null, "reviews.productId": { $ne: req.params.productId } }, { $push: { reviews: review } }, { runValidators: true });
    if (!result.modifiedCount) throw new ApiError(409, "Review already submitted or order status changed");
  } catch (error) {
    await deleteProductImages(review.images, req.store._id).catch(() => {});
    throw error;
  }
  send(res, { submitted: true }, 201);
}));
feedbackRouter.use(verifyJwt, requireRoles("ADMIN", "ECO", "SUPER_ADMIN"), requireTenant);
feedbackRouter.get("/products/:productId/reviews", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) throw new ApiError(400, "Choose a valid product");
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const [result] = await Order.aggregate([
    ...reviewPipeline(req.store._id, new mongoose.Types.ObjectId(req.params.productId)),
    { $facet: {
      items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 10 }, { $limit: 10 }, { $project: { "images.public_id": 0 } }],
      count: [{ $count: "total" }],
    } },
  ]);
  send(res, { items: result?.items || [], total: result?.count[0]?.total || 0 });
}));
feedbackRouter.delete("/reviews/:id", asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { tenantId: req.store._id, resetId: null, "reviews._id": req.params.id },
    { $set: { "reviews.$.deletedAt": new Date() } },
    { new: false },
  ).select("reviews");
  if (!order) throw new ApiError(404, "Review not found");
  const review = order.reviews.id(req.params.id);
  let photoCleanupPending = false;
  try { await deleteProductImages(review.images, req.store._id); }
  catch { photoCleanupPending = true; }
  send(res, { deleted: true, photoCleanupPending });
}));
feedbackRouter.get("/products/:productId/questions", asyncHandler(async (req, res) => {
  send(res, await ProductQuestion.find({ tenantId: req.store._id, productId: req.params.productId }).select("text reply repliedAt createdAt").sort({ createdAt: -1 }).limit(200));
}));
feedbackRouter.patch("/questions/:id", asyncHandler(async (req, res) => {
  const question = await ProductQuestion.findOneAndUpdate({ _id: req.params.id, tenantId: req.store._id }, { $set: { reply: text(req.body.reply, 3000, "Reply"), repliedAt: new Date() } }, { new: true, runValidators: true });
  if (!question) throw new ApiError(404, "Question not found");
  send(res, question);
}));
