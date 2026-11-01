import { usePageTranslation } from "../../../features/language/AdminLanguageProvider";
import React, { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbPhone, TbShoppingBag, TbUserCheck, TbUser, TbEye, TbX } from "react-icons/tb";
import { request } from "../../../services/api";
import { QueryState, money } from "../../../components/common/QueryState";
import LoadingSpinner from "../../../shared/components/LoadingSpinner";
function CustomerDetails({
  item,
  type,
  onClose
}) {
  const {
    t
  } = usePageTranslation();
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} className="customer-details-dialog" aria-labelledby={titleId} onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header><h2 id={titleId}>{t("Customer details")}</h2><button type="button" aria-label={t("Close customer details")} onClick={onClose}><TbX aria-hidden="true" /></button></header>
    <dl><div><dt>{t("Customer")}</dt><dd>{item.name || item.username}</dd></div>
      {item.username && <div><dt>{t("Username")}</dt><dd>@{item.username}</dd></div>}
      {t(type === "ordered" ? <>
        <div><dt>{t("Phone")}</dt><dd>{item._id}</dd></div><div><dt>{t("Orders")}</dt><dd>{item.orders}</dd></div>
        <div><dt>{t("Total ordered")}</dt><dd>{money(item.total)}</dd></div><div><dt>{t("Last address")}</dt><dd>{item.address || "Not provided"}</dd></div>
      </> : <>
        <div><dt>{t("Phone")}</dt><dd>{item.phone || "Not provided"}</dd></div>
        <div><dt>{t("First signed in")}</dt><dd>{new Date(item.createdAt).toLocaleDateString("en-BD", {
              timeZone: "Asia/Dhaka"
            })}</dd></div>
        <div><dt>{t("Last seen")}</dt><dd>{new Date(item.lastSeenAt).toLocaleString("en-BD", {
              timeZone: "Asia/Dhaka"
            })}</dd></div>
        <div><dt>{t("Identity")}</dt><dd>{t("Browser sign-in")}</dd></div>
      </>)}
    </dl>
  </dialog>;
}
export default function ProfessionalCustomers() {
  const {
    t
  } = usePageTranslation();
  const [details, setDetails] = useState(null);
  const [tab, setTab] = useState("ordered");
  const [search, setSearch] = useState("");
  const ordered = useQuery({
    queryKey: ["customers", "ordered"],
    queryFn: () => request("get", "/orders/customers")
  });
  const signed = useQuery({
    queryKey: ["customers", "signed"],
    queryFn: () => request("get", "/customers/signed")
  });
  const query = tab === "ordered" ? ordered : signed;
  const rows = (query.data || []).filter(item => [item.name, item.username, item._id].filter(Boolean).some(value => String(value).toLowerCase().includes(search.toLowerCase())));
  return <div className="admin-customers-page">
      {details && <CustomerDetails item={details.item} type={details.type} onClose={() => setDetails(null)} />}
      <div className="dashboard-header">
        <div>
          <h1>{t("Customers")}</h1>
          <p>{t("View customers identified by an order or by signing in to this store.")}</p>
        </div>
      </div>
      <div className="customer-tabs" role="tablist" aria-label={t("Customer type")}>
        <button className={tab === "ordered" ? "active" : ""} onClick={() => setTab("ordered")}>
          <TbShoppingBag />{t("Ordered customers")}<span>{ordered.data?.length || 0}</span>
        </button>
        <button className={tab === "signed" ? "active" : ""} onClick={() => setTab("signed")}>
          <TbUserCheck />{t("Signed-in customers")}<span>{signed.data?.length || 0}</span>
        </button>
      </div>
      <div className="filters">
        <label>{t("Search")}<input value={search} onChange={event => setSearch(event.target.value)} placeholder={tab === "ordered" ? "Search name or phone..." : "Search username..."} />
        </label>
      </div>
      {t(query.isPending ? <LoadingSpinner label="Loading customers..." /> : <QueryState query={query} empty={!rows.length}>
          <div className="card table-container">
            <table className="table admin-customers-table">
              <thead>
                {t(tab === "ordered" ? <tr>
                    <th data-align="left">{t("Customer")}</th>
                    <th data-align="center">{t("Phone")}</th>
                    <th className="customer-desktop-cell" data-align="center">{t("Orders")}</th>
                    <th className="customer-desktop-cell" data-align="center">{t("Total Ordered")}</th>
                    <th className="customer-desktop-cell" data-align="left">{t("Last Address")}</th>
                    <th className="customer-details-cell" data-align="center">{t("Details")}</th>
                  </tr> : <tr>
                    <th data-align="left">{t("Customer")}</th>
                    <th className="customer-mobile-cell" data-align="center">{t("Last seen")}</th>
                    <th className="customer-desktop-cell" data-align="center">{t("First Signed In")}</th>
                    <th className="customer-desktop-cell" data-align="center">{t("Last Seen")}</th>
                    <th className="customer-desktop-cell" data-align="center">{t("Identity")}</th>
                    <th className="customer-details-cell" data-align="center">{t("Details")}</th>
                  </tr>)}
              </thead>
              <tbody>
                {rows.map(item => tab === "ordered" ? <tr key={item._id}>
                      <td>
                        <span className="customer-name">
                          <TbUser aria-hidden="true" />
                          <span className="customer-display-name" title={item.name}>{item.name}</span>
                          {item.username && <small>@{item.username}</small>}
                        </span>
                      </td>
                      <td>
                        <span className="customer-phone">
                          <TbPhone />
                          {item._id}
                        </span>
                      </td>
                      <td className="customer-desktop-cell">{item.orders}</td>
                      <td className="customer-desktop-cell">{money(item.total)}</td>
                      <td className="customer-desktop-cell">{item.address}</td>
                      <td><button type="button" className="admin-orders-action" aria-label={`View details for ${item.name}`} aria-haspopup="dialog" title={t("Details")} onClick={() => setDetails({
                  item,
                  type: tab
                })}><TbEye aria-hidden="true" /></button></td>
                    </tr> : <tr key={item._id}>
                      <td>
                        <span className="customer-name">
                          <TbUser aria-hidden="true" />
                          <span className="customer-display-name" title={item.username}>{item.username}</span>
                        </span>
                      </td>
                      <td className="customer-mobile-cell">{t(item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "short",
                  timeStyle: "short"
                }) : "Not available")}</td>
                      <td className="customer-desktop-cell">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="customer-desktop-cell">{new Date(item.lastSeenAt).toLocaleString()}</td>
                      <td className="customer-desktop-cell">
                        <span className="status-badge status-active">{t("Browser sign-in")}</span>
                      </td>
                      <td><button type="button" className="admin-orders-action" aria-label={`View details for ${item.username}`} aria-haspopup="dialog" title={t("Details")} onClick={() => setDetails({
                  item,
                  type: tab
                })}><TbEye aria-hidden="true" /></button></td>
                    </tr>)}
              </tbody>
            </table>
          </div>
        </QueryState>)}
    </div>;
}
