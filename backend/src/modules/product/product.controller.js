import { visibleMerchantData } from "../subscription/subscription.service.js";
import mongoose from "mongoose";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Product from "./product.model.js";
import Category from "../category/category.model.js";
import { generateUniqueSlug } from "../../services/slug.service.js";
import {
  deleteProductImages,
  uploadProductImage,
} from "../../services/product-images.service.js";
export const uploadProductImages = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, "Choose at least one image");
  const images = [];
  // Bound concurrency so a six-photo batch does not wait for six serial uploads.
  for (let index = 0; index < req.files.length; index += 3) {
    const results = await Promise.allSettled(req.files.slice(index, index + 3).map((file) => uploadProductImage(file, req.store._id)));
    for (const result of results) if (result.status === "fulfilled") images.push(result.value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      // Remove only newly uploaded objects from this unsuccessful request.
      await deleteProductImages(images, req.store._id).catch(() => {});
      throw failed.reason;
    }
  }
  return res.status(201).json(new ApiResponse(201, images, "Images uploaded"));
});
const validateProduct = async (body, tenantId) => {
  if (body.showStock !== undefined && typeof body.showStock !== "boolean")
    throw new ApiError(400, "Stock visibility must be on or off");
  if (
    body.price !== undefined &&
    (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)
  )
    throw new ApiError(400, "Invalid price");
  if (
    body.stock !== undefined &&
    (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)
  )
    throw new ApiError(400, "Stock must be a nonnegative integer");
  if (
    body.category &&
    !(await Category.findOne({ _id: body.category, tenantId, resetId: null }))
  )
    throw new ApiError(400, "Category does not belong to this store");
  if (
    body.images &&
    (!Array.isArray(body.images) ||
      body.images.some((image) => !/^https:\/\//.test(image.url || "")))
  )
    throw new ApiError(400, "Use HTTPS image URLs");
  if (body.descriptionSections !== undefined) {
    const allowed = new Set([
      "text",
      "bullets",
      "table",
      "highlights",
      "usage",
      "ingredients",
      "faq",
    ]);
    if (
      !Array.isArray(body.descriptionSections) ||
      body.descriptionSections.length > 20 ||
      body.descriptionSections.some(
        (section) =>
          !section ||
          !allowed.has(section.type) ||
          typeof section.title !== "string" ||
          section.title.length > 120 ||
          typeof section.enabled !== "boolean" ||
          typeof section.content !== "string" ||
          section.content.length > 10000 ||
          !Array.isArray(section.items) ||
          section.items.length > 100 ||
          section.items.some(
            (item) => typeof item !== "string" || item.length > 500,
          ) ||
          !Array.isArray(section.rows) ||
          section.rows.length > 100 ||
          section.rows.some(
            (row) =>
              !row ||
              typeof row.label !== "string" ||
              row.label.length > 120 ||
              typeof row.value !== "string" ||
              row.value.length > 500,
          ),
      )
    )
      throw new ApiError(400, "Invalid structured description");
  }
};
const fields = [
  "name",
  "description",
  "title",
  "subtitle",
  "shortDescription",
  "descriptionSections",
  "price",
  "category",
  "stock",
  "showStock",
  "discount",
  "isActive",
  "images",
];
const pick = (body) =>
  Object.fromEntries(
    fields
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
const createProduct = asyncHandler(async (req, res) => {
  if (!req.body.name || req.body.price === undefined)
    throw new ApiError(400, "Name and price are required");
  await validateProduct(req.body, req.store._id);
  const data = pick(req.body);
  if (!data.category) data.category = null;
  data.images = (data.images || []).map((image, index) => ({
    url: image.url,
    public_id: image.public_id || `external-${index}`,
  }));
  const product = await Product.create({
    ...data,
    tenantId: req.store._id,
    slug: await generateUniqueSlug(data.name),
  });
  return res.status(201).json(new ApiResponse(201, await visibleMerchantData(req, product), "Product created"));
});
const getAllPrdoucts = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await visibleMerchantData(req, await Product.find(
        req.user.role === "SUPER_ADMIN" ? { deletedAt: null } : { tenantId: req.store._id, deletedAt: null },
      )
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(500)),
      "Products fetched",
    ),
  ),
);
const getStoreProducts = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await Product.find({ tenantId: req.store._id, deletedAt: null, isActive: true })
        .select("-images.public_id -totalViews -__v -createdAt -updatedAt")
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .limit(500),
      "Products fetched",
    ),
  ),
);
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const current = await Product.findOne({ tenantId: req.store._id, slug: req.params.slug, deletedAt: null, isActive: true }).select("_id category").lean();
  if (!current) throw new ApiError(404, "Product not found");
  const base = { tenantId: req.store._id, deletedAt: null, isActive: true, stock: { $gt: 0 }, _id: { $ne: current._id } };
  const publicFields = "-images.public_id -totalViews -__v -createdAt -updatedAt";
  const related = current.category ? await Product.find({ ...base, category: current.category }).select(publicFields).sort({ createdAt: -1, _id: -1 }).limit(10).populate("category", "name slug") : [];
  if (related.length < 10) related.push(...await Product.find({ ...base, _id: { $nin: [current._id, ...related.map((item) => item._id)] } }).select(publicFields).sort({ createdAt: -1, _id: -1 }).limit(10 - related.length).populate("category", "name slug"));
  res.json(new ApiResponse(200, related, "Related products fetched"));
});
const getProductByslug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ tenantId: req.store._id, slug: req.params.slug, isActive: true, deletedAt: null })
    .select("-images.public_id -totalViews -__v -createdAt -updatedAt")
    .populate("category", "name slug");
  if (!product) throw new ApiError(404, "Product not found");
  return res.json(new ApiResponse(200, req.user ? await visibleMerchantData(req, product) : product, "Product fetched"));
});
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    tenantId: req.store._id,
    deletedAt: null,
  });
  if (!product) throw new ApiError(404, "Product not found");
  return res.json(new ApiResponse(200, req.user ? await visibleMerchantData(req, product) : product, "Product fetched"));
});
const updateProduct = asyncHandler(async (req, res) => {
  await validateProduct(req.body, req.store._id);
  const data = pick(req.body);
  if (data.category === "") data.category = null;
  if (data.images)
    data.images = data.images.map((image, index) => ({
      url: image.url,
      public_id: image.public_id || `external-${index}`,
    }));
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.store._id, deletedAt: null },
    data,
    { new: true, runValidators: true },
  );
  if (!product) throw new ApiError(404, "Product not found");
  return res.json(new ApiResponse(200, await visibleMerchantData(req, product), "Product updated"));
});
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.store._id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
    { new: true },
  );
  if (!product) throw new ApiError(404, "Product not found");
  return res.json(new ApiResponse(200, null, "Product moved to recycle bin"));
});
const deleteAllProducts = asyncHandler(async (req, res) => {
  const result = await Product.updateMany(
    { tenantId: req.store._id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
  );
  return res.json(new ApiResponse(200, { deletedProducts: result.modifiedCount }, "All store products moved to recycle bin"));
});
const getRecycledProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ tenantId: req.store._id, deletedAt: { $ne: null } })
    .populate("category", "name").sort({ deletedAt: -1 }).limit(500);
  return res.json(new ApiResponse(200, products, "Recycled products fetched"));
});
const restoreProducts = asyncHandler(async (req, res) => {
  const ids = req.body.productIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)))
    throw new ApiError(400, "Select valid products to restore");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const filter = { _id: { $in: ids }, tenantId: req.store._id, deletedAt: { $ne: null } };
      const products = await Product.find(filter).select("category").session(session);
      await Category.updateMany({ _id: { $in: products.map(product => product.category).filter(Boolean) }, tenantId: req.store._id, resetId: { $ne: null } }, { $set: { resetId: null } }, { session });
      result = await Product.updateMany(filter,
        [{ $set: { deletedAt: null, deletedBy: null, resetId: null, totalViews: { $add: [{ $ifNull: ["$totalViews", 0] }, { $ifNull: ["$resetViews", 0] }] }, resetViews: 0 } }],
        { session },
      );
    });
  } finally { await session.endSession(); }
  return res.json(new ApiResponse(200, { restoredProducts: result.modifiedCount }, "Selected products restored"));
});
export {
  getRecycledProducts,
  restoreProducts,
  createProduct,
  getAllPrdoucts,
  getStoreProducts,
  getProductById,
  getProductByslug,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
};
