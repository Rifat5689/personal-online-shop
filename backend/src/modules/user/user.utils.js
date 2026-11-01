import ApiError from "../../utils/ApiError.js";
import User from "./user.model.js";

const generateAccessAndRefreshToken = async (id) => {
  const user = await User.findById(id);
  if (!user)
    throw new ApiError(
      500,
      "something went wrong while generating access and refreshToken",
    );
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

import jwt from "jsonwebtoken";

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw new ApiError(401, "Token expired");
    throw new ApiError(401, "Invalid token");
  }
};

export { generateAccessAndRefreshToken, cookieOptions, verifyRefreshToken };
