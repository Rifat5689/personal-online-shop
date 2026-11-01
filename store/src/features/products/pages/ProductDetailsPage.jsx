import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useContext, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CartContext } from "@/features/cart/context/CartContextValue";
import { useProducts } from "../hooks/useProducts";
import { LoadingSpinner } from "@/shared";
const ProductDetailsPage = () => {
  const {
    t
  } = usePageTranslation();
  const {
    addItem
  } = useContext(CartContext);
  const navigate = useNavigate();
  const {
    id
  } = useParams();
  const {
    products,
    isLoading,
    isError
  } = useProducts();
  const product = useMemo(() => {
    const numId = Number(id);
    return products.find(p => Number(p?.id) === numId);
  }, [products, id]);
  if (isLoading) return <LoadingSpinner label="Loading product details..." />;
  if (isError || !product) return <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-3xl border border-rose-100 bg-white p-10 text-center text-sm text-rose-600 shadow-sm">{t("We couldn't find that product.")}</div>
      </div>;
  const {
    title,
    name,
    price,
    discountPercent,
    image,
    thumbnail,
    category,
    rating,
    stock,
    inStock
  } = product || {};
  const displayName = title || name || "Untitled product";
  const imgSrc = image || thumbnail || "/react.svg";
  const isInStock = typeof inStock === "boolean" ? inStock : typeof stock === "number" ? stock > 0 : typeof stock === "boolean" ? stock : (product?.id ?? 1) % 4 !== 0;
  const safePrice = Number(price) || 0;
  const safeDiscount = Math.max(0, Math.min(95, Number(discountPercent) || 0));
  const discountedPrice = Math.round(safePrice * (1 - safeDiscount / 100));
  const hasDiscount = safeDiscount > 0;
  const formattedPrice = `Tk ${new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0
  }).format(discountedPrice || safePrice)}`;
  const originalPrice = `Tk ${new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0
  }).format(safePrice)}`;
  return <div className="bg-[#f7f5fb] pb-24">
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Image */}
          <div className="relative overflow-hidden rounded-3xl border border-[#f0cfe0] bg-white shadow-sm">
            <img src={imgSrc} alt={displayName} className="h-80 w-full object-cover sm:h-105" />
            {!isInStock && <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-lg bg-[#A32D2D] px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white">{t("Stock Out")}</span>
              </div>}
            <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#c04b78]">
              {category || "Featured"}
            </div>
            <div className={`absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold ${isInStock ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {t(isInStock ? "In Stock" : "Out of Stock")}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c04b78]">{t("OriginsBd Essentials")}</p>
              <h1 className="text-2xl font-bold text-[#2a1b2e] md:text-3xl">
                {displayName}
              </h1>
              <p className="text-sm text-[#6e3d57]">
                {t(rating ? `Rating ${rating} · Loved by our community` : "Loved by our community")}
              </p>
            </div>

            {/* Pricing Card */}
            <div className="rounded-2xl border border-[#f0cfe0] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#c04b78]">{t("Special price")}</p>
                  <p className="mt-2 text-3xl font-bold text-[#c04b78]">
                    {formattedPrice}
                  </p>
                  {hasDiscount && <p className="mt-1 text-sm font-semibold text-[#A32D2D] line-through">
                      {originalPrice} ({safeDiscount}{t("% off)")}</p>}
                </div>
                <div className="rounded-2xl bg-[#fdf2f7] px-4 py-3 text-xs text-[#6e3d57]">{t("Free delivery in Dhaka · Easy returns")}</div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[#2a1b2e]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#c04b78]" />{t("Verified seller · Authentic beauty essentials")}</div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#c04b78]" />{t("Cash on delivery available")}</div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#c04b78]" />{t("Secure payment options")}</div>
              </div>
            </div>

            {/* Highlights */}
            <div className="rounded-2xl border border-[#f0cfe0] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#2a1b2e]">{t("Product highlights")}</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#6e3d57]">
                <li>{t("Silky texture, lightweight feel, everyday-ready.")}</li>
                <li>{t("Dermatologist tested for sensitive skin.")}</li>
                <li>{t("Pairs beautifully with your daily routine.")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Fixed Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#f0cfe0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#c04b78]">{t("Total")}</p>
            <p className="text-xl font-bold text-[#2a1b2e]">
              {formattedPrice}
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => addItem?.(product)} className="flex-1 rounded-full border border-[#c04b78]/40 px-4 py-2 text-sm font-semibold text-[#c04b78] hover:bg-[#fdf2f7] md:flex-none md:min-w-40">{t("Add to Cart")}</button>
            <button type="button" className="flex-1 rounded-full bg-[#c04b78] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b3416e] md:flex-none md:min-w-40" onClick={() => {
            addItem?.(product);
            navigate("/billing", {
              state: {
                fromCart: false,
                directItem: product
              }
            });
          }}>{t("Buy Now")}</button>
          </div>
        </div>
      </div>
    </div>;
};
export default ProductDetailsPage;
