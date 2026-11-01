import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const customerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    browserId: { type: String, trim: true },
    username: { type: String, required: true, trim: true, maxlength: 40 },
    usernameLower: { type: String, lowercase: true, trim: true, index: true },
    password: { type: String, select: false, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

customerSchema.index({ tenantId: 1, usernameLower: 1 }, { unique: true, sparse: true });
customerSchema.index({ tenantId: 1, browserId: 1 });

customerSchema.pre("save", async function () {
  if (this.username) {
    this.usernameLower = this.username.toLowerCase();
  }
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

customerSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

customerSchema.methods.generateToken = function () {
  if (!process.env.ACCESS_TOKEN_SECRET) return null;
  return jwt.sign(
    {
      _id: this._id,
      tenantId: this.tenantId,
      username: this.username,
      role: "CUSTOMER",
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_VALIDITY || "30d" },
  );
};

export default mongoose.model("Customer", customerSchema);

