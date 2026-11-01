import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useContext } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "@/features/cart/context/CartContextValue";
const ProductCard = ({
  product,
  showAddToCart = false
}) => {
  const {
    t
  } = usePageTranslation();
  const {
    addItem
  } = useContext(CartContext);
  const {
    title,
    name,
    price,
    discountPercent,
    image,
    thumbnail,
    category,
    id,
    stock,
    inStock
  } = product || {};
  const displayName = title || name || "Untitled product";
  const imgSrc = image || thumbnail || "/react.svg";
  const isInStock = typeof inStock === "boolean" ? inStock : typeof stock === "number" ? stock > 0 : typeof stock === "boolean" ? stock : (id ?? 1) % 4 !== 0;
  const formattedPrice = typeof price === "number" ? new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0
  }).format(price) : price || "0";
  const safePrice = Number(price) || 0;
  const safeDiscount = Math.max(0, Math.min(95, Number(discountPercent) || 0));
  const discountedPrice = Math.round(safePrice * (1 - safeDiscount / 100));
  const hasDiscount = safeDiscount > 0;
  const formattedDiscountedPrice = new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0
  }).format(discountedPrice);
  const href = `/productDetails/${id ?? ""}`;
  return <Link to={href} className="group mb-2 flex flex-col break-inside-avoid overflow-hidden rounded-lg border border-[#f0cfe0] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg" aria-label={`View details for ${displayName}`}>
      <div className="relative overflow-hidden bg-[#fdf2f7]">
        <img src={imgSrc} alt={displayName} className="min-h-[9rem] max-h-[12rem] w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        {!isInStock && <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-2 text-center">
            <span className="rounded-md bg-[#A32D2D] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">{t("Stock Out")}</span>
          </div>}
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c04b78]">
          {category || "Featured"}
        </span>
        {hasDiscount && <span className="absolute right-3 top-3 rounded-md bg-[#3B6D11] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
            -{safeDiscount}%
          </span>}
      </div>
      <div className="flex flex-col gap-1.5 px-3 pt-3 pb-1">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-[#2a1b2e] line-clamp-2">
            {displayName}
          </h3>
          <p className={`text-xs font-semibold ${isInStock ? "text-emerald-600" : "text-rose-600"}`}>
            {t(isInStock ? "In Stock" : "Out of Stock")}
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-lg font-bold text-[#c04b78]">
            <span className="relative -top-0.5">
              {t(hasDiscount ? formattedDiscountedPrice : formattedPrice)}
            </span>
            <span className="relative -top-1 text-xs font-extrabold leading-none">৳</span>
            {hasDiscount && <span className="text-xs font-semibold text-[#A32D2D] line-through">
                {formattedPrice} ৳
              </span>}
          </div>
          {showAddToCart && <button type="button" onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          addItem?.(product);
        }} className="block w-full rounded-md bg-[#c04b78] px-2.5 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#a93f68]">{t("Add to Cart")}</button>}
        </div>
      </div>
    </Link>;
};
export default ProductCard;
