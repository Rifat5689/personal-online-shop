import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin", "SUPER_ADMIN", "ADMIN", "ECO"],
      default: "user",
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    analyticsAccess: { type: String, enum: ["inherit", "allow", "deny"], default: "inherit" },
    themeAccess: { type: String, enum: ["inherit", "allow", "deny"], default: "inherit" },
    isActive: { type: Boolean, default: true },
    googleId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (["SUPER_ADMIN", "ADMIN", "ECO"].includes(this.role) && !/^\d{6}$/.test(this.password || ""))
    throw new Error("Owner and admin passwords must contain exactly six digits");
  this.password = await bcrypt.hash(this.password, 10);
  return;
});
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_VALIDITY || "15m" },
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_VALIDITY || "7d",
      jwtid: randomUUID(),
    },
  );
};

const User = mongoose.model("User", userSchema);

export default User;
