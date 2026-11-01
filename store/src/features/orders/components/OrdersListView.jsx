import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useState } from "react";
import { TbAdjustmentsHorizontal, TbSearch, TbClock, TbEye, TbPackage } from "react-icons/tb";
import { QueryState, money } from "../../../components/common/QueryState";
import { Pagination } from "../../../components/common/Pagination";
import { transitions, orderStatusLabel } from "../hooks/useOrdersPage";
import { paymentLabel } from "./RefundOrderDialog";
import { OrderActions } from "./OrderActions";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
export function OrdersListView({
  hook
}) {
  const {
    t
  } = usePageTranslation();
  const [detailsId, setDetailsId] = useState(null);
  return <div className="admin-orders-page">
      <div className="dashboard-header">
        <div>
          <h1 className="admin-overview-title"><TbPackage aria-hidden="true" />{t("Orders")}</h1>
          <p>{t("Manage customer orders and delivery.")}</p>
        </div>
      </div>
      <section className="store-reference-card admin-orders-card" aria-label={t("Order management")}>
        <div className="admin-orders-section-heading">
          <h2>{t("All orders")}</h2>
          <span>{hook.query.data?.length ?? hook.rows.length}{t(" orders")}</span>
        </div>
        <div className="admin-orders-toolbar">
          <label className="admin-orders-search">
            <span className="sr-only">{t("Search orders")}</span>
            <TbSearch aria-hidden="true" />
            <input placeholder={t("Search orders…")} value={hook.search} onChange={event => hook.setSearch(event.target.value)} />
          </label>
          <label className="admin-orders-filter">
            <span className="sr-only">{t("Order status")}</span>
            <select aria-label={t("Order status")} value={hook.status} onChange={event => hook.setStatus(event.target.value)}>
              <option value="">{t("All statuses")}</option>
              {Object.keys(transitions).map(status => <option key={status} value={status}>
                  {t(orderStatusLabel(status))}
                </option>)}
            </select>
          </label>
        </div>
        <QueryState query={hook.query}>
          <div className="store-reference-table-scroll">
            <table className="store-reference-table admin-orders-table">
              <thead>
                <tr>
                  <th data-align="left">{t("Order ID")}</th>
                  <th data-align="center">{t("Amount")}</th>
                  <th className="orders-status-column" data-align="center">{t("Status")}</th>
                  <th className="admin-orders-extra" data-align="center">{t("Date")}</th>
                  <th className="orders-actions-column" data-align="center">
                    <span className="admin-orders-actions-label">{t("Actions")}</span>
                    <TbAdjustmentsHorizontal className="admin-orders-actions-heading" aria-hidden="true" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {hook.rows.map(item => <tr key={item._id}>
                    <td>
                      <button type="button" className="admin-orders-id" aria-label={`Order ${item._id.slice(-8)}`} aria-haspopup="dialog" onClick={() => setDetailsId(item._id)}>
                        #{item._id.slice(-8)}
                      </button>
                    </td>
                    <td className="store-reference-amount">
                      {money(item.totalPrice)}
                      {(item.refundedAmount || 0) > 0 && <small className="order-refund-label">{t(paymentLabel(item))}</small>}
                    </td>
                    <td className="orders-status-column">
                      <span className={`store-reference-status ${String(item.status || "pending").toLowerCase()}`}>
                        <TbClock aria-hidden="true" />
                        {t(orderStatusLabel(item.status))}
                      </span>
                    </td>
                    <td className="admin-orders-extra">
                      {t(item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }) : "—")}
                    </td>
                    <td className="orders-actions-column">
                      <div className="admin-orders-row-actions">
                        <button type="button" className="admin-orders-action" title={t("Details")} aria-label={`View details for order ${item._id.slice(-8)}`} aria-haspopup="dialog" onClick={() => setDetailsId(item._id)}>
                          <TbEye aria-hidden="true" />
                        </button>
                        <OrderActions order={item} mutation={hook.mutation} onViewDetails={() => setDetailsId(item._id)} />
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
            {!hook.rows.length && <p className="store-reference-empty">{t("No orders found.")}</p>}
          </div>
          <Pagination {...hook} />
        </QueryState>
      </section>
      {detailsId && <OrderDetailsDialog key={detailsId} orderId={detailsId} onClose={() => setDetailsId(null)} />}
    </div>;
}
