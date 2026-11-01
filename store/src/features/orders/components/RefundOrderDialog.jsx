import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TbReceiptRefund, TbX } from "react-icons/tb";
import { request, errorMessage } from "../../../services/api";
import { money } from "../../../components/common/QueryState";
export const canRefund = order => order && !["cancelled", "returned"].includes(order.status) && ["paid", "partially_refunded"].includes(order.payment?.paymentStatus);
export const paymentLabel = order => ({
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded"
})[order.payment?.paymentStatus] || "Payment pending";
export function RefundOrderDialog({
  order,
  onClose
}) {
  const {
    t
  } = usePageTranslation();
  const dialog = useRef(null);
  const requestKey = useRef(crypto.randomUUID());
  const titleId = useId();
  const client = useQueryClient();
  const [quantities, setQuantities] = useState({});
  const [includeShipping, setIncludeShipping] = useState(false);
  const [reason, setReason] = useState("");
  const remainingShipping = Math.max(0, order.shippingFee - (order.refundedShippingFee || 0));
  const items = order.orderItems.filter(item => item.quantity > (item.refundedQuantity || 0));
  const selectedItems = items.filter(item => quantities[item.productId] > 0).map(item => ({
    productId: item.productId,
    quantity: quantities[item.productId]
  }));
  const amount = (items.reduce((sum, item) => sum + Math.round(item.price * 100) * (quantities[item.productId] || 0), 0) + (includeShipping ? Math.round(remainingShipping * 100) : 0)) / 100;
  const mutation = useMutation({
    mutationFn: () => request("post", `/orders/${order._id}/refund`, {
      items: selectedItems,
      includeShipping,
      reason
    }, {
      headers: {
        "Idempotency-Key": requestKey.current
      }
    }),
    onSuccess: () => {
      for (const key of ["adminOrders", "adminOrder", "summary", "analytics", "guestOrder", "customers"]) client.invalidateQueries({
        queryKey: [key]
      });
      onClose();
    }
  });
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="refund-order-dialog" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault();
    if (!mutation.isPending) onClose();
  }}>
    <form onSubmit={event => {
      event.preventDefault();
      if (amount > 0 && !mutation.isPending) mutation.mutate();
    }}>
      <header><div><span className="refund-order-kicker">{t("Order # ")}{order._id.slice(-8)}</span><h2 id={titleId}><TbReceiptRefund aria-hidden="true" />{t("Record refund")}</h2></div><button type="button" className="order-actions-close" disabled={mutation.isPending} onClick={onClose} aria-label={t("Close refund")}><TbX aria-hidden="true" /></button></header>
      <p className="refund-order-note">{t("Record money you have refunded to the customer. This updates revenue and does not send a payment or change stock.")}</p>
      <fieldset disabled={mutation.isPending}>
        <button type="button" className="text-button" onClick={() => {
          setQuantities(Object.fromEntries(items.map(item => [item.productId, item.quantity - (item.refundedQuantity || 0)])));
          setIncludeShipping(remainingShipping > 0);
        }}>{t("Select full remaining refund")}</button>
        {items.map(item => <label className="refund-order-item" key={item.productId}><span><strong>{item.name}</strong><small>{money(item.price)}{t(" each / ")}{item.quantity - (item.refundedQuantity || 0)}{t(" refundable")}</small></span><input aria-label={`Refund quantity for ${item.name}`} type="number" min="0" max={item.quantity - (item.refundedQuantity || 0)} step="1" value={quantities[item.productId] || 0} onChange={event => setQuantities(current => ({
            ...current,
            [item.productId]: Number(event.target.value)
          }))} /></label>)}
        {remainingShipping > 0 && <label className="refund-order-shipping"><input type="checkbox" checked={includeShipping} onChange={event => setIncludeShipping(event.target.checked)} />{t("Refund delivery fee ( ")}{money(remainingShipping)})</label>}
        <label className="refund-order-reason">{t("Reason (optional)")}<textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder={t("Add a note for this refund")} /></label>
      </fieldset>
      <div className="refund-order-total"><span>{t("Refund amount")}</span><strong>{money(amount)}</strong></div>
      {mutation.isError && <p role="alert" className="error">{errorMessage(mutation.error)}</p>}
      <footer><button type="button" className="btn-secondary" disabled={mutation.isPending} onClick={onClose}>{t("Cancel")}</button><button type="submit" className="btn-primary" disabled={amount <= 0 || mutation.isPending}>{t(mutation.isPending ? "Recording..." : "Confirm refund")}</button></footer>
    </form>
  </dialog>;
}
export function RefundOrderButton({
  order
}) {
  const {
    t
  } = usePageTranslation();
  const [open, setOpen] = useState(false);
  if (!canRefund(order)) return null;
  return <><button type="button" className="btn-secondary refund-order-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}><TbReceiptRefund aria-hidden="true" />{t("Record refund")}</button>{open && <RefundOrderDialog order={order} onClose={() => setOpen(false)} />}</>;
}
