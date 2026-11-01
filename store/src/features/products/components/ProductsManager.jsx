import { AdminProductQuestions, AdminProductReviews } from "../../feedback/Feedback";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useProductsPage } from "../hooks/useProductsPage";
import { QueryState } from "../../../components/common/QueryState";
import { ProductsListView } from "./ProductsListView";
import { errorMessage } from "../../../services/api";
import { useProductImages } from "../hooks/useProductImages";
import StructuredDescriptionEditor, { normalizeSections } from "./StructuredDescriptionEditor";
import { TbPhotoPlus, TbTrash, TbEye, TbEyeOff } from "react-icons/tb";
export function ProductEditor({
  product,
  hook,
  base
}) {
  const {
    t
  } = usePageTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: product?.name || "",
    title: product?.title || "",
    subtitle: product?.subtitle || "",
    shortDescription: product?.shortDescription || "",
    description: product?.description || "",
    descriptionSections: normalizeSections(product?.descriptionSections),
    price: product?.price ?? "",
    stock: product?.stock ?? 0,
    showStock: product?.showStock !== false,
    discount: product?.discount ?? 0,
    category: product?.category?._id || "",
    tenantId: product?.tenantId || hook.stores.data?.[0]?._id || "",
    images: product?.images || [],
    isActive: product?.isActive ?? true
  });
  const upload = useProductImages(form.tenantId, hook.platform);
  const set = (key, value) => setForm(current => ({
    ...current,
    [key]: value
  }));
  const submit = event => {
    event.preventDefault();
    if (upload.isPending || hook.mutation.isPending) return;
    const data = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      discount: Number(form.discount),
      descriptionSections: form.descriptionSections.map(section => ({
        ...section,
        title: section.title.trim(),
        content: section.content.trim(),
        items: section.items.map(item => item.trim()).filter(Boolean),
        rows: section.rows.map(row => ({
          label: row.label.trim(),
          value: row.value.trim()
        })).filter(row => row.label || row.value)
      }))
    };
    if (!hook.platform) delete data.tenantId;
    hook.mutation.mutate({
      method: product ? "patch" : "post",
      id: product?._id,
      data
    }, {
      onSuccess: () => navigate(base)
    });
  };
  return <form className="card form-stack editor" onSubmit={submit}>
      <h2>{t(product ? "Edit Product" : "Create Product")}</h2>
      {hook.platform && <label>{t("Store")}<select required disabled={!!product} value={form.tenantId} onChange={event => set("tenantId", event.target.value)}>
            <option value="">{t("Select Store")}</option>
            {hook.stores.data?.map(store => <option key={store._id} value={store._id}>
                {store.name}
              </option>)}
          </select>
        </label>}
      <label>{t("Product Name")}<input required value={form.name} onChange={event => set("name", event.target.value)} />
      </label>
      <label>{t("Storefront title")}<input value={form.title} onChange={event => set("title", event.target.value)} placeholder={t("Optional display title; product name is used by default")} />
      </label>
      <label>{t("Subtitle")}<input value={form.subtitle} onChange={event => set("subtitle", event.target.value)} placeholder={t("A short supporting line")} />
      </label>
      <label>{t("Short summary")}<textarea value={form.shortDescription} onChange={event => set("shortDescription", event.target.value)} placeholder={t("One or two sentences shown beside the product image")} />
      </label>
      <label>{t("Product overview")}<textarea value={form.description} onChange={event => set("description", event.target.value)} placeholder={t("A clear general description of the product")} />
      </label>
      <StructuredDescriptionEditor value={form.descriptionSections} onChange={sections => set("descriptionSections", sections)} />
      <div className="form-grid">
        {["price", "stock", "discount"].map(field => <div className="product-number-field" key={field}>
            <div className="stock-field-heading"><label htmlFor={`product-field-${field}`}>{t(field === "price" ? "Price (BDT)" : field === "stock" ? "Stock" : "Discount (%)")}</label>
              {field === "stock" && <button type="button" className="stock-visibility-icon" role="switch" aria-label="Show stock quantity on storefront" title="Show stock quantity on storefront" aria-checked={form.showStock} disabled={hook.mutation.isPending} onClick={() => set("showStock", !form.showStock)}>{form.showStock ? <TbEye aria-hidden="true" /> : <TbEyeOff aria-hidden="true" />}</button>}
            </div>
            <input id={`product-field-${field}`} type="number" min="0" max={field === "discount" ? 100 : undefined} step={field === "price" ? "0.01" : "1"} required value={form[field]} onChange={event => set(field, event.target.value)} />
          </div>)}
      </div>
      {!hook.platform && <label>{t("Category")}<select value={form.category} onChange={event => set("category", event.target.value)}>
            <option value="">{t("No Category")}</option>
            {hook.categories.data?.map(category => <option key={category._id} value={category._id}>
                {category.name}
              </option>)}
          </select>
        </label>}
      <label className="product-upload">
        <span>
          <TbPhotoPlus aria-hidden="true" />{t("Product photos")}</span>
        <small>{t("Select up to 6 JPEG, PNG or WebP photos at once, up to 5 MB each. The first image is the primary image.")}</small>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={upload.isPending || hook.mutation.isPending || hook.platform && !form.tenantId} onChange={event => {
        const files = Array.from(event.target.files || []);
        if (files.length) upload.mutate(files, {
          onSuccess: images => {
            setForm(current => ({
              ...current,
              images: [...current.images, ...images]
            }));
          }
        });
        event.target.value = "";
      }} />
      </label>
      {!!form.images.length && <div className="product-image-editor">
          {form.images.map((image, index) => <div key={image.public_id || image.url}>
              <img src={image.url} alt={`Product photo ${index + 1}`} />
              {index === 0 && <span>{t("Primary")}</span>}
              {index > 0 && <button type="button" className="product-image-primary" disabled={upload.isPending || hook.mutation.isPending} onClick={() => setForm(current => ({
          ...current,
          images: [current.images[index], ...current.images.filter((_, itemIndex) => itemIndex !== index)]
        }))}>{t("Make primary")}</button>}
              <button type="button" aria-label={`Remove image ${index + 1}`} disabled={upload.isPending || hook.mutation.isPending} onClick={() => set("images", form.images.filter((_, itemIndex) => itemIndex !== index))}>
                <TbTrash />
              </button>
            </div>)}
        </div>}
      {upload.isPending && <div className="product-upload-progress" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><span>{t(upload.progress < 100 ? `Uploading photos… ${upload.progress}%` : "Processing photos…")}</span><progress max="100" value={upload.progress} aria-label={t("Photo upload progress")} /></div>}
      {upload.isError && <p role="alert" className="error">
          {errorMessage(upload.error)}
        </p>}
      <label className="row">
        <input type="checkbox" checked={form.isActive} onChange={event => set("isActive", event.target.checked)} />{" "}{t(" Published")}</label>
      {hook.mutation.isError && <p role="alert" className="error">
          {errorMessage(hook.mutation.error)}
        </p>}
      <div className="row">
        <Link className="btn-secondary" to={base}>{t("Cancel")}</Link>
        <button className="btn-primary" disabled={hook.mutation.isPending || upload.isPending}>
          {t(hook.mutation.isPending ? "Saving..." : "Save Product")}
        </button>
      </div>
    </form>;
}
export function ProductsManager({
  base = "/admin/products"
}) {
  const {
    t
  } = usePageTranslation();
  const hook = useProductsPage();
  const {
    id
  } = useParams();
  const {
    pathname
  } = useLocation();
  const editing = pathname.endsWith("/create") || pathname.endsWith("/edit");
  const product = hook.query.data?.find(item => item._id === id);
  if (!editing) return <ProductsListView hook={hook} base={base} />;
  return <div className="admin-catalog-page">
      <div className="dashboard-header">
        <div>
          <h1>{t("Products")}</h1>
          <p>{t("Manage inventory, pricing and availability.")}</p>
        </div>
      </div>
      <QueryState query={hook.query}>
        {t(id && !product ? <div className="state-card">{t("Product not found.")}</div> : <ProductEditor key={id || "new"} product={product} hook={hook} base={base} />)}
      </QueryState>
      {product && <><AdminProductReviews productId={product._id} /><AdminProductQuestions productId={product._id} /></>}
    </div>;
}
