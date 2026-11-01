import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Category from "./category.model.js";
import Product from "../product/product.model.js";
import mongoose from "mongoose";
import { uploadProductImage, deleteCategoryImage } from "../../services/product-images.service.js";
const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ tenantId: req.store._id, resetId: null }).sort({ name: 1 }).lean();
  if (req.user) {
    const counts = await Product.aggregate([
      { $match: { tenantId: req.store._id, deletedAt: null, category: { $in: categories.map(category => category._id) } } },
      { $group: { _id: "$category", total: { $sum: 1 } } },
    ]);
    const byCategory = new Map(counts.map(count => [String(count._id), count.total]));
    for (const category of categories) category.productCount = byCategory.get(String(category._id)) || 0;
  }
  return res.json(new ApiResponse(200, categories, "Categories fetched"));
});
const createCategory = asyncHandler(async (req, res) => {
  if (!req.body.name?.trim()) throw new ApiError(400, "Category name required");
  const baseSlug = req.body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!baseSlug) throw new ApiError(400, "Category requires an English URL name");
  let slug = baseSlug;
  let suffix = 2;
  while (await Category.exists({ tenantId: req.store._id, slug })) {
    const existing = await Category.findOne({ tenantId: req.store._id, slug });
    if (!existing.resetId) throw new ApiError(409, "Category already exists");
    slug = `${baseSlug}-${suffix++}`;
  }
  const image = req.file ? await uploadProductImage(req.file, req.store._id, "categories") : undefined;
  let category;
  try {
    category = await Category.create({
      name: req.body.name,
      slug,
      tenantId: req.store._id,
      resetId: null,
      image,
    });
  } catch (error) {
    await deleteCategoryImage(image, req.store._id).catch(() => {});
    throw error;
  }
  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created"));
});
const updateCategory = asyncHandler(async (req, res) => {
  if (!req.body.name?.trim()) throw new ApiError(400, "Category name required");
  const category = await Category.findOne({ _id: req.params.id, tenantId: req.store._id, resetId: null });
  if (!category) throw new ApiError(404, "Category not found");
  const oldImage = category.image?.url ? { url: category.image.url, public_id: category.image.public_id } : undefined;
  const image = req.file ? await uploadProductImage(req.file, req.store._id, "categories") : undefined;
  category.name = req.body.name;
  if (image) category.image = image;
  else if (req.body.removeImage === "true" || req.body.removeImage === true) category.image = undefined;
  try { await category.save(); }
  catch (error) {
    await deleteCategoryImage(image, req.store._id).catch(() => {});
    throw error;
  }
  if (image || !category.image?.url) await deleteCategoryImage(oldImage, req.store._id).catch(() => {});
  return res.json(new ApiResponse(200, category, "Category updated"));
});
const deleteCategory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let category;
  let updatedProducts = 0;
  try {
    await session.withTransaction(async () => {
      category = await Category.findOne({
        _id: req.params.id, tenantId: req.store._id, resetId: null,
      }).session(session);
      if (!category) throw new ApiError(404, "Category not found");
      const result = await Product.updateMany(
        { category: category._id, tenantId: req.store._id },
        { $set: { category: null } },
        { session },
      );
      updatedProducts = result.modifiedCount;
      await Category.deleteOne({ _id: category._id, tenantId: req.store._id }, { session });
    });
  } finally {
    await session.endSession();
  }
  await deleteCategoryImage(category.image, req.store._id).catch(() => {});
  return res.json(new ApiResponse(200, { updatedProducts }, "Category deleted. Products kept with no category."));
});
export { listCategories, createCategory, updateCategory, deleteCategory };
