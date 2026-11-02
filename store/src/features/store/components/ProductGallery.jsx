import React, { useEffect, useState } from "react";
import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { ProductImage } from "./ProductCard";

function GallerySlide({ image, name, active, index }) {
  const [status, setStatus] = useState("loading");
  return (
    <div className={`ob-gallery-slide${active ? " active" : ""}`} aria-hidden={!active}>
      {status === "loading" && active && <span className="ob-gallery-loading" role="status"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading product photo</span></span>}
      {status === "error" ? <div className="image-placeholder">Photo unavailable</div> : (
        <img src={image.url} alt={active ? `${name}, photo ${index + 1}` : ""} loading={active ? "eager" : "lazy"} fetchPriority={active ? "high" : "low"} decoding="async" width="800" height="800" onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} />
      )}
    </div>
  );
}

export function ProductGallery({ product }) {
  const images = (product.images || []).filter((image) => image.url);
  const [index, setIndex] = useState(0);
  const activeIndex = Math.min(index, Math.max(0, images.length - 1));
  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [images.length]);
  const select = (next) => {
    setIndex((next + images.length) % images.length);
  };
  return (
    <section className="ob-gallery" aria-label="Product images" aria-roledescription={images.length > 1 ? "carousel" : undefined}>
      <div className="ob-main-image">
        {images.length ? images.map((image, itemIndex) => <GallerySlide key={`${image.url}-${itemIndex}`} image={image} name={product.name} active={activeIndex === itemIndex} index={itemIndex} />) : <ProductImage product={{ ...product, images: [] }} />}
        {product.discount > 0 && <span className="ob-detail-discount">Save {product.discount}%</span>}
        {images.length > 1 && <>
          <button type="button" className="ob-gallery-arrow previous" aria-label="Previous product photo" onClick={() => select(activeIndex - 1)}><TbChevronLeft aria-hidden="true" /></button>
          <button type="button" className="ob-gallery-arrow next" aria-label="Next product photo" onClick={() => select(activeIndex + 1)}><TbChevronRight aria-hidden="true" /></button>
          <span className="ob-gallery-count" aria-live="off">{activeIndex + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && <>
        <div className="ob-thumbnails" aria-label="Choose a product photo">
          {images.map((image, itemIndex) => <button type="button" className={activeIndex === itemIndex ? "active" : ""} key={`${image.url}-${itemIndex}`} onClick={() => select(itemIndex)} aria-label={`View image ${itemIndex + 1}`} aria-pressed={activeIndex === itemIndex}><img src={image.url} alt="" loading="lazy" /></button>)}
        </div>
      </>}
    </section>
  );
}
