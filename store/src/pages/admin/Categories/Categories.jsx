import { usePageTranslation } from "../../../features/language/AdminLanguageProvider";
import React, { useEffect, useRef } from "react";
import { TbEdit, TbTrash, TbPlus, TbCheck, TbX, TbSearch, TbCategory, TbFolder, TbTag, TbBottle, TbBrush, TbLeaf, TbDroplet, TbSparkles } from "react-icons/tb";
import { useCategoriesPage } from "../../../features/categories/hooks/useCategoriesPage";
import { QueryState } from "../../../components/common/QueryState";
import { Pagination } from "../../../components/common/Pagination";
import { errorMessage } from "../../../services/api";
import { useConfirmDialog } from "../../../components/common/ConfirmDialog";
function CategoryIcon({
  category
}) {
  if (category.image?.url) return <img className="category-admin-photo" src={category.image.url} alt="" />;
  const name = `${category.name} ${category.slug}`.toLowerCase();
  const [Icon, tone] = /skin/.test(name) ? [TbBottle, "purple"] : /makeup/.test(name) ? [TbBrush, "gold"] : /hair/.test(name) ? [TbLeaf, "green"] : /body/.test(name) ? [TbDroplet, "blue"] : /beauty/.test(name) ? [TbSparkles, "pink"] : [TbCategory, "purple"];
  return <span className={`catalog-category-icon ${tone}`}>
      <Icon aria-hidden="true" />
    </span>;
}
export default function Categories() {
  const {
    t
  } = usePageTranslation();
  const hook = useCategoriesPage();
  const {
    confirm,
    confirmationDialog
  } = useConfirmDialog();
  const nameInput = useRef(null);
  const photoInput = useRef(null);
  useEffect(() => { if (!hook.photo && photoInput.current) photoInput.current.value = ""; }, [hook.photo]);
  const startEdit = category => {
    hook.edit(category);
    nameInput.current?.focus();
  };
  const count = hook.query.data?.length || 0;
  return <div className="admin-catalog-page categories-reference-page">
      {confirmationDialog}
      <div className="categories-page-heading">
        <span>
          <TbCategory aria-hidden="true" />
        </span>
        <div>
          <h1>{t("Categories")}</h1>
          <p>{t("Organise your product catalog")}</p>
        </div>
      </div>
      <form className="store-reference-card categories-create-card" onSubmit={hook.submit}>
        <span className="categories-create-icon">
          <TbFolder aria-hidden="true" />
        </span>
        <div className="categories-create-content">
          <h2>{t(hook.editing ? "Edit category" : "Create a new category")}</h2>
          <p>
            {t(hook.editing ? "Update the category name for your catalog" : "Add a category to organise your products")}
          </p>
          <div className="category-photo-editor">
            <label>Category photo (optional)
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={hook.mutation.isPending} onChange={event => { hook.setPhoto(event.target.files?.[0] || null); hook.setRemoveImage(false); }} />
            </label>
            <small>JPEG, PNG or WebP, up to 5 MB</small>
            <small>Leave this empty to use a product photo automatically. You can upload a category photo later using Edit.</small>
            {(hook.preview || (!hook.removeImage && hook.editing?.image?.url)) && <><img src={hook.preview || hook.editing.image.url} alt="Category preview" /><button type="button" onClick={() => { hook.setPhoto(null); hook.setRemoveImage(true); }}>Remove photo</button></>}
          </div>
          <div className="categories-create-controls">
            <label className="categories-name-input">
              <span className="sr-only">{t("Category name")}</span>
              <TbTag aria-hidden="true" />
              <input ref={nameInput} required maxLength={100} placeholder={t("Enter category name")} value={hook.name} onChange={event => hook.setName(event.target.value)} />
            </label>
            <div className="catalog-form-buttons">
              <button type="submit" className="btn-primary" aria-label={hook.editing ? "Update category" : "Create category"} disabled={hook.mutation.isPending}>
                {t(hook.editing ? <TbCheck aria-hidden="true" /> : <TbPlus aria-hidden="true" />)}
                {t(hook.mutation.isPending ? "Saving…" : hook.editing ? "Update" : "Create")}
                <span className="catalog-desktop-text">{t("category")}</span>
              </button>
              {hook.editing && <button type="button" className="catalog-icon-button" aria-label={t("Cancel editing category")} title={t("Cancel editing")} onClick={() => hook.edit(null)}>
                  <TbX aria-hidden="true" />
                </button>}
            </div>
          </div>
        </div>
      </form>
      {hook.mutation.isError && <p className="error" role="alert">
          {errorMessage(hook.mutation.error)}
        </p>}
      <section className="store-reference-card catalog-list-card categories-list-card" aria-label={t("Categories list")}>
        <div className="catalog-list-heading">
          <div>
            <h2>{t("All categories")}</h2>
            <p>{t("Manage and edit your product categories.")}</p>
          </div>
          <span>
            <TbCategory aria-hidden="true" />
            {count} {t(count === 1 ? "category" : "categories")}
          </span>
        </div>
        <label className="catalog-search">
          <span className="sr-only">{t("Search categories")}</span>
          <TbSearch aria-hidden="true" />
          <input placeholder={t("Search categories…")} value={hook.search} onChange={event => hook.setSearch(event.target.value)} />
        </label>
        <QueryState query={hook.query}>
          <div className="catalog-table-container">
            <table className="catalog-table catalog-categories-table">
              <thead>
                <tr>
                  <th className="catalog-desktop-column" aria-label={t("Serial number")} data-align="center">
                    #
                  </th>
                  <th data-align="left">{t("Category")}</th>
                  <th data-align="left">{t("Slug")}</th>
                  <th data-align="center">{t("Products")}</th>
                  <th data-align="center">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {hook.rows.map((category, index) => <tr key={category._id}>
                    <td className="catalog-desktop-column catalog-muted">
                      {(hook.page - 1) * 10 + index + 1}
                    </td>
                    <td>
                      <div className="catalog-item">
                        <CategoryIcon category={category} />
                        <strong>{category.name}</strong>
                      </div>
                    </td>
                    <td className="catalog-muted">{category.slug}</td>
                    <td>
                      <span className="categories-product-count" aria-label={`${category.productCount ?? 0} products`}>
                        {category.productCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <div className="catalog-row-actions">
                        <button type="button" className="catalog-icon-button" aria-label={`Edit ${category.name}`} title={t("Edit category")} disabled={hook.mutation.isPending} onClick={() => startEdit(category)}>
                          <TbEdit aria-hidden="true" />
                        </button>
                        <button type="button" className="catalog-icon-button danger" aria-label={`Delete ${category.name}`} title={t("Delete category")} disabled={hook.mutation.isPending} onClick={() => {
                      confirm({
                        title: "Delete category?",
                        message: `Delete "${category.name}"? Its products will be kept and moved to No Category. This cannot be undone.`,
                        onConfirm: () => hook.mutation.mutate({
                          method: "delete",
                          id: category._id
                        })
                      });
                    }}>
                          <TbTrash aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
            {!hook.rows.length && <p className="catalog-empty">{t("No categories found.")}</p>}
          </div>
          <Pagination {...hook} />
        </QueryState>
      </section>
    </div>;
}
