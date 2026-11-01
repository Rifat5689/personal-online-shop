import { usePageTranslation } from "../../../features/language/AdminLanguageProvider";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { useManagementPage } from "../../../features/management/hooks/useManagementPage";
import { QueryState, money } from "../../../components/common/QueryState";
import { Pagination } from "../../../components/common/Pagination";
export default function Customers() {
  const {
    t
  } = usePageTranslation();
  const hook = useManagementPage("customers", "/orders/customers");
  const {
    id,
    storeSlug
  } = useParams();
  const customer = hook.query.data?.find(item => item._id === id);
  return <>
      <div className="dashboard-header">
        <div>
          <h1>{t("Customers")}</h1>
          <p>{t("Customers who placed orders in your store.")}</p>
        </div>
      </div>
      <QueryState query={hook.query}>
        {t(id ? customer ? <section className="card form-stack">
              <h2>{customer.name}</h2>
              <p>{t("Phone: ")}{customer._id}</p>
              <p>{customer.address}</p>
              <p>
                {customer.orders}{t(" orders · ")}{money(customer.total)}{t(" ordered")}</p>
            </section> : <p className="state-card">{t("Customer not found.")}</p> : <>
            <div className="filters">
              <label>{t("Search")}<input value={hook.search} onChange={event => hook.setSearch(event.target.value)} placeholder={t("Search customers...")} />
              </label>
            </div>
            <div className="card table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th data-align="left">{t("Name")}</th>
                    <th data-align="center">{t("Phone")}</th>
                    <th data-align="center">{t("Orders")}</th>
                    <th data-align="center">{t("Total Ordered")}</th>
                    <th data-align="center">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hook.rows.map(item => <tr key={item._id}>
                      <td>{item.name}</td>
                      <td>{item._id}</td>
                      <td>{item.orders}</td>
                      <td>{money(item.total)}</td>
                      <td>
                        <Link to={`/secure/admin/customers/${encodeURIComponent(item._id)}`}>{t("View Details →")}</Link>
                      </td>
                    </tr>)}
                </tbody>
              </table>
              {!hook.rows.length && <p className="state-card">{t("No customers yet.")}</p>}
            </div>
            <Pagination {...hook} />
          </>)}
      </QueryState>
    </>;
}
