import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import Store from "../modules/store/store.model.js";
import User from "../modules/user/user.model.js";

const verifyJwt = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.cookies?.[
        req.get("X-App-Client") === "super-admin"
          ? "platformAccessToken"
          : "storeAccessToken"
      ];

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken",
    );

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    if (!["ADMIN", "ECO"].includes(user.role) || user.isActive === false) throw new ApiError(401, "Account disabled");
    req.user = user;
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
  const adminId = req.get("X-Admin-Id");
  if (adminId) {
    if (req.user.role !== "SUPER_ADMIN")
      throw new ApiError(
        403,
        "Only the platform owner can open an admin panel",
      );
    if (!mongoose.isValidObjectId(adminId))
      throw new ApiError(400, "Invalid administrator");
    const admin = await User.findOne({
      _id: adminId,
      role: { $in: ["ADMIN", "ECO"] },
    }).select("-password -refreshToken");
    if (!admin?.tenantId)
      throw new ApiError(404, "Assigned administrator not found");
    const store = await Store.findById(admin.tenantId);
    if (!store) throw new ApiError(404, "Assigned store not found");
    req.platformOwner = req.user;
    req.user = admin;
    req.store = store;
  }
  next();
});

export { verifyJwt };
