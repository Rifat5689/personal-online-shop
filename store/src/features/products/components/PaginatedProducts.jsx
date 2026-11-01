import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useState, useEffect, useRef, useMemo } from "react";
import { useProducts } from "../hooks/useProducts";
import ProductCard from "./ProductCard";
import { LoadingSpinner } from "@/shared";
const PaginatedProducts = ({
  pageSize = 5,
  searchQuery = "",
  gridClassName = "columns-2 gap-2 sm:columns-2 md:grid md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-3"
}) => {
  const {
    t
  } = usePageTranslation();
  const [page, setPage] = useState(1);
  const {
    products,
    isLoading,
    isError
  } = useProducts();
  const [fading, setFading] = useState(false);
  const gridRef = useRef(null);
  const scrollRequestedRef = useRef(false);
  const query = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => query ? products.filter(p => (p?.title || p?.name || "").toLowerCase().includes(query)) : products, [products, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, pageSize, filtered]);
  const goToPage = p => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    scrollRequestedRef.current = true;
    setFading(true);
    window.setTimeout(() => setFading(false), 250);
  };

  // Scroll to grid after navigation completes.
  useEffect(() => {
    if (fading || isLoading || !scrollRequestedRef.current) return;
    const el = document.getElementById("all-products-heading") || gridRef.current || document.getElementById("product-grid-top") || document.getElementById("products");
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      scrollRequestedRef.current = false;
    }, 120);
    return () => window.clearTimeout(t);
  }, [fading, isLoading, visible.length]);
  if (isLoading || fading) return <LoadingSpinner label="Loading products..." />;
  if (isError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">{t("Something went wrong while loading products.")}</div>;
  if (!products.length) return <div className="rounded-2xl border border-dashed border-[#5a1f7a]/20 bg-white p-8 text-center text-sm text-gray-500">{t("No products found.")}</div>;
  if (!filtered.length) return <div className="rounded-2xl border border-dashed border-[#5a1f7a]/20 bg-white p-8 text-center text-sm text-gray-500">{t("No products found for \" ")}{searchQuery}&quot;.
      </div>;
  return <div className="space-y-8">
      <div ref={gridRef} className={gridClassName}>
        {visible.map((product, idx) => <ProductCard key={product?.id ?? `${product?.title ?? "product"}-${idx}`} product={product} />)}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-[#5a1f7a]/10 bg-white px-4 py-3 text-sm text-[#1b1a4a] shadow-sm">
        <span className="text-xs text-gray-500">{t("Page ")}{currentPage}{t(" of ")}{totalPages}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => goToPage(currentPage - 1)} className="rounded-full border border-[#5a1f7a]/20 px-3 py-1 text-xs font-semibold text-[#1b1a4a] hover:bg-[#5a1f7a]/10" disabled={currentPage === 1}>{t("Previous")}</button>
          {Array.from({
          length: totalPages
        }, (_, i) => i + 1).map(p => <button key={p} type="button" onClick={() => goToPage(p)} className={`h-8 w-8 rounded-full text-xs font-semibold ${p === currentPage ? "bg-[#5a1f7a] text-white" : "border border-[#5a1f7a]/20 text-[#1b1a4a] hover:bg-[#5a1f7a]/10"}`}>
              {p}
            </button>)}
          <button type="button" onClick={() => goToPage(currentPage + 1)} className="rounded-full border border-[#5a1f7a]/20 px-3 py-1 text-xs font-semibold text-[#1b1a4a] hover:bg-[#5a1f7a]/10" disabled={currentPage === totalPages}>{t("Next")}</button>
        </div>
      </div>
    </div>;
};
export default PaginatedProducts;
