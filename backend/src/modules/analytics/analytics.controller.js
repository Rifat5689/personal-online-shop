import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Event, { eventTypes } from "./analytics.model.js";
import Product from "../product/product.model.js";
import { analyticsRange } from "./analytics.utils.js";
import { buildAnalytics } from "./analytics.service.js";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const recordEvent = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!uuid.test(body.eventId || "") || !uuid.test(body.sessionId || "") || !eventTypes.includes(body.type)) throw new ApiError(400, "Invalid analytics event");
  const productType = ["product_view", "product_click", "add_to_cart"].includes(body.type);
  if (productType && (!/^[a-f0-9]{24}$/i.test(body.productId || "") || !await Product.exists({ _id: body.productId, tenantId: req.store._id, deletedAt: null, isActive: true }))) throw new ApiError(400, "Invalid analytics product");
  if (body.type === "engagement" && (!Number.isInteger(body.seconds) || body.seconds < 1 || body.seconds > 60)) throw new ApiError(400, "Invalid engagement duration");
  const pages = ["home", "products", "product", "category", "cart", "checkout", "orders", "account", "auth", "other"];
  const source = typeof body.source === "string" && /^(Direct|[a-z0-9.-]{1,100})$/i.test(body.source) ? body.source : "Direct";
  const recorded = await Event.updateOne({ tenantId: req.store._id, eventId: body.eventId }, { $setOnInsert: {
    tenantId: req.store._id, eventId: body.eventId, sessionId: body.sessionId, type: body.type,
    productId: productType ? body.productId : null, page: pages.includes(body.page) ? body.page : "other",
    source, device: ["mobile", "tablet", "desktop"].includes(body.device) ? body.device : "desktop", seconds: body.type === "engagement" ? body.seconds : 0,
  } }, { upsert: true });
  if (recorded.upsertedCount && body.type === 'product_view') await Product.updateOne({ _id: body.productId, tenantId: req.store._id }, { $inc: { totalViews: 1 } });
  return res.status(201).json(new ApiResponse(201, { recorded: true }, "Event recorded"));
});
export const getAnalytics = asyncHandler(async (req, res) => res.json(new ApiResponse(200, await buildAnalytics(req.store._id, analyticsRange(req.query)), "Analytics fetched")));
