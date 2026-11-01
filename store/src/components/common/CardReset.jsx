import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbDotsVertical, TbRefresh } from "react-icons/tb";
import { useMerchantPanel } from "../../application/providers/MerchantPanelProvider";
import { request, errorMessage } from "../../services/api";

const CardResetContext = createContext(null);
export function CardResetProvider({ children, data, range, enabled = true }) {
  const { base } = useMerchantPanel();
  const states = useQuery({ queryKey: ["card-resets", base], queryFn: () => request("get", "/card-resets"), enabled, refetchInterval: 30000 });
  return <CardResetContext.Provider value={{ base, data, range, states, enabled }}>{children}</CardResetContext.Provider>;
}
function emptyReport(value) {
  if (typeof value === "number") return 0;
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === "range" ? entry : emptyReport(entry)]));
  return value;
}
export function useReportCard(cardId) {
  const context = useContext(CardResetContext);
  const resetAt = context?.states.data?.[cardId];
  const params = new URLSearchParams(context?.range || {}).toString();
  const report = useQuery({
    queryKey: ["card-report", context?.base, cardId, resetAt, params],
    queryFn: () => request("get", `/card-resets/${cardId}/report?${params}`),
    enabled: !!resetAt && cardId !== "analytics-live",
    refetchInterval: 30000,
  });
  return { data: resetAt ? report.data || emptyReport(context?.data) : context?.data, resetAt, error: report.error, loading: !!resetAt && report.isPending && cardId !== "analytics-live" };
}
export function CardResetMenu({ cardId, title }) {
  const context = useContext(CardResetContext);
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const root = useRef(null);
  const popup = useRef(null);
  const trigger = useRef(null);
  const option = useRef(null);
  const menuId = useId();
  const mutation = useMutation({
    mutationFn: () => request("post", `/card-resets/${cardId}`),
    onSuccess: result => {
      cache.setQueryData(["card-resets", context.base], current => ({ ...current, [cardId]: result.resetAt }));
      cache.invalidateQueries({ queryKey: ["card-report", context.base, cardId] });
      setOpen(false);
      trigger.current?.focus();
    },
  });
  useEffect(() => {
    if (!open) return;
    option.current?.focus();
    const outside = event => { if (!root.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", close); };
  }, [open]);
  if (!context?.enabled) return null;
  const resetAt = context.states.data?.[cardId];
  return <div className={`card-reset-control${open ? " is-open" : ""}`} ref={root} onClick={event => event.stopPropagation()}>
    <button type="button" ref={trigger} className="card-reset-trigger" aria-label={`Options for ${title}`} title={`Options for ${title}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={mutation.isPending || !context.states.isSuccess} onClick={() => {
      const bounds = trigger.current.getBoundingClientRect();
      setPosition({ left: Math.max(12, Math.min(bounds.right - 220, window.innerWidth - 232)), top: Math.max(12, Math.min(bounds.bottom + 6, window.innerHeight - 190)) });
      setOpen(current => !current);
    }}><TbDotsVertical aria-hidden="true" /></button>
    {open && createPortal(<div ref={popup} className="card-reset-menu" style={position} id={menuId} role="menu" aria-label={`${title} options`}><button ref={option} type="button" role="menuitem" disabled={mutation.isPending} onClick={() => mutation.mutate()}><TbRefresh aria-hidden="true" />{mutation.isPending ? "Resetting…" : "Reset card"}</button><p>{cardId === "analytics-live" ? "Reconnect the live feed." : "Start this card from zero. New activity will appear here."}</p>{resetAt && <small>Last reset {new Date(resetAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</small>}</div>, document.body)}
    {mutation.isError && <p className="card-reset-error" role="alert">{errorMessage(mutation.error)}</p>}
    {context.states.isError && <span className="card-reset-error" role="alert">Card controls unavailable</span>}
    <span className="card-reset-status" role="status">{mutation.isSuccess ? `${title} card reset.` : ""}</span>
  </div>;
}
export function ReportCard({ cardId, title, children }) {
  const report = useReportCard(cardId);
  const card = children(report.data);
  if (!card) return null;
  return React.cloneElement(card, { className: `${card.props.className || ""} card-reset-surface`, "data-report-card": cardId, "aria-busy": report.loading }, <>
    <CardResetMenu cardId={cardId} title={title} />
    {report.error && <p className="error" role="alert">Unable to load this card. Please refresh.</p>}
    {card.props.children}
  </>);
}
