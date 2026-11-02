import { ProductFeedback } from "../../../features/feedback/Feedback";
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  TbCash,
  TbChevronRight,
  TbPackage,
  TbShieldCheck,
  TbShoppingBag,
  TbTruckDelivery,
} from "react-icons/tb";
import { request } from "../../../services/api";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCart } from "../../../features/cart/CartProvider";
import { priceOf } from "../../../features/cart/utils/cartStorage";
import { ProductGallery } from "../../../features/store/components/ProductGallery";
import { RelatedProducts } from "../../../features/store/components/RelatedProducts";
import { QueryState, money } from "../../../components/common/QueryState";
import { PageMetadata } from "../../../components/common/PageMetadata";
import LoadingSpinner from "../../../shared/components/LoadingSpinner";

import { trackEvent } from "../../../features/analytics/tracking";
import { productQuery } from '../../../features/store/catalogQueries';

function DescriptionSection({ section }) {
  if (["text", "usage", "ingredients"].includes(section.type))
    return <p>{section.content}</p>;
  if (["bullets", "highlights"].includes(section.type))
    return (
      <ul className={section.type === "highlights" ? "ob-highlight-list" : ""}>
        {section.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  if (section.type === "table")
    return (
      <div className="ob-specification-table">
        {section.rows.map((row, index) => (
          <div key={index}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    );
  if (section.type === "faq")
    return (
      <div className="ob-faq-list">
        {section.rows.map((row, index) => (
          <details key={index}>
            <summary>{row.label}</summary>
            <p>{row.value}</p>
          </details>
        ))}
      </div>
    );
  return null;
}

export default function ProfessionalProductDetails() {
  const { productSlug } = useParams();
  const { storeSlug, store } = useStore();
  const { add } = useCart();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const query = useQuery(productQuery(storeSlug, productSlug));
  const product = query.data;
  const trackedProduct = useRef(null);
  useEffect(() => {
    if (product?._id && trackedProduct.current !== product._id) {
      trackedProduct.current = product._id;
      trackEvent(storeSlug, "product_view", { productId: product._id, page: "product" });
    }
  }, [product?._id, storeSlug]);

  if (query.isPending)
    return (
      <div className="ob-product-loading">
        <LoadingSpinner label="Loading product details..." />
      </div>
    );

  return (
    <div className="shop-container ob-product-page">
      <PageMetadata
        type="product"
        title={
          product
            ? `${product.name} | ${store?.name || storeSlug}`
            : undefined
        }
        description={String(
          product?.shortDescription || product?.description || "",
        ).slice(0, 200)}
        image={product?.images?.[0]?.url}
      />
      <QueryState query={query}>
        {product && (
          <>
            <nav className="ob-product-breadcrumb" aria-label="Breadcrumb">
              <Link to={`/`}>Home</Link>
              <TbChevronRight aria-hidden="true" />
              <Link to={`/products`}>Products</Link>
              <TbChevronRight aria-hidden="true" />
              <span>{product.name}</span>
            </nav>

            <div className="ob-product-main">
              <ProductGallery key={product._id} product={product} />

              <section className="ob-product-summary">
                <p className="ob-product-category">
                  {product.category?.name || "Beauty"}
                </p>
                <h1>{product.title || product.name}</h1>
                {product.subtitle && (
                  <p className="ob-product-subtitle">{product.subtitle}</p>
                )}
                <div className="ob-price-row">
                  <strong>{money(priceOf(product))}</strong>
                  {product.discount > 0 && <del>{money(product.price)}</del>}
                </div>
                <p
                  className={`ob-availability ${product.stock > 0 ? "available" : "unavailable"}`}
                >
                  <span />
                  {product.stock > 0
                    ? (product.showStock === false ? "In stock" : `In stock · ${product.stock} available`)
                    : "Currently out of stock"}
                </p>
                <p className="ob-product-intro">
                  {product.shortDescription ||
                    product.description ||
                    "A carefully selected beauty essential for your everyday routine."}
                </p>

                <div className="ob-purchase-row">
                  <div className="ob-detail-quantity" aria-label="Quantity">
                    <button disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)} aria-label="Decrease quantity">−</button>
                    <span>{quantity}</span>
                    <button disabled={quantity >= product.stock} onClick={() => setQuantity((value) => value + 1)} aria-label="Increase quantity">+</button>
                  </div>
                  <button
                    className="ob-add-button"
                    disabled={product.stock < 1}
                    onClick={() => add(product, quantity)}
                  >
                    <TbShoppingBag aria-hidden="true" />
                    Add to cart
                  </button>
                </div>
                <button
                  className="ob-buy-button"
                  disabled={product.stock < 1}
                  onClick={() => {
                    navigate(`/checkout`, {
                      state: { buyNowItem: { product, quantity } },
                    });
                  }}
                >
                  Buy now
                </button>


                <div className="ob-service-list">
                  <div>
                    <TbTruckDelivery aria-hidden="true" />
                    <span>
                      <strong>Reliable delivery</strong>Nationwide shipping
                    </span>
                  </div>
                  <div>
                    <TbCash aria-hidden="true" />
                    <span>
                      <strong>Cash on delivery</strong>Pay when it arrives
                    </span>
                  </div>
                  <div>
                    <TbShieldCheck aria-hidden="true" />
                    <span>
                      <strong>Authentic products</strong>Carefully selected
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <div className="ob-product-information">
              <section>
                <h2>Product overview</h2>
                <p>
                  {product.description ||
                    product.shortDescription ||
                    "No additional product description is available."}
                </p>
              </section>
              <section>
                <h2>Product information</h2>
                <dl>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category?.name || "Beauty"}</dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>{product.stock > 0 ? "In stock" : "Out of stock"}</dd>
                  </div>
                  <div>
                    <dt>Product code</dt>
                    <dd>{String(product._id).slice(-8).toUpperCase()}</dd>
                  </div>
                  <div>
                    <dt>Store</dt>
                    <dd>{store?.name || "OwnShop"}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>Delivery and payment</h2>
                <ul>
                  <li>
                    <TbPackage aria-hidden="true" />
                    Orders are prepared with protective packaging.
                  </li>
                  <li>
                    <TbTruckDelivery aria-hidden="true" />
                    Delivery time depends on your location.
                  </li>
                  <li>
                    <TbCash aria-hidden="true" />
                    Cash on delivery is available at checkout.
                  </li>
                </ul>
              </section>
            </div>
            {!!product.descriptionSections?.filter((section) => section.enabled)
              .length && (
              <div className="ob-custom-description">
                {product.descriptionSections
                  .filter((section) => section.enabled)
                  .map((section, index) => (
                    <section key={`${section.type}-${index}`}>
                      {section.title && <h2>{section.title}</h2>}
                      <DescriptionSection section={section} />
                    </section>
                  ))}
              </div>
            )}
            <ProductFeedback key={`feedback-${product._id}`} product={product} />
            <RelatedProducts key={product._id} product={product} />
          </>
        )}
      </QueryState>
    </div>
  );
}
