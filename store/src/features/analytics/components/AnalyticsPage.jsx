import { CardResetProvider, ReportCard, CardResetMenu, useReportCard } from "../../../components/common/CardReset";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { LiveVisitors } from "./LiveVisitors";
import { StatCardWave } from "../../../components/common/StatCardWave";
import React, { useState } from "react";
import { TbChartBar, TbCash, TbShoppingCart, TbUsers, TbPercentage, TbEye, TbClick, TbReceiptRefund, TbShoppingBag, TbArrowUpRight, TbArrowDownRight, TbRefresh, TbClock, TbDeviceMobile, TbWorld, TbActivity } from "react-icons/tb";
import { useAnalytics } from "../hooks/useAnalytics";
import { QueryState, money } from "../../../components/common/QueryState";
import { AnalyticsTrend } from "./AnalyticsTrend";
import { ProductPerformance } from "./ProductPerformance";

const number = value => new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 1
}).format(value || 0);
const percent = value => `${number(value)}%`;
function Metric({
  label,
  metricKey,
  icon: Icon,
  metric,
  format = number,
  lowerBetter = false,
  tone
}) {
  const {
    t
  } = usePageTranslation();
  const report = useReportCard(`analytics-${metricKey}`);
  metric = report.data?.metrics?.[metricKey] || metric;
  const change = metric?.change ?? null;
  const good = change === null || change === 0 ? null : lowerBetter ? change < 0 : change > 0;
  const color = {
    "#e6f7ef": "#10b981",
    "#edf5ff": "#3b82f6",
    "#f0edff": "#8b5cf6",
    "#fff3df": "#f59e0b",
    "#ecf8f4": "#059669",
    "#fff0f1": "#ef4444"
  }[tone];
  return <article className="stat-card analytics-summary-card card-reset-surface" data-report-card={`analytics-${metricKey}`} aria-busy={report.loading}>
    <CardResetMenu cardId={`analytics-${metricKey}`} title={label} />
    <div className="stat-card-icon-box" style={{
      background: tone,
      color
    }}>{React.createElement(Icon, {
        "aria-hidden": "true"
      })}</div>
    <div className="stat-card-info"><p className="stat-card-label">{t(label)}</p><strong className="stat-card-value">{format(metric?.value || 0)}</strong></div>
    <p className={`analytics-change ${good === null ? "neutral" : good ? "positive" : "negative"}`}>
      <span>{t(change === null ? metric?.value ? "New activity" : "No change" : change === 0 ? "No change" : <>{t(change > 0 ? <TbArrowUpRight aria-hidden="true" /> : <TbArrowDownRight aria-hidden="true" />)}{Math.abs(change)}%</>)}</span>
      <small>{t("vs previous period")}</small>
    </p>
    <StatCardWave color={color} id={`analytics-${label.replaceAll(" ", "-")}`} />
  </article>;
}
function Breakdown({
  title,
  kind,
  description,
  icon: Icon,
  rows,
  formatLabel = label => label
}) {
  const {
    t
  } = usePageTranslation();
  const report = useReportCard(`analytics-${kind}`);
  rows = report.data?.[kind] || rows;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="analytics-card card-reset-surface" data-report-card={`analytics-${kind}`}><CardResetMenu cardId={`analytics-${kind}`} title={title} /><div className="analytics-section-heading"><div><h2>{React.createElement(Icon, {
            "aria-hidden": "true"
          })}{t(title)}</h2><p>{t(description)}</p></div></div>{t(rows.length ? rows.map(row => <div className="analytics-breakdown" key={row._id}><div><span>{formatLabel(row._id)}</span><strong>{number(row.count)} <small>{percent(total ? row.count / total * 100 : 0)}</small></strong></div><div className="analytics-bar"><i style={{
          width: `${total ? row.count / total * 100 : 0}%`
        }} /></div></div>) : <div className="analytics-empty">{t("No data in this period yet.")}</div>)}</section>;
}
function getInsights(data) {
  const metrics = data?.metrics || {};
  const insights = [];
  if (metrics.clicks?.value && !metrics.adds?.value) insights.push("Products are getting clicks but no tracked cart additions. Review product pricing, availability and product descriptions.");
  if (metrics.checkoutAbandonment?.value > 50) insights.push("More than half of tracked checkout sessions have no matching order in this period. Review delivery fees and checkout clarity.");
  if (data?.inventory.outOfStock) insights.push(`${data.inventory.outOfStock} products are out of stock. Restock popular items to avoid missed sales.`);
  if (metrics.revenue?.change > 0) insights.push(`Net revenue is up ${metrics.revenue.change}% versus the previous period.`);
  if (!insights.length) insights.push(metrics.sessions?.value ? "Keep monitoring product views, cart additions and orders to identify changes in shopper behaviour." : "Storefront activity will appear as shoppers browse. Existing order history is already included in sales reports.");
  return insights;
}
export default function AnalyticsPage() {
  const {
    t
  } = usePageTranslation();
  const [range, setRange] = useState({
    days: "30"
  });
  const [custom, setCustom] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [draft, setDraft] = useState({
    start: "",
    end: ""
  });
  const query = useAnalytics(range);
  const data = query.data;
  const metrics = data?.metrics || {};
  const goToSection = id => {
    const section = document.getElementById(id);
    section?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
    section?.focus({
      preventScroll: true
    });
  };
  return <CardResetProvider data={data} range={range.days === "custom" ? { start: range.start, end: range.end } : { days: range.days }}><div className="analytics-page">
    <header className="analytics-page-heading"><div><h1><TbChartBar aria-hidden="true" />{t("Analytics")}</h1><p>{t("Understand sales, discover trends, and decide what to improve next.")}</p></div><button type="button" className="analytics-outline-button" disabled={query.isFetching} onClick={() => query.refetch()}><TbRefresh aria-hidden="true" />{t(query.isFetching ? "Updating..." : "Refresh")}</button></header>
    <div className="analytics-report-controls"><section className="analytics-range-bar" aria-label={t("Analytics date range")}><div className="analytics-presets">{["7", "30", "90"].map(days => <button type="button" key={days} aria-pressed={!custom && range.days === days} onClick={() => {
            setCustom(false);
            setRangeError("");
            setRange({
              days
            });
          }}>{days}{t(" days")}</button>)}<button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>{t("Custom")}</button></div><span><TbClock aria-hidden="true" />{t("Asia/Dhaka")}</span></section>
    {custom && <form className="analytics-custom-range" onSubmit={event => {
        event.preventDefault();
        if ((new Date(draft.end) - new Date(draft.start)) / 86400000 > 365) {
          setRangeError("Choose a date range of 366 days or fewer.");
          return;
        }
        setRangeError("");
        setRange({
          days: "custom",
          ...draft
        });
      }}><label>{t("From")}<input aria-label={t("Analytics start date")} type="date" required value={draft.start} max={draft.end || undefined} onChange={event => setDraft({
            ...draft,
            start: event.target.value
          })} /></label><label>{t("To")}<input aria-label={t("Analytics end date")} type="date" required value={draft.end} min={draft.start || undefined} onChange={event => setDraft({
            ...draft,
            end: event.target.value
          })} /></label><button className="btn-primary">{t("Apply range")}</button></form>}
    {rangeError && <p className="analytics-range-error" role="alert">{rangeError}</p>}
    <div className="analytics-report-meta"><span><TbClock aria-hidden="true" />{t("All times in Asia/Dhaka")}</span><span role="status">{t(query.isFetching ? "Updating report?" : query.dataUpdatedAt ? `Updated ${new Date(query.dataUpdatedAt).toLocaleTimeString("en-BD", {
            hour: "2-digit",
            minute: "2-digit"
          })}` : "Preparing report?")}</span></div></div>
    <nav className="analytics-section-nav" aria-label={t("Analytics sections")}>{[["analytics-overview", "Overview"], ["analytics-products", "Products"], ["analytics-audience", "Audience"], ["analytics-operations", "Inventory & insights"]].map(([id, label]) => <button type="button" key={id} onClick={() => goToSection(id)}>{t(label)}</button>)}</nav>
    <LiveVisitors />
    <QueryState query={query}>{data && <>
      <div id="analytics-overview" className="analytics-period-label analytics-anchor" tabIndex={-1}>{new Date(data.range.start).toLocaleDateString("en-BD", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium"
          })} - {new Date(new Date(data.range.end).getTime() - 1).toLocaleDateString("en-BD", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium"
          })}<span>{t("Compared with the previous ")}{data.range.days}{t(" days")}</span></div>
      <div className="analytics-metrics">
        <Metric metricKey="revenue" label="Net revenue" icon={TbCash} metric={metrics.revenue} format={money} tone="#e6f7ef" />
        <Metric metricKey="orders" label="Orders placed" icon={TbShoppingCart} metric={metrics.orders} tone="#edf5ff" />
        <Metric metricKey="sessions" label="Store sessions" icon={TbUsers} metric={metrics.sessions} tone="#f0edff" />
        <Metric metricKey="conversion" label="Order conversion" icon={TbPercentage} metric={metrics.conversion} format={percent} tone="#fff3df" />
      </div>
      <ReportCard cardId="analytics-highlights" title="Your store this period">{cardData => <div className="analytics-highlights"><div><span className="analytics-eyebrow">{t("At a glance")}</span><h2>{t("Your store this period")}</h2><p>{getInsights(cardData)[0]}</p></div><button type="button" onClick={() => goToSection("analytics-operations")}>{t("Explore insights")}<TbArrowUpRight aria-hidden="true" /></button></div>}</ReportCard>
      <AnalyticsTrend daily={data.daily} />
      <div className="analytics-metrics analytics-secondary-metrics">        <Metric metricKey="pageViews" label="Page views" icon={TbEye} metric={metrics.pageViews} tone="#edf5ff" />
        <Metric metricKey="clicks" label="Product clicks" icon={TbClick} metric={metrics.clicks} tone="#ecf8f4" />
        <Metric metricKey="averageOrder" label="Average paid order" icon={TbShoppingBag} metric={metrics.averageOrder} format={money} tone="#f0edff" />
        <Metric metricKey="refunds" label="Refunded amount" icon={TbReceiptRefund} metric={metrics.refunds} format={money} lowerBetter tone="#fff0f1" />
      </div>
      <div className="analytics-group-title"><h2>{t("Customer behaviour")}</h2><p>{t("Follow the path from browsing to buying.")}</p></div>
      <div className="analytics-two-columns">
        <ReportCard cardId="analytics-funnel" title="Shopping journey">{cardData => <section className="analytics-card"><div className="analytics-section-heading"><div><h2>{t("Shopping journey")}</h2><p>{t("Unique sessions reaching each stage")}</p></div></div><div className="analytics-funnel">{cardData.funnel.map((step, i) => <div key={step.label}><span>{i + 1}</span><div><div><strong>{t(step.label)}</strong><b>{number(step.value)}</b></div><div className="analytics-bar"><i style={{
                      width: `${Math.min(100, cardData.funnel[0].value ? step.value / cardData.funnel[0].value * 100 : 0)}%`
                    }} /></div></div></div>)}</div><div className="analytics-inline-stat"><span>{t("Checkout sessions without an order")}</span><strong>{percent(cardData.metrics.checkoutAbandonment.value)}</strong></div><p className="analytics-footnote">{t("Stages show reach, not a strict sequence. Conversion uses orders linked to tracked sessions; cancelled and returned orders are excluded.")}</p></section>}</ReportCard>
        <ReportCard cardId="analytics-engagement" title="Engagement">{cardData => <section className="analytics-card"><div className="analytics-section-heading"><div><h2><TbActivity aria-hidden="true" />{t("Engagement")}</h2><p>{t("How shoppers interact with your store")}</p></div></div><div className="analytics-engagement"><div><strong>{percent(cardData.metrics.engagementRate.value)}</strong><span>{t("Engaged sessions")}</span></div><div><strong>{number(cardData.metrics.averageEngagement.value)}{t(" s")}</strong><span>{t("Average active time")}</span></div><div><strong>{number(cardData.metrics.productViews.value)}</strong><span>{t("Product views")}</span></div><div><strong>{number(cardData.metrics.adds.value)}</strong><span>{t("Cart additions")}</span></div><div><strong>{number(cardData.metrics.searches.value)}</strong><span>{t("Searches")}</span></div><div><strong>{number(cardData.metrics.repeatBuyers.value)}</strong><span>{t("Repeat buyers in period")}</span></div></div><p className="analytics-footnote">{t("Engagement means an active-time signal, cart addition, checkout or search. Active time is sampled every 30 seconds while the tab is visible and recently active.")}</p></section>}</ReportCard>
      </div>
      <div id="analytics-products" className="analytics-anchor" tabIndex={-1}><ProductPerformance products={data.products} /></div>
      <div id="analytics-audience" className="analytics-group-title analytics-anchor" tabIndex={-1}><h2>{t("Audience & acquisition")}</h2><p>{t("See where shoppers come from and what they explore.")}</p></div><div className="analytics-three-columns"><Breakdown kind="sources" title={t("Traffic sources")} description="Source at session entry" icon={TbWorld} rows={data.sources} /><Breakdown kind="devices" title={t("Devices")} description="Sessions by device" icon={TbDeviceMobile} rows={data.devices} formatLabel={label => label[0].toUpperCase() + label.slice(1)} /><Breakdown kind="pages" title={t("Popular pages")} description="Page views by store section" icon={TbEye} rows={data.pages} formatLabel={label => label[0].toUpperCase() + label.slice(1)} /><Breakdown kind="statuses" title={t("Order status")} description="Orders placed in the selected period" icon={TbShoppingBag} rows={data.statuses} formatLabel={label => label === "delivered" ? "Paid" : label[0].toUpperCase() + label.slice(1)} /></div>
      <div id="analytics-operations" className="analytics-group-title analytics-anchor" tabIndex={-1}><h2>{t("Store health & next steps")}</h2><p>{t("Keep inventory ready and turn your data into action.")}</p></div><div className="analytics-two-columns"><ReportCard cardId="analytics-inventory" title="Inventory health">{cardData => <section className="analytics-card"><div className="analytics-section-heading"><div><h2>{t("Inventory health")}</h2><p>{t("Current store inventory, independent of date range")}</p></div></div><div className="analytics-inventory">{[["Products", cardData.inventory.products], ["Units in stock", cardData.inventory.stock], ["Low stock", cardData.inventory.lowStock], ["Out of stock", cardData.inventory.outOfStock], ["Categories", cardData.inventory.categories], ["Customers in period", cardData.metrics.customers.value]].map(([label, value]) => <div key={label}><span>{t(label)}</span><strong>{number(value)}</strong></div>)}</div></section>}</ReportCard><ReportCard cardId="analytics-insights" title="Store insights">{cardData => <section className="analytics-card analytics-insights"><div className="analytics-section-heading"><div><h2>{t("Store insights")}</h2><p>{t("Useful signals from this report")}</p></div></div>{getInsights(cardData).map(text => <p key={text}><TbChartBar aria-hidden="true" /><span>{text}</span></p>)}</section>}</ReportCard></div>
      <details className="analytics-methodology"><summary>{t("About this report")}</summary><p>{t("Sales are grouped by order creation date. Net revenue includes recorded payments minus refunds and excludes cancelled or returned orders. Later refunds update the original order's period. This is store revenue, not profit.")}</p><p>{t("Traffic and engagement use anonymous browser sessions, renewed after 30 minutes of inactivity. They do not identify individual people. Views and clicks are client-reported and may be affected by blocking, bots or interrupted requests.")}</p><p>{t(data.trackingStartedAt ? `Activity tracking in this store begins ${new Date(data.trackingStartedAt).toLocaleDateString("en-BD", {
              timeZone: "Asia/Dhaka"
            })}.` : "No storefront activity has been tracked yet.")}{t(" Historical orders remain available; earlier traffic cannot be reconstructed. Devices are classified by viewport at session entry. Checkout abandonment is period-limited and may include shoppers who complete an order later.")}</p><p>{t("")}</p></details>
    </>}</QueryState>
  </div></CardResetProvider>;
}
