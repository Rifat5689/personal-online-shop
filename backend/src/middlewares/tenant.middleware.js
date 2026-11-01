import ApiError from "../utils/ApiError.js";
import Store from "../modules/store/store.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      throw new ApiError(403, "Permission denied");
    next();
  };
const requirePlatformOwner = (req, res, next) => {
  if ((req.platformOwner || req.user)?.role !== "SUPER_ADMIN")
    throw new ApiError(403, "Permission denied");
  next();
};
const resolveStore = asyncHandler(async (req, res, next) => {
  const store = await Store.findOne({
    slug: process.env.STORE_SLUG || "originsofbeauty",
    status: "ACTIVE",
  });
  if (!store) throw new ApiError(404, "Store is unavailable");
  req.store = store;
  next();
});
const requireTenant = asyncHandler(async (req, res, next) => {
  const tenantId =
    req.user.role === "SUPER_ADMIN"
      ? req.body?.tenantId || req.query.tenantId
      : req.user.tenantId;
  if (!tenantId) throw new ApiError(400, "A store assignment is required");
  const store = await Store.findById(tenantId);
  if (
    !store || store.slug !== (process.env.STORE_SLUG || "originsofbeauty") ||
    (req.user.role !== "SUPER_ADMIN" &&
      !req.platformOwner &&
      store.status !== "ACTIVE")
  )
    throw new ApiError(403, "Store unavailable");
  const requestedSlug = req.get("X-Store-Slug");
  if (
    requestedSlug &&
    req.user.role !== "SUPER_ADMIN" &&
    requestedSlug !== store.slug
  )
    throw new ApiError(403, "Permission denied");
  req.store = store;
  next();
});
export { requirePlatformOwner, requireRoles, resolveStore, requireTenant };
