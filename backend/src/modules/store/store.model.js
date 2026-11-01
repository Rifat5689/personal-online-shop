import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    analyticsAccess: { type: String, enum: ["inherit", "allow", "deny"], default: "inherit" },
    themeAccess: { type: String, enum: ["inherit", "allow", "deny"], default: "inherit" },
    subscription: {
      plan: { type: String, enum: ["FREE", "PRO"], default: "FREE" },
      expiresAt: { type: Date, default: null },
      walletPaisa: { type: Number, default: 0, validate: Number.isInteger },
    },
    managedDemo: { type: Boolean, default: false, index: true },
    description: { type: String, default: "" },
    theme: { type: String, enum: ["pink", "green", "blue", "midnight", "aurora"], default: "pink" },
    totalViews: { type: Number, default: 0, min: 0 },
    cardResets: { type: Map, of: Date, default: {}, select: false },
    plan: { type: String, enum: ["Basic", "Premium"], default: "Basic" },
    subscriptionStatus: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
    },
    renewalDate: { type: Date, default: null },
    shippingFee: { type: Number, min: 0, default: 0 },
    shippingFees: {
      insideDhaka: { type: Number, min: 0, default: 70 },
      outsideDhaka: { type: Number, min: 0, default: 120 },
    },

    useZoneShippingFees: { type: Boolean, default: false },
    showShippingFees: { type: Boolean, default: true },
    whatsappNumber: { type: String, trim: true, maxlength: 30, default: "" },
    profileImage: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    supportEmail: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

const Store = mongoose.model("Store", storeSchema);
export default Store;
