import { CardResetMenu, useReportCard } from "../../../components/common/CardReset";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useEffect, useState } from "react";
import { TbActivity, TbUsers, TbEye, TbPackage } from "react-icons/tb";
import { useAuth } from "../../../application/providers/AuthProvider";
import { connectLive } from "../liveConnection";
const labels = {
  home: "Home",
  products: "Product catalog",
  product: "Product details",
  category: "Category",
  cart: "Cart",
  checkout: "Checkout",
  orders: "Orders",
  account: "Account",
  auth: "Sign in / register",
  other: "Other pages"
};
export function LiveVisitors() {
  const {
    t
  } = usePageTranslation();
  const {
    user
  } = useAuth();
  const { resetAt } = useReportCard("analytics-live");
  const [status, setStatus] = useState("connecting");
  const [snapshot, setSnapshot] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setSnapshot(null);
    const connection = connectLive({
      ticketPath: "/analytics/live-ticket",
      staleAfter: 15000,
      onStatus: setStatus,
      onMessage: message => {
        if (message.type === "snapshot") {
          setSnapshot({
            ...message,
            receivedAt: Date.now()
          });
          setStatus("connected");
        }
        if (message.type === "unavailable") setStatus("unavailable");
      }
    });
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      connection.close();
      clearInterval(timer);
    };
  }, [user?._id, user?.tenantId, resetAt]);
  const live = status === "connected" && snapshot && now - snapshot.receivedAt < 15000;
  return <section className="analytics-card analytics-live card-reset-surface" data-report-card="analytics-live" aria-labelledby="live-visitors-title"><CardResetMenu cardId="analytics-live" title="Live visitors" />
    <div className="analytics-section-heading"><div><h2 id="live-visitors-title"><TbActivity aria-hidden="true" />{t("Live visitors")}</h2><p>{t("Who is browsing your store right now")}</p></div><span className={`analytics-live-status ${live ? "is-live" : ""}`} role="status"><i />{t(live ? "Live" : status === "connecting" ? "Connecting?" : "Reconnecting?")}</span></div>
    <div className="analytics-live-grid">
      <div className="analytics-live-total"><TbUsers aria-hidden="true" /><strong>{t(live ? snapshot.total : "?")}</strong><span>{t("active visitors")}</span><small>{t(live ? "Updated every few seconds" : "Waiting for a live connection")}</small></div>
      <div className="analytics-live-list"><h3><TbEye aria-hidden="true" />{t("By page")}<span>{t("Visitors")}</span></h3>{t(live ? snapshot.pages.length ? snapshot.pages.map(row => <div className="analytics-live-row" key={row.page}><span>{labels[row.page] || "Other pages"}</span><strong>{row.count}</strong><i style={{
            width: `${row.count / Math.max(1, snapshot.total) * 100}%`
          }} /></div>) : <p className="analytics-live-empty">{t("No active visitors yet. Page activity will appear here.")}</p> : <p className="analytics-live-empty">{t("Live page counts will appear when connected.")}</p>)}</div>
      <div className="analytics-live-list"><h3><TbPackage aria-hidden="true" />{t("Viewing products")}<span>{t("Visitors")}</span></h3>{t(live ? snapshot.products.length ? snapshot.products.map(row => <div className="analytics-live-row" key={row.id}><span title={row.name}>{row.name}</span><strong>{row.count}</strong><i style={{
            width: `${row.count / Math.max(1, snapshot.total) * 100}%`
          }} /></div>) : <p className="analytics-live-empty">{t("No products being viewed right now.")}</p> : <p className="analytics-live-empty">{t("Live product counts will appear when connected.")}</p>)}</div>
    </div>
    <p className="analytics-footnote">{t("Counts active browsers, not identified people. Visible tabs with activity in the last 5 minutes count once per browser, using its most recently reported page. Live counts are independent of the date filter.")}</p>
  </section>;
}
