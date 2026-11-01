import { CardResetMenu, useReportCard } from "../../../components/common/CardReset";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useState } from "react";
import { TbDownload, TbSearch, TbPackage, TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { money } from "../../../components/common/QueryState";
function exportProducts(products) {
  const safe = value => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const csv = [["Product", "Category", "Views", "Clicks", "Cart additions", "Net paid units", "Net product revenue", "Stock"], ...products.map(item => [item.name, item.category, item.views, item.clicks, item.adds, item.units, item.revenue.toFixed(2), item.stock])].map(row => row.map(safe).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;"
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "product-analytics.csv";
  link.click();
  URL.revokeObjectURL(url);
}
export function ProductPerformance({
  products
}) {
  const {
    t
  } = usePageTranslation();
  const report = useReportCard("analytics-products");
  products = report.data?.products || products;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("revenue");
  const [page, setPage] = useState(1);
  const filtered = products.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return <section className="analytics-card analytics-products card-reset-surface" data-report-card="analytics-products"><CardResetMenu cardId="analytics-products" title="Product performance" />
    <div className="analytics-section-heading"><div><h2>{t("Product performance")}</h2><p>{t("Discover what gets attention and what earns revenue")}</p></div><button type="button" className="analytics-outline-button" onClick={() => exportProducts(filtered)} disabled={!filtered.length}><TbDownload aria-hidden="true" />{t("Export CSV")}</button></div>
    <div className="analytics-product-filters"><label><TbSearch aria-hidden="true" /><input aria-label={t("Search product analytics")} value={search} placeholder={t("Search products or categories")} onChange={event => {
          setSearch(event.target.value);
          setPage(1);
        }} /></label><select aria-label={t("Rank products by")} value={sort} onChange={event => {
        setSort(event.target.value);
        setPage(1);
      }}><option value="revenue">{t("Highest revenue")}</option><option value="views">{t("Most viewed")}</option><option value="clicks">{t("Most clicked")}</option><option value="adds">{t("Most added to cart")}</option><option value="units">{t("Most sold")}</option></select></div>
    <div className="analytics-table-wrap"><table className="table analytics-product-table"><thead><tr><th data-align="left">{t("Product")}</th><th data-align="center">{t("Views")}</th><th data-align="center">{t("Clicks")}</th><th className="analytics-extra-column" data-align="center">{t("Cart adds")}</th><th className="analytics-extra-column" data-align="center">{t("Net units")}</th><th data-align="center">{t("Revenue")}</th></tr></thead><tbody>{filtered.slice((current - 1) * 10, current * 10).map(item => <tr key={item.id}><td><div className="analytics-product-name">{t(item.image ? <img src={item.image} alt="" loading="lazy" /> : <span><TbPackage aria-hidden="true" /></span>)}<div><strong title={item.name}>{item.name}</strong><small>{item.category}{t(item.deleted ? " / Deleted" : "")}</small></div></div></td><td>{item.views}</td><td>{item.clicks}</td><td className="analytics-extra-column">{item.adds}</td><td className="analytics-extra-column">{item.units}</td><td>{money(item.revenue)}</td></tr>)}</tbody></table></div>
    {!filtered.length && <div className="analytics-empty">{t("No products match this report.")}</div>}
    <footer className="analytics-product-pagination"><span>{filtered.length}{t(" products / page ")}{current}{t(" of ")}{pages}</span><div><button type="button" aria-label={t("Previous product page")} disabled={current === 1} onClick={() => setPage(current - 1)}><TbChevronLeft /></button><button type="button" aria-label={t("Next product page")} disabled={current === pages} onClick={() => setPage(current + 1)}><TbChevronRight /></button></div></footer>
    <p className="analytics-footnote">{t("Product revenue excludes delivery fees and refunded units. Stock is current inventory.")}</p>
  </section>;
}
