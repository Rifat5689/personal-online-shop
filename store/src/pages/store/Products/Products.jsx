import React, { useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useCatalog } from "../../../features/store/hooks/useCatalog";
import { ProductCard } from "../../../features/store/components/ProductCard";
import { QueryState } from "../../../components/common/QueryState";
import { priceOf } from "../../../features/cart/utils/cartStorage";
import { TbSearch, TbArrowsSort } from "react-icons/tb";
export default function Products() {
  const { products, categories, storeSlug } = useCatalog();
  const { categorySlug } = useParams();
  const [params, setParams] = useSearchParams();
  const gridTopRef = useRef(null);
  const hasMounted = useRef(false);
  const change = (key, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
  const search = params.get("q") || "";
  const category = categorySlug || params.get("category") || "";
  const sort = params.get("sort") || "newest";
  const filtered = (products.data || []).filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) &&
      (!category || product.category?.slug === category),
  );
  if (sort === "price-low") filtered.sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === "price-high") filtered.sort((a, b) => priceOf(b) - priceOf(a));
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  const page = Math.max(
    1,
    Math.min(
      Math.ceil(filtered.length / 12) || 1,
      Number(params.get("page")) || 1,
    ),
  );
  useEffect(() => {
    if (hasMounted.current) gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else hasMounted.current = true;
  }, [page]);
  return (
    <div className="shop-container ob-products-page">
      <p className="breadcrumb">
        <Link to={`/`}>Home</Link> / Products
      </p>
      <div className="section-heading">
        <h1>
          {category
            ? categories.data?.find((item) => item.slug === category)?.name ||
              "Category Products"
            : "All Products"}
        </h1>
        <span>{filtered.length} products</span>
      </div>
      <div className="ob-category-pills" aria-label="Product categories">
        <Link className={!category ? "active" : ""} to={`/products`}>All</Link>
        {categories.data?.map((item) => <Link className={category === item.slug ? "active" : ""} key={item._id} to={`/categories/${item.slug}`}>{item.name}</Link>)}
      </div>
      <div className="filters shop-product-filters">
        <label className="shop-product-search">
          <span className="sr-only">Search products</span>
          <TbSearch aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => change("q", event.target.value)}
            placeholder="Find something you love…"
          />
        </label>
        <label className="shop-product-sort">
          <span className="sr-only">Sort by</span>
          <TbArrowsSort aria-hidden="true" />
          <select
            value={sort}
            onChange={(event) => change("sort", event.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="price-low">Price ↑</option>
            <option value="price-high">Price ↓</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>
      <div ref={gridTopRef} className="ob-product-grid-top" />
      <QueryState query={products} empty={!filtered.length}>
        <div className="product-grid store-results-transition" key={`${category}-${sort}-${page}`}>
          {filtered.slice((page - 1) * 12, page * 12).map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </QueryState>
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("page", page - 1);
              return next;
            })
          }
        >
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(filtered.length / 12))}
        </span>
        <button
          disabled={page * 12 >= filtered.length}
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("page", page + 1);
              return next;
            })
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}
