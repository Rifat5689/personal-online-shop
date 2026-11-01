import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TbShoppingBag, TbCheck } from "react-icons/tb";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCart } from "../../cart/CartProvider";
import { priceOf } from "../../cart/utils/cartStorage";
import { money } from "../../../components/common/QueryState";

import { trackEvent } from "../../analytics/tracking";

export function ProductImage({ product, ...props }) {
  const url = product.images?.[0]?.url;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <img src={url} alt={product.name} loading="lazy" onError={() => setFailed(true)} {...props} />
  ) : (
    <div className="image-placeholder" role="img" aria-label={`${product.name}: no image`}>◇</div>
  );
}

export function ProductCard({ product }) {
  const { storeSlug } = useStore();
  const navigate = useNavigate();
  const { add, items } = useCart();
  const inCart = items.some((item) => item.product._id === product._id);
  const detailUrl = `/products/${product.slug}`;

  const handleCardClick = (e) => {
    // If clicked on or inside any button, don't navigate to details
    if (e.target.closest("button")) {
      return;
    }
    trackEvent(storeSlug, "product_click", { productId: product._id });
    navigate(detailUrl);
  };

  return (
    <article
      className="product-card"
      onClick={handleCardClick}
      style={{ cursor: "pointer" }}
    >
      <Link
        className="product-image"
        to={detailUrl}
        onClick={(e) => { e.stopPropagation(); trackEvent(storeSlug, "product_click", { productId: product._id }); }}
      >
        <ProductImage product={product} />
        {product.discount > 0 && <span className="discount">-{product.discount}%</span>}
      </Link>
      <div className="product-info">
        <Link
          to={detailUrl}
          onClick={(e) => { e.stopPropagation(); trackEvent(storeSlug, "product_click", { productId: product._id }); }}
        >
          <h3>{product.name}</h3>
        </Link>
        <p className="muted">{product.stock > 0 ? "Available" : "Sold out"}</p>
        <div className="ob-card-bottom">
          <span>
            <strong>{money(priceOf(product))}</strong>
            {product.discount > 0 && <del>{money(product.price)}</del>}
          </span>
          <button
            type="button"
            className={`btn-primary${inCart ? " product-in-cart" : ""}`}
            title={inCart ? "In your cart · Add another" : "Add to cart"}
            disabled={product.stock < 1}
            onClick={(e) => {
              e.stopPropagation();
              add(product);
            }}
            aria-label={`Add ${product.name} to cart`}
          >
            {inCart ? <TbCheck aria-hidden="true" /> : <TbShoppingBag aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
}
