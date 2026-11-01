import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { clientKey } from "../../utils/clientIp.js";
import {
  createStore,
  getStores,
  getPublicStores,
  getStore,
  updateStore,
  recordStoreVisit,
  uploadStoreProfile,
} from "./store.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import {
  requireRoles,
  requireTenant,
  resolveStore,
} from "../../middlewares/tenant.middleware.js";
import { productImages } from "../../middlewares/product-images.middleware.js";
import {getSummary} from './summary.controller.js';
const storeRoutes = Router();
storeRoutes.get('/summary',verifyJwt,requireRoles('ADMIN','ECO'),requireTenant,getSummary);

storeRoutes.route("/slug/:storeSlug").get(resolveStore, getStore);
storeRoutes.post(
  "/slug/:storeSlug/views",
  rateLimit({ windowMs: 15 * 60000, limit: 120, keyGenerator: clientKey, standardHeaders: "draft-8", legacyHeaders: false }),
  resolveStore,
  recordStoreVisit,
);
storeRoutes
  .route("/mine")
  .get(verifyJwt, requireRoles("ADMIN", "ECO"), requireTenant, getStore)
  .patch(verifyJwt, requireRoles("ADMIN"), requireTenant, updateStore);
storeRoutes.post(
  ["/mine/profile-image", "/mine/profile-photo"],
  verifyJwt,
  requireRoles("ADMIN"),
  requireTenant,
  productImages,
  uploadStoreProfile,
);
export { storeRoutes };
