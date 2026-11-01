import mongoose from "mongoose";
import User from "./user.model.js";
import Store from "../store/store.model.js";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const me = asyncHandler(async (req, res) => {
  const user = req.user.toObject();
  user.store = user.tenantId ? await Store.findById(user.tenantId) : null;
  return res.json(new ApiResponse(200, user, "Session verified"));
});
const getAdmins = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await User.find({
        role: { $in: ["ADMIN", "ECO", "SUPER_ADMIN", "admin"] },
      })
        .select("-password -refreshToken")
        .populate("tenantId"),
      "Administrators fetched",
    ),
  ),
);
const createAdmin = asyncHandler(async (req, res) => {
  const { username, email, password, tenantId, role = "ADMIN", themeAccess = "inherit" } = req.body;
  if (!["inherit", "allow", "deny"].includes(themeAccess)) throw new ApiError(400, "Invalid theme access");
  if (
    !username ||
    !email ||
    typeof password !== "string" ||
    !/^\d{6}$/.test(password)
  )
    throw new ApiError(
      400,
      "Name, email, and a password of exactly six digits are required",
    );
  if (!["ADMIN", "ECO"].includes(role))
    throw new ApiError(400, "Invalid store role");
  if (!tenantId || !(await Store.findById(tenantId)))
    throw new ApiError(400, "Select a valid store");
  const user = await User.create({ username, email, password, tenantId, role, themeAccess });
  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { _id: user._id, username, email, tenantId, role },
        "Administrator created",
      ),
    );
});
const updateAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "Administrator not found");
  if (user.role === "SUPER_ADMIN")
    throw new ApiError(403, "Platform owner cannot be modified here");
  const { username, email, tenantId, role, isActive, password, themeAccess } = req.body;
  if (themeAccess !== undefined && !["inherit", "allow", "deny"].includes(themeAccess)) throw new ApiError(400, "Invalid theme access");
  if (password !== undefined && password !== "") {
    if (typeof password !== "string" || !/^\d{6}$/.test(password))
      throw new ApiError(400, "Password must contain exactly six digits");
    user.password = password;
    user.refreshToken = null;
  }
  if (tenantId && !(await Store.findById(tenantId)))
    throw new ApiError(400, "Invalid store");
  if (role && !["ADMIN", "ECO"].includes(role))
    throw new ApiError(400, "Invalid role");
  Object.assign(
    user,
    Object.fromEntries(
      Object.entries({ username, email, tenantId, role, isActive, themeAccess }).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  );
  await user.save();
  return res.json(
    new ApiResponse(200, { _id: user._id }, "Administrator updated"),
  );
});
export { me, getAdmins, createAdmin, updateAdmin };

const getAdminDetails = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    throw new ApiError(400, "Invalid administrator");
  const admin = await User.findOne({
    _id: req.params.id,
    role: { $in: ["ADMIN", "ECO"] },
  })
    .select("-password -refreshToken")
    .populate("tenantId");
  if (!admin?.tenantId)
    throw new ApiError(404, "Assigned administrator not found");
  res.json(
    new ApiResponse(
      200,
      {
        ...admin.toObject(),
        tenantId: admin.tenantId._id,
        store: admin.tenantId,
      },
      "Administrator panel ready",
    ),
  );
});
export { getAdminDetails };
