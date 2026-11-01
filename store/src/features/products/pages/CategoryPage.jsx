import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { TbBrush, TbDroplet, TbGridDots, TbPalette, TbSearch, TbSparkles, TbSpray } from "react-icons/tb";
import { useProducts } from "../hooks/useProducts";
import { SIDEBAR_CATEGORIES } from "../constants/categories";
import ProductCard from "../components/ProductCard";
import { LoadingSpinner } from "@/shared";
const CategoryIcon = ({
  icon,
  className
}) => {
  const IconMap = {
    grid: TbGridDots,
    sparkle: TbSparkles,
    droplet: TbDroplet,
    palette: TbPalette,
    spray: TbSpray,
    brush: TbBrush
  };
  const Icon = IconMap[icon];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
};
const CategoryPage = () => {
  const {
    t
  } = usePageTranslation();
  const {
    category
  } = useParams();
  const {
    searchQuery,
    setSearchQuery
  } = useOutletContext() || {};
  const slug = (category || "all").toLowerCase();
  const [page, setPage] = useState(1);
  const [fading, setFading] = useState(false);
  const gridRef = useRef(null);
  const pageSize = 6;
  const {
    products,
    isLoading,
    isError
  } = useProducts();
  const categoryFiltered = useMemo(() => slug === "all" ? products : products.filter(p => (p?.category || "").toLowerCase() === slug), [slug, products]);
  const filtered = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.trim().toLowerCase();
    return categoryFiltered.filter(p => (p?.title || p?.name || "").toLowerCase().includes(q));
  }, [categoryFiltered, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const triggerFade = () => {
    setFading(true);
    setTimeout(() => setFading(false), 1000);
  };
  const resetPage = () => {
    setPage(1);
    triggerFade();
  };
  const goToPage = p => {
    if (p < 1 || p > totalPages) return;
    triggerFade();
    setPage(p);
  };
  const scrollToGrid = () => {
    const el = gridRef.current;
    if (el) el.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  useEffect(() => {
    if (!fading && !isLoading) scrollToGrid();
  }, [fading, isLoading, page]);
  return <div className="bg-[#f7f5fb]">
      <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block self-start rounded-2xl border border-[#5a1f7a]/10 bg-white p-2 shadow-sm sm:rounded-3xl sm:p-5 sticky top-4 h-fit">
            <h2 className="text-lg font-semibold text-[#1b1a4a]">{t("All Categories")}</h2>
            <div className="mt-4 space-y-3">
              {SIDEBAR_CATEGORIES.map(cat => {
              const isActive = slug === cat.slug;
              const href = `/category/${cat.slug}`;
              return <Link key={cat.slug} to={href} onClick={resetPage} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1 text-[10px] font-semibold transition sm:rounded-full sm:px-4 sm:py-2 sm:text-sm ${isActive ? "bg-[#5a1f7a] text-white" : "bg-[#f1ecf8] text-[#1b1a4a] hover:bg-[#e6def4]"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${isActive ? "bg-white/15" : "bg-white"}`}>
                      <CategoryIcon icon={cat.icon} className="h-3 w-3 sm:h-4 sm:w-4" />
                    </span>
                    <span className="truncate">{t(cat.label)}</span>
                  </Link>;
            })}
            </div>
          </aside>

          {/* Main Content */}
          <div className="space-y-4 min-w-0">
            {/* Sticky filters / search */}
            <div className="sticky top-16 z-40 bg-[#f7f5fb] pb-3 pt-2.5">
              {/* Mobile category pills */}
              <div className="md:hidden">
                <div className="no-scrollbar flex items-center gap-3 overflow-x-auto scroll-smooth pb-2 pt-2">
                  {SIDEBAR_CATEGORIES.map(cat => {
                  const isActive = slug === cat.slug;
                  const href = `/category/${cat.slug}`;
                  return <Link key={cat.slug} to={href} onClick={resetPage} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${isActive ? "bg-[#c04b78] text-white" : "bg-white text-[#6e3d57] ring-1 ring-[#f0cfe0] hover:text-[#c04b78]"}`}>
                        {t(cat.label)}
                      </Link>;
                })}
                </div>
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-3 rounded-full border border-[#f0cfe0] bg-white px-4 py-2 text-sm text-[#2a1b2e] shadow-sm">
                <TbSearch className="h-4 w-4 text-[#c04b78]" aria-hidden="true" />
                <input type="search" value={searchQuery || ""} onChange={e => {
                setSearchQuery?.(e.target.value);
                setPage(1);
                triggerFade();
              }} placeholder={t("Search in this category...")} className="w-full bg-transparent text-sm outline-none placeholder:text-[#c04b78]/60" aria-label={t("Search category products")} />
              </div>
            </div>

            {/* Loading / Error / Empty */}
            {(isLoading || fading) && <LoadingSpinner label="Loading curated products..." />}

            {isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">{t("Something went wrong while loading products.")}</div>}

            {!isLoading && !fading && !isError && filtered.length === 0 && <div className="rounded-2xl border border-dashed border-[#5a1f7a]/20 bg-white p-8 text-center text-sm text-gray-500">{t("No products found in this category.")}</div>}

            {/* Product Grid */}
            {!isLoading && !fading && !isError && <div ref={gridRef} className="columns-2 gap-2 sm:columns-2 md:grid md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-3">
                {visible.map((product, idx) => <ProductCard key={product?.id ?? `${product?.title ?? "product"}-${idx}`} product={product} showAddToCart />)}
              </div>}

            {/* Pagination */}
            {!isLoading && !fading && !isError && totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-[#5a1f7a]/10 bg-white px-4 py-3 text-sm text-[#1b1a4a] shadow-sm">
                <span className="text-xs text-gray-500">{t("Page ")}{page}{t(" of ")}{totalPages}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => goToPage(page - 1)} className="rounded-full border border-[#5a1f7a]/20 px-3 py-1 text-xs font-semibold text-[#1b1a4a] hover:bg-[#5a1f7a]/10" disabled={page === 1}>{t("Previous")}</button>
                  {Array.from({
                length: totalPages
              }, (_, i) => i + 1).map(p => <button key={p} type="button" onClick={() => goToPage(p)} className={`h-8 w-8 rounded-full text-xs font-semibold ${p === page ? "bg-[#5a1f7a] text-white" : "border border-[#5a1f7a]/20 text-[#1b1a4a] hover:bg-[#5a1f7a]/10"}`}>
                        {p}
                      </button>)}
                  <button type="button" onClick={() => goToPage(page + 1)} className="rounded-full border border-[#5a1f7a]/20 px-3 py-1 text-xs font-semibold text-[#1b1a4a] hover:bg-[#5a1f7a]/10" disabled={page === totalPages}>{t("Next")}</button>
                </div>
              </div>}
          </div>
        </div>
      </section>
    </div>;
};
export default CategoryPage;
