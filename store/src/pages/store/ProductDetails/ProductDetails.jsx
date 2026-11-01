import { ProductFeedback } from "../../../features/feedback/Feedback";
import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request } from "../../../services/api";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCart } from "../../../features/cart/CartProvider";
import { priceOf } from "../../../features/cart/utils/cartStorage";
import { ProductImage } from "../../../features/store/components/ProductCard";
import { QueryState, money } from "../../../components/common/QueryState";
import { PageMetadata } from "../../../components/common/PageMetadata";
export default function ProductDetails() {
  const { productSlug } = useParams();
  const { storeSlug, store } = useStore();
  const { add, toggleWishlist, wishlist } = useCart();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const query = useQuery({
    queryKey: ["product", storeSlug, productSlug],
    queryFn: () =>
      request("get", `/products/store/${storeSlug}/${productSlug}`),
  });
  const product = query.data;
  return (
    <div className="shop-container">
      <PageMetadata title={product ? `${product.title || product.name} | ${store?.name || storeSlug}` : undefined} description={String(product?.shortDescription || product?.description || "").slice(0, 200)} image={product?.images?.[0]?.url} />
      <p className="breadcrumb">
        <Link to={`/products`}>Products</Link> / {product?.name}
      </p>
      <QueryState query={query}>
        {product && (
          <>
            <div className="product-detail">
              <div>
                <div className="detail-image">
                  <ProductImage
                    product={{
                      ...product,
                      images: product.images?.[imageIndex]
                        ? [product.images[imageIndex]]
                        : product.images,
                    }}
                  />
                </div>
                <div className="thumbnails">
                  {product.images?.map((image, i) => (
                    <button
                      key={image.url}
                      onClick={() => setImageIndex(i)}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={image.url} alt="" />
                    </button>
                  ))}
                </div>
              </div>
              <section>
                <h1>{product.name}</h1>
                <p className="muted">{product.category?.name}</p>
                <h2>
                  {money(priceOf(product))}{" "}
                  {product.discount > 0 && <del>{money(product.price)}</del>}
                </h2>
                <p className="stock-label">
                  {product.stock > 0
                    ? (product.showStock === false ? "In stock" : `${product.stock} in stock`)
                    : "Out of stock"}
                </p>
                <p>{product.shortDescription || product.description}</p>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max={product.stock}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Math.max(
                          1,
                          Math.min(
                            product.stock,
                            Number(event.target.value) || 1,
                          ),
                        ),
                      )
                    }
                  />
                </label>
                <div className="row">
                  <button
                    className="btn-primary"
                    disabled={product.stock < 1}
                    onClick={() => add(product, quantity)}
                  >
                    Add to Cart
                  </button>
                  <button
                    className="btn-dark"
                    disabled={product.stock < 1}
                    onClick={() => {
                      add(product, quantity);
                      navigate(`/checkout`);
                    }}
                  >
                    Buy Now
                  </button>
                </div>
                <button
                  className="text-button"
                  aria-pressed={wishlist.some(
                    (item) => item._id === product._id,
                  )}
                  onClick={() => toggleWishlist(product)}
                >
                  ♡{" "}
                  {wishlist.some((item) => item._id === product._id)
                    ? "Remove from Wishlist"
                    : "Add to Wishlist"}
                </button>
              </section>
            </div>
            <ProductFeedback key={product._id} product={product} />
            <section className="card description">
              <h2>Description</h2>
              <p>
                {product.description || "No additional description available."}
              </p>
            </section>
          </>
        )}
      </QueryState>
    </div>
  );
}
