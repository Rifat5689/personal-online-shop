import mongoose from "mongoose";
import Product from "../product/product.model.js";
import Category from "../category/category.model.js";
import Store from "../store/store.model.js";
import ApiError from "../../utils/ApiError.js";
const groups = [
  ["facewash", "face wash", "cleanser", "ফেসওয়াশ", "ফেসওয়াশ", "ফেস ওয়াশ"],
  ["oily", "oil control", "তৈলাক্ত", "অয়েলি", "অয়েলি"],
  ["dry", "শুষ্ক", "ড্রাই"], ["bag", "handbag", "ব্যাগ", "হ্যান্ডব্যাগ"],
  ["pink", "গোলাপি", "পিংক"], ["sunscreen", "sun screen", "সানস্ক্রিন", "spf"],
  ["serum", "সিরাম"], ["moisturizer", "ময়েশ্চারাইজার", "ময়েশ্চারাইজার"],
];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stop = new Set("apu apni ache ase er jonno ta tar dekhan dekhান koto dam price please show me for the a an আছে আপু জন্য দাম কত দেখান টাকা মধ্যে takar moddhe".split(" "));
export function queryGroups(value) {
  if (typeof value !== "string" || value.length > 200) throw new ApiError(400, "Search must be text under 200 characters");
  const query = value.toLowerCase().normalize("NFKC");
  const found = groups.filter(group => group.some(term => query.includes(term)));
  let rest = query;
  for (const group of found) for (const term of group) rest = rest.replaceAll(term, " ");
  return [...found, ...rest.split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 1 && !stop.has(word) && !/^\d+$/.test(word)).map(word => [word])].slice(0, 8);
}
export function productPrice(product) { return Math.round(product.price * (1 - (product.discount || 0) / 100) * 100) / 100; }
export function catalogProduct(product) {
  const origin = process.env.PUBLIC_STOREFRONT_URL || process.env.STOREFRONT_URL || (process.env.DATABASE_ROLE === "test" ? "https://test-originsofbeauty.web.app" : "");
  return { id: String(product._id), name: product.name, price: product.price, discount: product.discount, salePrice: productPrice(product),
    description: (product.shortDescription || product.description || "").slice(0, 800), category: product.category?.name || "",
    variants: [], images: (product.images || []).map(image => image.url).filter(url => /^https:\/\//i.test(url)).slice(0, 3),
    url: /^https:\/\//.test(origin) ? `${origin.replace(/\/$/, "")}/products/${encodeURIComponent(product.slug)}` : null,
    availability: "Requires human verification" };
}
export function createCatalog(store) {
  if (!mongoose.isValidObjectId(store)) throw new ApiError(400, "Invalid store");
  const base = { tenantId: store, isActive: true, deletedAt: null };
  let queries = 0;
  const budget = () => { if (++queries > 18) throw new ApiError(400, "Catalog query limit reached"); };
  const details = async ({ productId }) => {
    if (typeof productId !== "string" || productId.length > 180) throw new ApiError(400, "Invalid product reference");
    budget(); const product = await Product.findOne({ ...base, ...(mongoose.isValidObjectId(productId) ? { _id: productId } : { slug: productId }) }).populate({ path: "category", match: { tenantId: store }, select: "name" }).maxTimeMS(2500).lean();
    return product ? catalogProduct(product) : null;
  };
  const search = async ({ query = "", category = "", maxPrice, limit = 6 } = {}) => {
    if (typeof category !== "string" || category.length > 100 || !Number.isInteger(limit) || limit < 1 || limit > 6 || (maxPrice !== undefined && (typeof maxPrice !== "number" || !Number.isFinite(maxPrice) || maxPrice < 0))) throw new ApiError(400, "Invalid search filters");
    const terms = queryGroups(query);
    if (!terms.length && !category) return [];
    const matches = terms.map(group => new RegExp(group.map(escape).join("|"), "i"));
    const fields = ["name", "title", "description", "shortDescription", "subtitle", "descriptionSections.content", "descriptionSections.items"];
    const filters = [];
    // Categories are tenant-filtered and resolved on the server, never accepted as query objects.
    budget(); const categories = await Category.find({ tenantId: store, name: category ? new RegExp(escape(category), "i") : new RegExp(matches.map(term => term.source).join("|"), "i") }).select("_id name").limit(40).maxTimeMS(2500).lean();
    if (category) filters.push({ category: { $in: categories.map(item => item._id) } });
    for (const expression of matches) filters.push({ $or: [...fields.map(field => ({ [field]: expression })), { category: { $in: categories.filter(item => expression.test(item.name)).map(item => item._id) } }] });
    if (maxPrice !== undefined) filters.push({ $expr: { $lte: [{ $round: [{ $multiply: ["$price", { $subtract: [1, { $divide: ["$discount", 100] }] }] }, 2] }, maxPrice] } });
    budget(); const products = await Product.find({ ...base, ...(filters.length ? { $and: filters } : {}) }).populate({ path: "category", match: { tenantId: store }, select: "name" }).sort({ _id: 1 }).limit(60).maxTimeMS(2500).lean();
    return products.map(product => ({ product, score: matches.reduce((score, term) => score + (term.test(product.name) ? 4 : 1), 0) })).sort((a, b) => b.score - a.score).slice(0, limit).map(({ product }) => catalogProduct(product));
  };
  return {
    searchProducts: search, searchProductsByCategory: search, getProductDetails: details,
    getProductImages: async args => { const product = await details(args); return product ? { id: product.id, images: product.images } : null; },
    getProductUrl: async args => { const product = await details(args); return product ? { id: product.id, url: product.url } : null; },
    getBusinessInformation: async () => { budget(); const business = await Store.findById(store).select("name description shippingFee shippingFees useZoneShippingFees showShippingFees supportEmail").maxTimeMS(2500).lean(); return business ? { name: business.name, description: business.description, shipping: business.showShippingFees ? (business.useZoneShippingFees ? business.shippingFees : business.shippingFee) : null, supportEmail: business.supportEmail, payment: "No verified payment policy configured", deliveryDate: "Requires human verification" } : null; },
  };
}
