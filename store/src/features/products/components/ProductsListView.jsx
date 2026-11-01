import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TbBox, TbPlus, TbSearch, TbList, TbLayoutGrid, TbEdit, TbEye, TbTrash, TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { QueryState, money } from "../../../components/common/QueryState";
import { errorMessage } from "../../../services/api";
import { ProductDetailsDialog } from "./ProductDetailsDialog";
import { useConfirmDialog } from "../../../components/common/ConfirmDialog";
function ProductIdentity({
  item
}) {
  const {
    t
  } = usePageTranslation();
  return <div className="catalog-item">
      {t(item.images?.[0]?.url ? <img className="catalog-product-image" src={item.images[0].url} alt="" /> : <span className="catalog-product-image catalog-image-placeholder">
          <TbBox aria-hidden="true" />
        </span>)}
      <div className="catalog-product-info">
        <strong title={item.name}>{item.name}</strong>
        <small className="products-category catalog-desktop-column">
          {item.category?.name || "Uncategorised"}
        </small>
        <small className="catalog-mobile-stock">
          {t(item.stock > 0 ? `${item.stock} in stock` : "Out of stock")}
        </small>
      </div>
    </div>;
}
export function ProductsListView({
  hook,
  base
}) {
  const {
    t
  } = usePageTranslation();
  const {
    confirm,
    confirmationDialog
  } = useConfirmDialog();
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [status, setStatus] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const stock = searchParams.get("stock") || "";
  const setStock = value => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set("stock", value);else next.delete("stock");
    return next;
  });
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const products = (hook.query.data || []).filter(item => {
    const text = `${item.name} ${item.category?.name || ""}`.toLowerCase();
    return text.includes(hook.search.toLowerCase().trim()) && (!status || (status === "published" ? item.isActive : !item.isActive)) && (!stock || (stock === "attention" ? item.isActive && item.stock < 10 : stock === "low" ? item.stock > 0 && item.stock <= 20 : stock === "out" ? item.stock <= 0 : item.stock > 20));
  }).sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const pages = Math.max(1, Math.ceil(products.length / pageSize));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * pageSize;
  const rows = products.slice(offset, offset + pageSize);
  const change = setter => event => {
    setter(event.target.value);
    setPage(1);
  };
  const actions = item => <div className="catalog-row-actions">
      <Link className="catalog-icon-button" title={t("Edit product")} aria-label={`Edit ${item.name}`} to={`${base}/${item._id}/edit`}>
        <TbEdit aria-hidden="true" />
      </Link>
      <button type="button" className="catalog-icon-button products-preview" title={t("Details")} aria-label={`Details for ${item.name}`} aria-haspopup="dialog" onClick={() => setDetailsProduct(item)}>
        <TbEye aria-hidden="true" />
      </button>
      <button type="button" className="catalog-icon-button danger" title={t("Delete product")} aria-label={`Delete ${item.name}`} disabled={hook.mutation.isPending} onClick={() => {
      confirm({
        title: "Delete product?",
        message: `Remove "${item.name}" from your store?`,
        onConfirm: () => hook.mutation.mutate({
          method: "delete",
          id: item._id,
          data: hook.platform ? {
            tenantId: item.tenantId
          } : undefined
        })
      });
    }}>
        <TbTrash aria-hidden="true" />
      </button>
    </div>;
  const stockLabel = item => item.stock <= 0 ? "Out of stock" : item.stock <= 20 ? "Low stock" : "In stock";
  const badge = item => <span className={`products-publication ${item.isActive ? "published" : "draft"}`}>
      <i aria-hidden="true" />
      {t(item.isActive ? "Published" : "Draft")}
    </span>;
  const startPage = Math.max(1, Math.min(currentPage - 2, pages - 4));
  return <div className="admin-catalog-page products-reference-page">
      {confirmationDialog}
      <section className="store-reference-card products-workspace" aria-label={t("Products list")}>
        <div className="products-page-heading">
          <div className="products-title">
            <span className="products-title-icon">
              <TbBox aria-hidden="true" />
            </span>
            <div>
              <h1>{t("Products")}</h1>
              <p>{t("Manage your store products")}</p>
            </div>
          </div>
          <div className="products-heading-actions">
          <Link className="btn-primary catalog-add-product" aria-label={t("Add Product")} to={`${base}/create`}>
            <TbPlus aria-hidden="true" />{t("Add")}<span className="catalog-desktop-text">{t("Product")}</span>
          </Link>
          </div>
        </div>
        {stock === "attention" && <div className="attention-filter-note" role="status">
            <span>{t("Showing published products with fewer than 10 in stock")}</span>
            <button type="button" onClick={() => {
          setStock("");
          setPage(1);
        }}>{t("Clear filter")}</button>
          </div>}
        <div className="products-toolbar">
          <label className="catalog-search">
            <span className="sr-only">{t("Search products")}</span>
            <TbSearch aria-hidden="true" />
            <input placeholder={t("Search products…")} value={hook.search} onChange={change(hook.setSearch)} />
          </label>
          <label className="products-desktop-control">
            <span className="sr-only">{t("Product status")}</span>
            <select aria-label={t("Product status")} value={status} onChange={change(setStatus)}>
              <option value="">{t("All status")}</option>
              <option value="published">{t("Published")}</option>
              <option value="draft">{t("Draft")}</option>
            </select>
          </label>
          <label className="products-desktop-control">
            <span className="sr-only">{t("Stock level")}</span>
            <select aria-label={t("Stock level")} value={stock} onChange={change(setStock)}>
              <option value="">{t("All stock")}</option>
              <option value="attention">{t("Needs restocking (under 10)")}</option>
              <option value="low">{t("Low stock")}</option>
              <option value="in">{t("In stock (over 20)")}</option>
              <option value="out">{t("Out of stock")}</option>
            </select>
          </label>
          <label className="products-desktop-control">
            <span className="sr-only">{t("Sort products")}</span>
            <select aria-label={t("Sort products")} value={sort} onChange={change(setSort)}>
              <option value="newest">{t("Newest first")}</option>
              <option value="price-asc">{t("Price: low to high")}</option>
              <option value="price-desc">{t("Price: high to low")}</option>
              <option value="name">{t("Name: A–Z")}</option>
            </select>
          </label>
          <div className="products-view-toggle products-desktop-control" aria-label={t("Product display")}>
            <button type="button" aria-label={t("List view")} aria-pressed={view === "list"} onClick={() => setView("list")}>
              <TbList aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("Grid view")} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              <TbLayoutGrid aria-hidden="true" />
            </button>
          </div>
        </div>
        {(status || stock || sort !== "newest") && <div className="products-active-filters">
            <span>{t("Filtered or sorted products")}</span>
            <button type="button" onClick={() => {
          setStatus("");
          setStock("");
          setSort("newest");
          setPage(1);
        }}>{t("Reset filters")}</button>
          </div>}
        {hook.mutation.isError && <p className="error" role="alert">
            {errorMessage(hook.mutation.error)}
          </p>}
        <QueryState query={hook.query}>
          <div className={`products-results ${view === "grid" ? "grid-view" : "list-view"}`}>
            <div className="catalog-table-container products-table-wrap">
              <table className="catalog-table catalog-products-table">
                <thead>
                  <tr>
                    <th aria-label={t("Serial number")} data-align="center">#</th>
                    <th data-align="left">{t("Product")}</th>
                    <th data-align="center">{t("Price")}</th>
                    <th className="catalog-desktop-column" data-align="center">{t("Stock")}</th>
                    <th className="catalog-desktop-column" data-align="center">{t("Status")}</th>
                    <th data-align="center">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, index) => <tr key={item._id}>
                      <td className="catalog-muted">{offset + index + 1}</td>
                      <td>
                        <ProductIdentity item={item} />
                      </td>
                      <td className="catalog-price">{money(item.price)}</td>
                      <td className="catalog-desktop-column">
                        <div className={`products-stock ${item.stock <= 0 ? "out" : item.stock <= 20 ? "low" : "in"}`}>
                          <span>
                            <i aria-hidden="true" />
                            {item.stock}
                          </span>
                          <small>{stockLabel(item)}</small>
                        </div>
                      </td>
                      <td className="catalog-desktop-column">{badge(item)}</td>
                      <td>{actions(item)}</td>
                    </tr>)}
                </tbody>
              </table>
              {!rows.length && <p className="catalog-empty">{t("No products found.")}</p>}
            </div>
            <div className="products-grid">
              {rows.map(item => <article className="products-grid-card" key={item._id}>
                  <ProductIdentity item={item} />
                  <div className="products-grid-meta">
                    <strong>{money(item.price)}</strong>
                    {badge(item)}
                  </div>
                  <p>{item.stock}{t(" in stock")}</p>
                  {actions(item)}
                </article>)}
              {!rows.length && <p className="catalog-empty">{t("No products found.")}</p>}
            </div>
          </div>
          <div className="products-footer">
            <p>{t("Showing ")}{t(products.length ? offset + 1 : 0)}{t(" to ")}{" "}
              {offset + rows.length}{t(" of ")}{products.length}{t(" products")}</p>
            <nav className="products-pagination" aria-label={t("Products pagination")}>
              <button type="button" aria-label={t("Previous page")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <TbChevronLeft aria-hidden="true" />
              </button>
              {Array.from({
              length: Math.min(5, pages)
            }, (_, index) => startPage + index).map(number => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={currentPage === number ? "page" : undefined} onClick={() => setPage(number)}>
                  {number}
                </button>)}
              <button type="button" aria-label={t("Next page")} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>
                <TbChevronRight aria-hidden="true" />
              </button>
            </nav>
          </div>
        </QueryState>
      </section>
      {detailsProduct && <ProductDetailsDialog key={detailsProduct._id} product={detailsProduct} base={base} onClose={() => setDetailsProduct(null)} />}
    </div>;
}
