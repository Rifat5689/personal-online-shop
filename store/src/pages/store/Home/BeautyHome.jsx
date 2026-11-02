import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCatalog } from "../../../features/store/hooks/useCatalog";
import { ProductCard } from "../../../features/store/components/ProductCard";
import { QueryState } from "../../../components/common/QueryState";
import LoadingSpinner from "../../../shared/components/LoadingSpinner";
import {
  TbArrowRight,
  TbBottle,
  TbDropletFilled,
  TbHeart,
  TbColorSwatch,
  TbShieldCheck,
  TbSparkles,
  TbPerfume,
  TbTruckDelivery,
  TbUserHeart,
  TbRefresh,
  TbHeadset,
} from "react-icons/tb";

const beautyCategories = [
  ["Skincare", TbDropletFilled],
  ["Makeup", TbColorSwatch],
  ["Fragrance", TbPerfume],
  ["Bodycare", TbHeart],
  ["Tools", TbBottle],
  ["Beauty", TbSparkles],
];

export default function BeautyHome() {
  const { storeSlug, store } = useStore();
  const { products, categories } = useCatalog();
  const isOrigins = storeSlug === "originsofbeauty";
  const categoryIcons = Object.fromEntries(beautyCategories.map(([name, Icon]) => [name.toLowerCase(), Icon]));
  const displayedCategories = (categories.data || []).map(({ name, slug, image }) => [
    name, slug, categoryIcons[slug] || TbSparkles,
    image?.url || products.data?.find(product => product.category?.slug === slug && product.images?.some(photo => photo.url))?.images.find(photo => photo.url)?.url,
  ]);
  const [slide, setSlide] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const allProducts = products.data || [];
  const totalPages = Math.max(1, Math.ceil(allProducts.length / pageSize));
  const currentProducts = allProducts.slice((page - 1) * pageSize, page * pageSize);
  const productsTopRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (productsTopRef.current) {
      productsTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSlide((value) => (value + 1) % 3),
      3500,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <section className="ob-reference-hero" aria-label="Store promotions" aria-roledescription="carousel">
        <h1 className="sr-only">{store.name}</h1>
        {[1, 2, 3].map((banner, index) => (
          <Link className={`ob-reference-banner${slide === index ? " active" : ""}`} key={banner} to={`/products`} aria-hidden={slide !== index} tabIndex={slide === index ? 0 : -1}>
            <img src={`/images/banners/banner${banner}.webp`} alt={["Featured beauty collection", "Skincare favourites and top brand products", "Discover your next beauty favourite"][index]} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "low"} decoding="async" width="1600" height="640" />
          </Link>
        ))}
        <div className="ob-reference-hero-dots">
          {[0, 1, 2].map(index => <button key={index} type="button" className={slide === index ? "active" : ""} onClick={() => setSlide(index)} aria-label={`Show promotion ${index + 1}`} aria-pressed={slide === index} />)}
        </div>
      </section>
      <section className="ob-home-benefits" aria-label="Shopping benefits">
        <div><TbShieldCheck aria-hidden="true" /><span>100%<br />Authentic</span></div>
        <div><TbTruckDelivery aria-hidden="true" /><span>Delivery<br />Nationwide</span></div>
        <div><TbRefresh aria-hidden="true" /><span>Easy<br />Returns</span></div>
        <div><TbHeadset aria-hidden="true" /><span>24/7<br />Support</span></div>
      </section>
      <section className="ob-home-section">
        <div className="ob-section-title">
          <div>
            <span className="ob-kicker">{isOrigins ? "Find your ritual" : "Explore the range"}</span>
            <h2>Shop by category</h2>
          </div>
        </div>
        <div className="ob-categories ob-home-category-slider" aria-label="Shop by category" tabIndex={0}>
          {displayedCategories.map(([name, slug, Icon, image]) => (
            <Link
              key={slug}
              to={`/categories/${slug}`}
            >
              <span className={!image && isOrigins && ["makeup", "fragrance", "bodycare"].includes(slug) ? `ob-category-photo ob-category-photo-${slug}` : ""}>
                {image ? <img src={image} alt="" loading="lazy" /> : isOrigins && slug === "skincare" ? (
                  <img src="/images/skincare-category.webp" alt="" loading="lazy" />
                ) : isOrigins && ["makeup", "fragrance", "bodycare"].includes(slug) ? null : React.createElement(Icon, { "aria-hidden": true })}
              </span>
              <strong>{name}</strong>
            </Link>
          ))}
        </div>
      </section>
      <div
        ref={productsTopRef}
        className="ob-products-anchor"
        style={{ scrollMarginTop: "90px" }}
      />
      <section className="ob-home-section ob-products-section">
        <div className="ob-section-title">
          <div>
            <span className="ob-kicker">{isOrigins ? "Our favourites" : "Featured products"}</span>
            <h2>Curated for you</h2>
            <p>{isOrigins ? "Discover beautiful essentials for every day." : `Discover products from ${store.name}.`}</p>
          </div>
          <Link to={`/products`}>
            View all products <TbArrowRight aria-hidden="true" />
          </Link>
        </div>
        {products.isPending ? (
          <LoadingSpinner label="Loading curated products..." />
        ) : (
          <QueryState query={products} empty={allProducts.length === 0}>
            <div className="product-grid">
              {currentProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination ob-home-pagination">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </QueryState>
        )}
      </section>
      <section className="ob-promise">
        <div>
          <b>
            <TbShieldCheck aria-hidden="true" />
          </b>
          <strong>Authentic products</strong>
          <span>Carefully selected essentials</span>
        </div>
        <div>
          <b>
            <TbUserHeart aria-hidden="true" />
          </b>
          <strong>{isOrigins ? "Beauty with care" : "A thoughtful selection"}</strong>
          <span>{isOrigins ? "Made for your daily ritual" : "Made for everyday discovery"}</span>
        </div>
        <div>
          <b>
            <TbTruckDelivery aria-hidden="true" />
          </b>
          <strong>Delivery nationwide</strong>
          <span>Reliable delivery to your door</span>
        </div>
        <div>
          <b>
            <TbSparkles aria-hidden="true" />
          </b>
          <strong>Here to help</strong>
          <span>Friendly customer support</span>
        </div>
      </section>
    </>
  );
}
