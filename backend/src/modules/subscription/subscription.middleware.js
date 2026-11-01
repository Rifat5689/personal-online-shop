import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { analyticsAllowedFor } from "./subscription.service.js";
export const requireAnalytics = asyncHandler(async (req, res, next) => {
  if (!(await analyticsAllowedFor(req.store._id, req.user)))
    throw new ApiError(
      403,
      "Analytics access requires an eligible subscription and platform permission",
      [{ code: "SUBSCRIPTION_REQUIRED" }],
    );
  next();
});
