import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    public_id: { type: String, required: true },
  },
  { _id: false },
);

const descriptionRowSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 120, default: "" },
    value: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false },
);

const descriptionSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "text",
        "bullets",
        "table",
        "highlights",
        "usage",
        "ingredients",
        "faq",
      ],
      required: true,
    },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    enabled: { type: Boolean, default: true },
    content: { type: String, maxlength: 10000, default: "" },
    items: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: [],
    },
    rows: { type: [descriptionRowSchema], default: [] },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    descriptionSections: {
      type: [descriptionSectionSchema],
      default: [],
      validate: {
        validator: (sections) => sections.length <= 20,
        message: "A product can have up to 20 description sections",
      },
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
      default: null,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    showStock: { type: Boolean, default: true },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    resetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    resetViews: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    totalViews: { type: Number, default: 0 },
  },

  {
    timestamps: true,
  },
);

const Product = mongoose.model("Product", productSchema);
export default Product;
