import { Router } from "express";
import {
  createProduct,
  getRecycledProducts,
  restoreProducts,
  deleteProduct,
  deleteAllProducts,
  getAllPrdoucts,
  getStoreProducts,
  getProductById,
  getProductByslug,
  updateProduct,
  uploadProductImages,
  getRelatedProducts,
} from "./product.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import { productImages } from "../../middlewares/product-images.middleware.js";
import {
  requirePlatformOwner,
  requireRoles,
  requireTenant,
  resolveStore,
} from "../../middlewares/tenant.middleware.js";
const productRouter = Router();
productRouter.get("/store/:storeSlug/:slug/related", resolveStore, getRelatedProducts);
productRouter.route("/store/:storeSlug").get(resolveStore, getStoreProducts);
productRouter
  .route("/store/:storeSlug/:slug")
  .get(resolveStore, getProductByslug);
productRouter.use(verifyJwt, requireRoles("ADMIN", "ECO", "SUPER_ADMIN"));
productRouter.get("/recycle", requirePlatformOwner, requireTenant, getRecycledProducts);
productRouter.post("/recycle/restore", requirePlatformOwner, requireTenant, restoreProducts);
productRouter.post(
  "/images",
  requireTenant,
  productImages,
  uploadProductImages,
);
productRouter
  .route("/")
  .get(
    (req, res, next) =>
      req.user.role === "SUPER_ADMIN" ? next() : requireTenant(req, res, next),
    getAllPrdoucts,
  )
  .post(requireTenant, createProduct)
  .delete(requirePlatformOwner, requireTenant, deleteAllProducts);
productRouter
  .route("/:id")
  .get(requireTenant, getProductById)
  .patch(requireTenant, updateProduct)
  .delete(requireTenant, deleteProduct);
export { productRouter };
