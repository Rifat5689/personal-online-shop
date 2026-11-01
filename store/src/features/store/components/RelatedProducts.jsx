import React, { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { request } from "../../../services/api";
import { useStore } from "../../../application/providers/StoreProvider";
import { ProductCard } from "./ProductCard";

export function RelatedProducts({ product }) {
  const { storeSlug } = useStore();
  const id = useId();
  const row = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const query = useQuery({ queryKey: ["relatedProducts", storeSlug, product._id], queryFn: () => request("get", `/products/store/${encodeURIComponent(storeSlug)}/${encodeURIComponent(product.slug)}/related`), staleTime: 60000 });
  const products = query.data || [];
  const measure = () => {
    const el = row.current;
    if (el) setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, [products.length]);
  if (!products.length) return null;
  const move = (direction) => row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  return <section className="ob-related-products" aria-labelledby={`${id}-title`}>
    <div className="ob-related-heading"><h2 id={`${id}-title`}>You may also like</h2>
      <div className="ob-related-controls">
        <button type="button" aria-label="Previous related products" aria-controls={id} disabled={edges.start} onClick={() => move(-1)}><TbChevronLeft aria-hidden="true" /></button>
        <button type="button" aria-label="Next related products" aria-controls={id} disabled={edges.end} onClick={() => move(1)}><TbChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    <div id={id} ref={row} className="ob-related-row" tabIndex={0} aria-label="Related products" onScroll={measure}>
      {products.slice(0, 10).map((item) => <ProductCard key={item._id} product={item} />)}
    </div>
  </section>;
}
