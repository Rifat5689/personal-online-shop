import { CardResetProvider, ReportCard } from "../../../components/common/CardReset";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { useMerchantPanel } from "../../../application/providers/MerchantPanelProvider";
import { StatCardWave } from "../../../components/common/StatCardWave";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { QueryState, money } from "../../../components/common/QueryState";
import { TbBox, TbEye, TbChevronRight, TbChevronDown, TbClock, TbCoins, TbFileText, TbShoppingCart, TbUsers, TbHomeStats } from "react-icons/tb";
import { OrderDetailsDialog } from "../../orders/components/OrderDetailsDialog";
function StoreDashboardSections({
  days
}) {
  const {
    t
  } = usePageTranslation();
  const {
    base
  } = useMerchantPanel();
  const [detailsId, setDetailsId] = useState(null);
  return <div className="store-dashboard-reference">
      <ReportCard cardId="overview-statistics" title="Statistics">{cardData => <section className="store-reference-card">
        <h2>{t("Statistics")}</h2>
        <RevenueChart daily={cardData.daily} days={days} />
        <p className="statistics-caption">{t("Revenue · Last ")}{days}{t(" days")}</p>
      </section>}</ReportCard>
      <ReportCard cardId="overview-recent-orders" title="Recent Orders">{cardData => <section className="store-reference-card">
        <div className="store-reference-heading">
          <div>
            <h2>{t("Recent Orders")}</h2>
            <p>{t("Your latest customer orders")}</p>
          </div>
          <Link to={`${base}/orders`}>{t("View All")}<TbChevronRight aria-hidden="true" />
          </Link>
        </div>
        <div className="store-reference-table-scroll">
          <table className="store-reference-table recent-orders-table">
            <thead>
              <tr>
                <th data-align="left">{t("Order ID")}</th>
                <th data-align="center">{t("Price")}</th>
                <th data-align="center">{t("Date")}</th>
                <th className="store-reference-actions-cell" data-align="center">
                  <span className="recent-orders-actions-label">{t("Details")}</span>
                  <TbEye className="recent-orders-actions-icon" aria-hidden="true" />
                </th>
              </tr>
            </thead>
            <tbody>
              {cardData.recentOrders?.map(order => <tr key={order._id}>
                  <td>
                    <button type="button" className="recent-order-id-button" aria-label={`Order ${order._id.slice(-8)}`} aria-haspopup="dialog" onClick={() => setDetailsId(order._id)}>
                      #{order._id.slice(-8)}
                    </button>
                  </td>
                  <td className="store-reference-amount">
                    {money(order.totalPrice)}
                  </td>
                  <td className="recent-orders-date-cell">
                    {t(order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                }) : "—")}
                  </td>
                  <td className="store-reference-actions-cell">
                    <button type="button" className="admin-orders-action" aria-label={`View details for order ${order._id.slice(-8)}`} title={t("Details")} aria-haspopup="dialog" onClick={() => setDetailsId(order._id)}>
                      <TbEye aria-hidden="true" />
                    </button>
                  </td>
                </tr>)}
            </tbody>
          </table>
          {!cardData.recentOrders?.length && <p className="store-reference-empty">{t("No orders yet.")}</p>}
        </div>
      </section>}</ReportCard>
      {detailsId && <OrderDetailsDialog key={detailsId} orderId={detailsId} onClose={() => setDetailsId(null)} />}
    </div>;
}
function PeriodSelector({
  days,
  onChange
}) {
  const {
    t
  } = usePageTranslation();
  return <div className="dashboard-date-picker statistics-date-picker">
      <TbClock className="date-picker-icon" aria-hidden="true" />
      <select id="dashboard-range" value={days} onChange={event => onChange(event.target.value)} aria-label={t("Statistics period")}>
        <option value="7">{t("Last 7 days")}</option>
        <option value="30">{t("Last 30 days")}</option>
      </select>
      <TbChevronDown className="date-picker-chevron" aria-hidden="true" />
    </div>;
}
function RevenueChart({
  daily = [],
  days = "30"
}) {
  const {
    t
  } = usePageTranslation();
  const gradientId = React.useId();
  const [activeDay, setActiveDay] = useState(null);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const end = new Date(`${today}T12:00:00Z`);
  const dailyMap = new Map(daily.map(day => [day._id, day]));
  const series = Array.from({
    length: Number(days)
  }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - Number(days) + 1 + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      revenue: Number(dailyMap.get(key)?.revenue || 0)
    };
  });
  const peak = Math.max(1, ...series.map(day => day.revenue));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / magnitude) * magnitude;
  const coordinates = series.map((day, index) => ({
    x: 12 + index * 576 / (series.length - 1),
    y: 176 - day.revenue / ceiling * 160
  }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const selected = series.find(day => day.date === activeDay);
  const selectedIndex = series.findIndex(day => day.date === activeDay);
  const total = series.reduce((sum, day) => sum + day.revenue, 0);
  const formatValue = value => new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);
  const formatDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-BD", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dhaka"
  });
  return <div className="revenue-trend">
      <div className="revenue-trend-heading">
        <div><span>{t(selected ? formatDate(selected.date) : "Collected revenue")}</span><strong>{new Intl.NumberFormat("en-BD", {
            maximumFractionDigits: 2
          }).format(selected ? selected.revenue : total)} <small>{t("BDT")}</small></strong></div>
        <span className="revenue-trend-legend"><i />{t("Revenue")}</span>
      </div>
      <div className="revenue-trend-chart">
        <div className="revenue-trend-axis" aria-hidden="true">{[1, .75, .5, .25, 0].map(fraction => <span key={fraction}>{formatValue(ceiling * fraction)}</span>)}</div>
        <div className="revenue-trend-plot" onMouseLeave={() => setActiveDay(null)}>
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label={`Daily collected revenue over the last ${days} days in BDT. Total ${formatValue(total)}.`}>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".22" /><stop offset="100%" stopColor="#10b981" stopOpacity=".015" /></linearGradient></defs>
            {[16, 56, 96, 136, 176].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e8eef3" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />)}
            <path d={`${line} L588,176 L12,176 Z`} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {selectedIndex >= 0 && <line x1={coordinates[selectedIndex].x} x2={coordinates[selectedIndex].x} y1="12" y2="176" stroke="#059669" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="revenue-trend-targets">{series.map(day => <button key={day.date} type="button" aria-label={`${formatDate(day.date)}: ${day.revenue} BDT`} onFocus={() => setActiveDay(day.date)} onBlur={() => setActiveDay(null)} onMouseEnter={() => setActiveDay(day.date)} onClick={() => setActiveDay(day.date)} className={day.date === activeDay ? "active" : ""}><span /></button>)}</div>
        </div>
        <div className="revenue-trend-dates" aria-hidden="true">{[0, Math.floor(series.length / 2), series.length - 1].map(index => <span key={index}>{formatDate(series[index].date)}</span>)}</div>
      </div>
      {!daily.length && <p className="revenue-trend-empty">{t("No orders in this period")}</p>}
    </div>;
}
function StoreStatus({
  data
}) {
  const {
    t
  } = usePageTranslation();
  const total = Math.max(1, data.totalStores || 0);
  const active = data.storeStatus?.find(item => item._id === "ACTIVE")?.total || 0;
  const inactive = data.storeStatus?.find(item => item._id === "INACTIVE")?.total || 0;
  return <section className="card">
      <h2>{t("Store Status")}</h2>
      <div className="status-chart">
        <div className="donut" style={{
        background: `conic-gradient(#0a9fe8 0 ${active / total * 100}%, #ffb54a ${active / total * 100}% ${(active + inactive) / total * 100}%, #ed6679 ${(active + inactive) / total * 100}% 100%)`
      }}>
          <div>
            <strong>{data.totalStores || 0}</strong>
            <small>{t("Total Stores")}</small>
          </div>
        </div>
        <ul>
          {["ACTIVE", "INACTIVE", "SUSPENDED"].map((status, i) => <li key={status}>
              <span style={{
            background: ["#0a9fe8", "#ffb54a", "#ed6679"][i]
          }} />
              {status.toLowerCase()}{" "}
              <strong>
                {data.storeStatus?.find(item => item._id === status)?.total || 0}
              </strong>
            </li>)}
        </ul>
      </div>
    </section>;
}
export function DashboardView({
  platform = false
}) {
  const {
    t
  } = usePageTranslation();
  const {
    storeSlug,
    base
  } = useMerchantPanel();
  const [days, setDays] = useState("30");
  const query = useDashboard(days);
  const data = query.data || {};
  const compactNumber = value => new Intl.NumberFormat("en-BD", {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value || 0);
  const stats = platform ? [{
    id: "stores",
    label: "Total Stores",
    value: data.totalStores ?? 0,
    icon: TbBox,
    iconBg: "#ecfdf5",
    iconColor: "#059669",
    waveColor: "#10b981"
  }, {
    id: "admins",
    label: "Store Admins",
    value: data.admins ?? 0,
    icon: TbUsers,
    iconBg: "#eff6ff",
    iconColor: "#2563eb",
    waveColor: "#3b82f6"
  }, {
    id: "customers",
    label: "Total Customers",
    value: data.totalCustomers ?? 0,
    icon: TbUsers,
    iconBg: "#f5f3ff",
    iconColor: "#7c3aed",
    waveColor: "#8b5cf6"
  }, {
    id: "revenue",
    label: "Total Revenue",
    value: compactNumber(data.totalRevenue),
    fullValue: new Intl.NumberFormat("en-BD").format(data.totalRevenue || 0),
    icon: TbCoins,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    waveColor: "#f59e0b"
  }, {
    id: "pending",
    label: "Pending Orders",
    value: data.pendingOrders ?? 0,
    icon: TbFileText,
    iconBg: "#fee2e2",
    iconColor: "#ef4444",
    waveColor: "#ef4444"
  }, {
    id: "views",
    label: "Total Views",
    value: compactNumber(data.totalViews),
    fullValue: new Intl.NumberFormat("en-BD").format(data.totalViews || 0),
    icon: TbEye,
    iconBg: "#ecfeff",
    iconColor: "#0891b2",
    waveColor: "#06b6d4"
  }] : [{
    id: "products",
    label: "Total Products",
    value: data.products ?? 0,
    icon: TbBox,
    iconBg: "#ecfdf5",
    iconColor: "#059669",
    waveColor: "#10b981"
  }, {
    id: "orders",
    label: "Total Orders",
    value: data.totalOrders ?? 0,
    icon: TbShoppingCart,
    iconBg: "#eff6ff",
    iconColor: "#2563eb",
    waveColor: "#3b82f6"
  }, {
    id: "customers",
    label: "Total Customers",
    value: data.totalCustomers ?? 0,
    icon: TbUsers,
    iconBg: "#f5f3ff",
    iconColor: "#7c3aed",
    waveColor: "#8b5cf6"
  }, {
    id: "revenue",
    label: "Total Revenue",
    value: compactNumber(data.totalRevenue),
    fullValue: new Intl.NumberFormat("en-BD").format(data.totalRevenue || 0),
    icon: TbCoins,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    waveColor: "#f59e0b"
  }, {
    id: "pending",
    label: "Pending Orders",
    value: data.pendingOrders ?? 0,
    icon: TbFileText,
    iconBg: "#fee2e2",
    iconColor: "#ef4444",
    waveColor: "#ef4444"
  }, {
    id: "views",
    label: "Total Views",
    value: compactNumber(data.totalViews),
    fullValue: new Intl.NumberFormat("en-BD").format(data.totalViews || 0),
    icon: TbEye,
    iconBg: "#ecfeff",
    iconColor: "#0891b2",
    waveColor: "#06b6d4"
  }];
  return <CardResetProvider data={data} range={{ days }} enabled={!platform}>
      <div className="dashboard-header admin-overview-header">
        <div>
          <h1 className="admin-overview-title"><TbHomeStats aria-hidden="true" />{t("Overview")}</h1>
        </div>
        <div className="row dashboard-actions">
          <PeriodSelector days={days} onChange={setDays} />
        </div>
      </div>
      <QueryState query={query}>
        <div className="stats-grid">
          {stats.filter(stat => stat.id !== "views" || data.analyticsAllowed !== false).map(stat => {
          const Icon = stat.icon;
          return <ReportCard key={stat.id} cardId={`overview-${stat.id}`} title={stat.label}>{cardData => {
            const field = { stores: "totalStores", admins: "admins", products: "products", orders: "totalOrders", customers: "totalCustomers", revenue: "totalRevenue", pending: "pendingOrders", views: "totalViews" }[stat.id];
            const value = cardData[field] || 0;
            return <div className={`stat-card stat-card-${stat.id}`}>
                <div className="stat-card-icon-box" style={{
              backgroundColor: stat.iconBg,
              color: stat.iconColor
            }} aria-hidden="true">
                  <Icon />
                </div>
                <div className="stat-card-info">
                  <p className="stat-card-label">{t(stat.label)}</p>
                  <strong className="stat-card-value" title={new Intl.NumberFormat("en-BD").format(value)}>
                    {["revenue", "views"].includes(stat.id) ? compactNumber(value) : value}
                  </strong>
                </div>
                <StatCardWave color={stat.waveColor} id={stat.id} />
              </div>;
          }}</ReportCard>;
        })}
        </div>
        {!platform && data.lowStockProducts > 0 && <ReportCard cardId="overview-attention" title="Needs attention">{cardData => <section className="overview-attention" aria-labelledby="attention-heading">
            <h2 id="attention-heading">{t("Needs attention")}</h2>
            <div className="overview-attention-links">
              <Link to={`${base}/orders?status=pending`}>
                <span className="attention-icon orders"><TbClock aria-hidden="true" /></span>
                <span><strong>{cardData.pendingOrders ?? 0}{t(" pending orders")}</strong><small>{t(cardData.pendingOrders ? "Review and confirm orders" : "You're up to date")}</small></span>
                <TbChevronRight aria-hidden="true" />
              </Link>
              <Link to={`${base}/products?stock=attention`}>
                <span className="attention-icon stock"><TbBox aria-hidden="true" /></span>
                <span><strong>{cardData.lowStockProducts ?? 0}{t(" low-stock products")}</strong><small>{t("Published products with fewer than 10 left")}</small></span>
                <TbChevronRight aria-hidden="true" />
              </Link>
            </div>
          </section>}</ReportCard>}
        {!platform && <StoreDashboardSections data={data} storeSlug={storeSlug} days={days} />}
        <div className={`dashboard-bottom-sections${platform ? "" : " store-dashboard-legacy"}`}>
          <div className={platform ? "platform-charts-grid" : "charts-grid"}>
            <section className="card">
              <h2>{t("Revenue Overview")}</h2>
              <p className="muted">{t("Collected revenue from orders placed in the last ")}{days}{t(" days")}</p>
              <RevenueChart daily={data.daily} days={days} />
            </section>
            {platform && <>
                <section className="card">
                  <div className="section-heading">
                    <h2>{t("Top Stores by Revenue")}</h2>
                    <Link to="/stores">{t("View All →")}</Link>
                  </div>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th data-align="left">{t("Store")}</th>
                          <th data-align="center">{t("Revenue")}</th>
                          <th data-align="center">{t("Orders")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topStores?.map(item => <tr key={item._id}>
                            <td>
                              <Link to={`/stores/${item._id}`}>
                                {item.store.name}
                              </Link>
                            </td>
                            <td>{money(item.revenue)}</td>
                            <td>{item.orders}</td>
                          </tr>)}
                      </tbody>
                    </table>
                    {!data.topStores?.length && <p className="muted">{t("No collected revenue yet.")}</p>}
                  </div>
                </section>
                <StoreStatus data={data} />
              </>}
            {!platform && <section className="card">
                <h2>{t("Quick Actions")}</h2>
                <div className="quick-actions">
                  <Link to={`${base}/products/create`}>{t("+ Add Product")}</Link>
                  <Link to={`${base}/orders`}>{t("Manage Orders")}</Link>
                  <Link to={`${base}/settings`}>{t("Settings")}</Link>
                </div>
              </section>}
          </div>
          {platform && <div className="charts-grid">
              <section className="card">
                <h2>{t("Recent Stores")}</h2>
                {data.recentStores?.map(store => <div className="summary-line" key={store._id}>
                    <div>
                      <Link to={`/stores/${store._id}`}>{store.name}</Link>
                      <p className="muted">{t("Created ")}{" "}
                        {new Date(store.createdAt).toLocaleDateString("en-BD")}
                      </p>
                    </div>
                    <span className={`status-badge status-${store.status.toLowerCase()}`}>
                      {store.status}
                    </span>
                  </div>)}
                {!data.recentStores?.length && <p className="muted">{t("No stores yet.")}</p>}
              </section>
              <section className="card">
                <h2>{t("Quick Actions")}</h2>
                <div className="quick-actions">
                  <Link to="/stores/create">{t("+ Create Store")}</Link>
                  <Link to="/admins/create">{t("Add Admin")}</Link>
                  <Link to="/settings">{t("Settings")}</Link>
                </div>
              </section>
            </div>}
          <section className="card">
            <h2>{t("Recent Orders")}</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th data-align="left">{t("Order")}</th>
                    <th data-align="left">{t("Customer")}</th>
                    <th data-align="center">{t("Amount")}</th>
                    <th data-align="center">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders?.map(order => <tr key={order._id}>
                      <td>
                        {t(platform ? order._id.slice(-8) : <Link to={`${base}/orders/${order._id}`}>
                            {order._id.slice(-8)}
                          </Link>)}
                      </td>
                      <td>{order.shippingDetails?.name}</td>
                      <td>{money(order.totalPrice)}</td>
                      <td>
                        <span className="status-badge">{t(order.status === "delivered" ? "Paid" : order.status)}</span>
                      </td>
                    </tr>)}
                </tbody>
              </table>
              {!data.recentOrders?.length && <p className="state-card">{t("No orders yet.")}</p>}
            </div>
          </section>
        </div>
      </QueryState>
    </CardResetProvider>;
}
