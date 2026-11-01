import { Router } from "express";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./category.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import {
  requireRoles,
  requireTenant,
  resolveStore,
} from "../../middlewares/tenant.middleware.js";
// May use later: restore the standalone storefront category overview page.
// Keep these APIs active for the home category slider and admin category management.
import { categoryImage } from "../../middlewares/product-images.middleware.js";
const categoryRouter = Router();
categoryRouter.route("/store/:storeSlug").get(resolveStore, listCategories);
categoryRouter.use(
  verifyJwt,
  requireRoles("ADMIN", "ECO", "SUPER_ADMIN"),
  requireTenant,
);
categoryRouter.route("/").get(listCategories).post(categoryImage, createCategory);
categoryRouter.route("/:id").patch(categoryImage, updateCategory).delete(deleteCategory);
export { categoryRouter };
