import { usePageTranslation } from "../../features/language/AdminLanguageProvider";
import React from "react";
export function Pagination({
  page,
  pages,
  setPage
}) {
  const {
    t
  } = usePageTranslation();
  return <div className="pagination">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button>
      <span>{t("Page ")}{page}{t(" of ")}{pages}
      </span>
      <button disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next")}</button>
    </div>;
}
