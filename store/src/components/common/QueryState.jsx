import { usePageTranslation } from "../../features/language/AdminLanguageProvider";
import React from "react";
import { errorMessage } from "../../services/api";
export function QueryState({
  query,
  children,
  empty = false
}) {
  const {
    t
  } = usePageTranslation();
  if (query.isPending) return <div className="state-card" role="status">
        <span className="spinner" />{t("Loading...")}</div>;
  if (query.isError) return <div className="state-card" role="alert">
        <h2>{t("Unable to load this page")}</h2>
        <p>{errorMessage(query.error)}</p>
        <button className="btn-primary" onClick={() => query.refetch()}>{t("Retry")}</button>
      </div>;
  if (empty) return <div className="state-card">
        <h2>{t("No results found")}</h2>
        <p>{t("Try changing your search or filters.")}</p>
      </div>;
  return children;
}
export const money = value => `৳${new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value || 0)}`;
