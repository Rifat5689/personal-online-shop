import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import User from "./user.model.js";
import Store from "../store/store.model.js";
import {
  cookieOptions,
  generateAccessAndRefreshToken,
  verifyRefreshToken,
} from "./user.utils.js";
const cookieNames = (req) =>
  req.get("X-App-Client") === "super-admin"
    ? ["platformAccessToken", "platformRefreshToken"]
    : ["storeAccessToken", "storeRefreshToken"];
const setSessionCookies = (req, res, tokens) => {
  const [access, refresh] = cookieNames(req);
  return res
    .cookie(access, tokens.accessToken, { ...cookieOptions, maxAge: 86400000 })
    .cookie(refresh, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 86400000,
    });
};
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new ApiError(400, "A name and valid email are required");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw new ApiError(
      400,
      "Password must contain between 8 and 128 characters",
    );
  const username = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ $or: [{ username }, { email: normalizedEmail }] }))
    throw new ApiError(409, "An account with these details already exists");
  const user = await User.create({
    username,
    email: normalizedEmail,
    password,
  });
  const tokens = await generateAccessAndRefreshToken(user._id);
  return setSessionCookies(req, res, tokens)
    .status(201)
    .json(
      new ApiResponse(
        201,
        {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
          accessToken: tokens.accessToken,
        },
        "Account created",
      ),
    );
});
const logIn = asyncHandler(async (req, res) => {
  const identifier = req.body.email || req.body.username;
  const { password } = req.body;
  if (
    typeof identifier !== "string" ||
    !identifier.trim() ||
    typeof password !== "string" ||
    !password ||
    password.length > 128
  )
    throw new ApiError(400, "Username or email and password are required");
  const normalized = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalized }, { username: normalized }],
  });
  if (!user || !user.password || !(await user.isPasswordCorrect(password)))
    throw new ApiError(401, "Invalid credentials");
  if (user.isActive === false || !["ADMIN", "ECO"].includes(user.role)) throw new ApiError(403, "Account disabled");
  if (["ADMIN", "ECO"].includes(user.role)) {
    const storeSlug = process.env.STORE_SLUG || "originsofbeauty";
    if (typeof storeSlug !== "string" || !storeSlug)
      throw new ApiError(400, "Use your assigned store's admin login URL");
    const store = await Store.findOne({
      _id: user.tenantId,
      slug: storeSlug,
      status: "ACTIVE",
    });
    if (!store) throw new ApiError(401, "Invalid credentials");
  } else if (req.body.storeSlug !== undefined) {
    throw new ApiError(401, "Invalid credentials");
  }
  const tokens = await generateAccessAndRefreshToken(user._id);
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;
  return setSessionCookies(req, res, tokens).json(
    new ApiResponse(
      200,
      { user: safeUser, accessToken: tokens.accessToken },
      "Login successful",
    ),
  );
});
const logOut = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: null } });
  const [access, refresh] = cookieNames(req);
  return res
    .clearCookie(access, cookieOptions)
    .clearCookie(refresh, cookieOptions)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});
const refreshToken = asyncHandler(async (req, res) => {
  const [, refreshCookie] = cookieNames(req);
  const token =
    req.cookies?.[refreshCookie] ||
    req.get("Authorization")?.replace("Bearer ", "");
  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded._id);
  if (!user || user.isActive === false || user.refreshToken !== token)
    throw new ApiError(401, "Invalid refresh token");
  const tokens = await generateAccessAndRefreshToken(user._id);
  return setSessionCookies(req, res, tokens).json(
    new ApiResponse(
      200,
      { accessToken: tokens.accessToken },
      "Token refreshed",
    ),
  );
});
export { register, logIn, logOut, refreshToken };
