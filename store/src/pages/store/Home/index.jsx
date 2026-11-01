import React from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCatalog } from "../../../features/store/hooks/useCatalog";
import {
  ProductCard,
  ProductImage,
} from "../../../features/store/components/ProductCard";
import { QueryState } from "../../../components/common/QueryState";
export default function Home() {
  const { store, storeSlug } = useStore();
  const { products } = useCatalog();
  const featured = products.data?.find((product) => product.images?.length);
  return (
    <div className="shop-container">
      <section className="shop-hero">
        <div>
          <span className="eyebrow">New Collection</span>
          <h1>
            Better Products
            <br />
            For A Brighter You
          </h1>
          <p>
            {store.description ||
              "Discover quality products and find your next favourite."}
          </p>
          <Link className="btn-primary" to={`/products`}>
            Shop Now →
          </Link>
        </div>
        <div className="hero-product">
          {featured ? (
            <ProductImage product={featured} />
          ) : (
            <span aria-hidden="true">◉</span>
          )}
        </div>
      </section>
      <section className="benefits" aria-label="Shopping benefits">
        <div>
          ♧ <strong>Reliable Delivery</strong>
          <small>Delivered to your door</small>
        </div>
        <div>
          ▣ <strong>Cash on Delivery</strong>
          <small>Pay when your order arrives</small>
        </div>
        <div>
          ♧ <strong>Need Help?</strong>
          <small>{store.supportEmail || "Contact your store"}</small>
        </div>
        <div>
          ◇ <strong>Quality Products</strong>
          <small>Selected by your merchant</small>
        </div>
      </section>
      <div className="section-heading">
        <h2>Featured Products</h2>
        <Link to={`/products`}>View All →</Link>
      </div>
      <QueryState query={products} empty={products.data?.length === 0}>
        <div className="product-grid">
          {products.data?.slice(0, 8).map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}
