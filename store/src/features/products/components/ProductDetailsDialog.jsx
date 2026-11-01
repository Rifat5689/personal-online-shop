import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TbBox, TbX, TbEdit } from "react-icons/tb";
import { money } from "../../../components/common/QueryState";
export function ProductDetailsDialog({
  product,
  base,
  onClose,
  children
}) {
  const {
    t
  } = usePageTranslation();
  const dialog = useRef(null);
  const titleId = useId();
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    dialog.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const discount = Number(product.discount || 0);
  const price = Math.round(product.price * (1 - discount / 100) * 100) / 100;
  const sections = (product.descriptionSections || []).filter(section => section.enabled !== false);
  return <dialog ref={dialog} className="order-details-dialog product-details-dialog" aria-labelledby={titleId} onClose={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.current.close();
  }}>
      <header className="order-details-header">
        <span className="order-details-heading-icon">
          <TbBox aria-hidden="true" />
        </span>
        <div>
          <h2 id={titleId}>{t("Product details")}</h2>
          <p>{t("Product overview")}</p>
        </div>
        <button type="button" className="order-actions-close" aria-label={t("Close product details")} autoFocus onClick={() => dialog.current.close()}>
          <TbX aria-hidden="true" />
        </button>
      </header>
      <div className="order-details-body">
        <div className="product-details-overview">
          <div className="product-details-gallery">
            {t(product.images?.length ? <>
                <img className="product-details-photo" src={product.images[imageIndex]?.url || product.images[0].url} alt={product.name} />
                {product.images.length > 1 && <div className="product-details-thumbnails">
                    {product.images.map((image, index) => <button type="button" key={image.public_id || image.url} aria-label={`Product image ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}>
                        <img src={image.url} alt="" />
                      </button>)}
                  </div>}
              </> : <div className="product-details-no-image">
                <TbBox aria-hidden="true" />
                <span>{t("No product image")}</span>
              </div>)}
          </div>
          <div className="product-details-summary">
            <span className={`products-publication ${product.isActive ? "published" : "draft"}`}>
              <i aria-hidden="true" />
              {t(product.isActive ? "Published" : "Draft")}
            </span>
            <h3>{product.name}</h3>
            {product.title && product.title !== product.name && <p>{product.title}</p>}
            {product.subtitle && <p>{product.subtitle}</p>}
            <div className="product-details-price">
              <strong>{money(price)}</strong>
              {discount > 0 && <>
                  <del>{money(product.price)}</del>
                  <span>{discount}{t("% off")}</span>
                </>}
            </div>
            <dl>
              <div>
                <dt>{t("Category")}</dt>
                <dd>{product.category?.name || "Uncategorised"}</dd>
              </div>
              <div>
                <dt>{t("Stock")}</dt>
                <dd>
                  {product.stock}{" "}
                  {t(product.stock > 0 ? "available" : "— out of stock")}
                </dd>
              </div>
              <div>
                <dt>{t("Slug")}</dt>
                <dd>{product.slug || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
        {product.shortDescription && <section className="product-details-description">
            <h3>{t("Summary")}</h3>
            <p>{product.shortDescription}</p>
          </section>}
        {product.description && <section className="product-details-description">
            <h3>{t("Description")}</h3>
            <p>{product.description}</p>
          </section>}
        {sections.map((section, index) => <section className="product-details-description" key={index}>
            <h3>{section.title || section.type}</h3>
            {section.content && <p>{section.content}</p>}
            {section.items?.length > 0 && <ul>
                {section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </ul>}
            {section.rows?.length > 0 && <dl>
                {section.rows.map((row, rowIndex) => <div key={rowIndex}>
                    <dt>{t(row.label)}</dt>
                    <dd>{row.value}</dd>
                  </div>)}
              </dl>}
          </section>)}
        {!product.shortDescription && !product.description && !sections.length && <p className="product-details-empty">{t("No description added yet.")}</p>}
      </div>
      {children}
      <footer className="order-details-footer">
        {base && <Link className="product-details-edit" to={`${base}/${product._id}/edit`} onClick={() => dialog.current.close()}>
          <TbEdit aria-hidden="true" />{t("Edit product")}</Link>}
        <button type="button" className="btn-primary" onClick={() => dialog.current.close()}>{t("Close details")}</button>
      </footer>
    </dialog>;
}
