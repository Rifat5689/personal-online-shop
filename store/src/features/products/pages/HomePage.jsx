import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BANNERS, HOME_CATEGORIES } from "../constants/categories";
import PaginatedProducts from "../components/PaginatedProducts";
const HomePage = () => {
  const {
    t
  } = usePageTranslation();
  const {
    searchQuery
  } = useOutletContext() || {};
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % BANNERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return <div className="bg-[#f7f5fb]">
      {/* Banner Slider */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-4 md:pt-10 md:pb-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#5a1f7a]/10 bg-white shadow-sm">
          <div className="relative h-44 sm:h-56 md:h-72 lg:h-80">
            {BANNERS.map((src, idx) => {
            const isActive = idx === activeSlide;
            return <div key={src} className={`absolute inset-0 transition-all duration-700 ease-out ${isActive ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-6 scale-[1.03]"}`}>
                  <img src={src} alt={`Promotional banner ${idx + 1}`} className="h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/30" />
                </div>;
          })}
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/80 px-3 py-1 backdrop-blur">
            {BANNERS.map((_, idx) => <button key={`dot-${idx}`} type="button" onClick={() => setActiveSlide(idx)} className={`h-2 w-2 rounded-full transition ${idx === activeSlide ? "bg-[#5a1f7a]" : "bg-[#5a1f7a]/30"}`} aria-label={`Go to banner ${idx + 1}`} />)}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="mx-auto max-w-7xl px-4 pt-6 pb-10 md:pt-8 md:pb-12">
        {/* Mobile Categories */}
        <div className="mb-8 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[0.08em] text-[#2a1b2e] sm:text-xl">{t("All Categories")}</h2>
            <Link to="/category/all" className="text-xs font-semibold text-[#c04b78] hover:text-[#b3416e]">{t("View all")}</Link>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 pr-2 scroll-smooth md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0 md:pr-0">
            {HOME_CATEGORIES.map(cat => <Link key={cat.name} to={`/category/${encodeURIComponent(cat.name.toLowerCase())}`} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-[11px] font-medium text-[#4b2d54] transition hover:text-[#c04b78] md:w-auto md:shrink">
                <span className={`flex h-14 w-14 items-center justify-center rounded-xl ${cat.bg} shadow-sm ring-1 ring-white/70 transition group-hover:-translate-y-0.5`}>
                  <img src={cat.icon} alt="" className="h-7 w-7" loading="lazy" />
                </span>
                <span className="text-center leading-tight">{cat.name}</span>
              </Link>)}
          </div>
        </div>

        {/* Collection Header */}
        <div id="all-products-heading" className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5a1f7a]">{t("Collection")}</p>
            <h2 className="mt-2 text-2xl font-bold text-[#1b1a4a] md:text-3xl">{t("All Products")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("Browse 5 items per page with fast, smooth pagination.")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#5a1f7a]/20 bg-white px-4 py-2 text-xs font-semibold text-[#1b1a4a] shadow-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />{t("Updated daily")}</div>
        </div>

        <div id="product-grid-top" />
        <PaginatedProducts pageSize={6} searchQuery={searchQuery} />
      </section>
    </div>;
};
export default HomePage;
