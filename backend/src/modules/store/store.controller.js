import { themeAllowedFor, visibleMerchantData } from "../subscription/subscription.service.js";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Store from "./store.model.js";
import { uploadProductImage } from "../../services/product-images.service.js";
const createStore = asyncHandler(async (req, res) => {
  const { name, slug, description = "", plan = "Basic", theme = "pink", themeAccess = "inherit" } = req.body;
  if (!["pink", "green", "blue", "midnight", "aurora"].includes(theme) || !["inherit", "allow", "deny"].includes(themeAccess)) throw new ApiError(400, "Choose a valid theme and access policy");
  if (
    !name ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "") ||
    ["admin", "login", "stores"].includes(slug)
  )
    throw new ApiError(400, "Name and a valid unique store slug are required");
  const store = await Store.create({ name, slug, description, plan, theme, themeAccess });
  return res.status(201).json(new ApiResponse(201, store, "Store created"));
});
const getStores = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await Store.find().sort({ createdAt: -1 }),
      "Stores fetched",
    ),
  ),
);
const getPublicStores = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await Store.find({ status: "ACTIVE" }).select("name slug description"),
      "Stores fetched",
    ),
  ),
);
const getStore = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      req.user
        ? await visibleMerchantData(req, req.store)
        : {
            _id: req.store._id,
            name: req.store.name,
            slug: req.store.slug,
            description: req.store.description,
            theme: req.store.theme || "pink",
            shippingFee: req.store.shippingFee,
            shippingFees: req.store.shippingFees,
            useZoneShippingFees: req.store.useZoneShippingFees,
            showShippingFees: req.store.showShippingFees,
            whatsappNumber: req.store.whatsappNumber,
            profileImage: req.store.profileImage,
            supportEmail: req.store.supportEmail,
            status: req.store.status,
          },
      "Store fetched",
    ),
  ),
);
const updateStore = asyncHandler(async (req, res) => {
  if (req.body.theme !== undefined && !["pink", "green", "blue", "midnight", "aurora"].includes(req.body.theme))
    throw new ApiError(400, "Choose a valid store theme: pink, green, blue, midnight, or aurora");
  if (req.body.themeAccess !== undefined && !["inherit", "allow", "deny"].includes(req.body.themeAccess)) throw new ApiError(400, "Choose inherit, allow or deny");
  if (req.body.theme !== undefined && req.body.theme !== req.store?.theme && req.user.role !== "SUPER_ADMIN" && !req.platformOwner && !await themeAllowedFor(req.store, req.user)) {
    throw new ApiError(403, "A Pro subscription is required to change themes", [{ code: "SUBSCRIPTION_REQUIRED", feature: "themes" }]);
  }
  const fields =
    req.user.role === "SUPER_ADMIN"
      ? [
          "name",
          "description",
          "theme",
          "themeAccess",
          "status",
          "plan",
          "subscriptionStatus",
          "renewalDate",
          "shippingFee",
          "shippingFees",
          "useZoneShippingFees",
          "showShippingFees",
          "whatsappNumber",
          "supportEmail",
        ]
      : [
          "name",
          "description",
          "theme",
          "shippingFee",
          "shippingFees",
          "useZoneShippingFees",
          "showShippingFees",
          "whatsappNumber",
          "supportEmail",
        ];
  const data = Object.fromEntries(
    fields
      .filter((key) => req.body[key] !== undefined)
      .map((key) => [key, req.body[key]]),
  );
  const id = req.user.role === "SUPER_ADMIN" ? req.params.id : req.store._id;
  const store = await Store.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!store) throw new ApiError(404, "Store not found");
  return res.json(new ApiResponse(200, await visibleMerchantData(req, store), "Store updated"));
});
const recordStoreVisit = asyncHandler(async (req, res) => {
  const result = await Store.updateOne(
    { _id: req.store._id, status: "ACTIVE" },
    { $inc: { totalViews: 1 } },
  );
  if (!result.matchedCount) throw new ApiError(404, "Store is unavailable");
  return res.status(201).json(new ApiResponse(201, { recorded: true }, "Visit recorded"));
});
const uploadStoreProfile = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, "Choose a store image");
  const image = await uploadProductImage(
    req.files[0],
    req.store._id,
    "profile",
  );
  const store = await Store.findByIdAndUpdate(
    req.store._id,
    { profileImage: image },
    { new: true, runValidators: true },
  );
  return res
    .status(201)
    .json(new ApiResponse(201, store.profileImage, "Store image uploaded"));
});
export {
  createStore,
  getStores,
  getPublicStores,
  getStore,
  updateStore,
  recordStoreVisit,
  uploadStoreProfile,
};
