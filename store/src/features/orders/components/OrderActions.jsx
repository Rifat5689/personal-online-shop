import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useRef, useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TbAdjustmentsHorizontal, TbCheck, TbPackage, TbTruck, TbTruckDelivery, TbX, TbArrowBack, TbEye, TbCircleCheck, TbReceiptRefund, TbCash } from "react-icons/tb";
import { transitions, orderStatusLabel } from "../hooks/useOrdersPage";
import { errorMessage } from "../../../services/api";
import { RefundOrderDialog, canRefund, paymentLabel } from "./RefundOrderDialog";
const statusIcons = {
  paid: TbCash,
  refunded: TbReceiptRefund,
  confirmed: TbCheck,
  processing: TbPackage,
  shipping: TbTruck,
  shipped: TbTruckDelivery,
  delivered: TbCircleCheck,
  cancelled: TbX,
  returned: TbArrowBack
};
export function OrderActions({
  order,
  mutation,
  onViewDetails
}) {
  const {
    t
  } = usePageTranslation();
  const dialog = useRef(null);
  const titleId = useId();
  const [refundOpen, setRefundOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const client = useQueryClient();
  const options = [...(transitions[order.status] || []), ...(!["cancelled", "returned"].includes(order.status) && order.payment?.paymentStatus === "pending" && !(transitions[order.status] || []).includes("delivered") ? ["paid"] : []), ...(canRefund(order) ? ["refunded"] : [])];
  const save = event => {
    event.preventDefault();
    if (!options.includes(selected) || mutation.isPending) return;
    if (selected === "refunded") {
      dialog.current.close();
      setRefundOpen(true);
      return;
    }
    mutation.mutate({
      method: "patch",
      id: order._id,
      data: selected === "paid" ? {
        paymentStatus: "paid"
      } : {
        status: selected
      }
    }, {
      onSuccess: () => {
        client.invalidateQueries({
          queryKey: ["adminOrder", order._id]
        });
        dialog.current?.close();
      },
      onError: failure => setError(errorMessage(failure))
    });
  };
  return <>
      {refundOpen && <RefundOrderDialog order={order} onClose={() => setRefundOpen(false)} />}
      <button type="button" className="admin-orders-action admin-orders-manage" aria-label={`Actions for order ${order._id.slice(-8)}`} aria-haspopup="dialog" title={t("Order actions")} onClick={() => {
      setSelected("");
      setError("");
      dialog.current.showModal();
    }}>
        <TbAdjustmentsHorizontal aria-hidden="true" />
      </button>
      <dialog ref={dialog} className="order-actions-dialog" aria-labelledby={titleId} onCancel={event => {
      if (mutation.isPending) event.preventDefault();
    }}>
        <form onSubmit={save}>
          <div className="order-actions-heading">
            <div>
              <h2 id={titleId}>{t("Order actions")}</h2>
              <p>
                #{order._id.slice(-8)} ·{" "}
                {order.shippingDetails?.name || "Customer"}
              </p>
            </div>
            <button type="button" className="order-actions-close" aria-label={t("Close order actions")} disabled={mutation.isPending} onClick={() => dialog.current.close()}>
              <TbX aria-hidden="true" />
            </button>
          </div>
          <p className="order-actions-current">{t("Current status")}<strong>{t(orderStatusLabel(order.status))}</strong>
            <span className="order-actions-payment">{t("Payment: ")}{t(paymentLabel(order))}</span>
          </p>
          {t(options.length ? <fieldset disabled={mutation.isPending}>
              <legend>{t("Choose the next status")}</legend>
              <div className="order-actions-options">
                {options.map(status => {
              const Icon = statusIcons[status];
              return <label key={status} className={`order-actions-option${selected === status ? " selected" : ""}`}>
                      <Icon aria-hidden="true" />
                      <span>
                        {t(status === "refunded" ? "Refund products" : status === "paid" ? "Paid" : orderStatusLabel(status))}
                      </span>
                      <input type="radio" name={`status-${order._id}`} value={status} checked={selected === status} onChange={() => setSelected(status)} />
                    </label>;
            })}
              </div>
            </fieldset> : <p className="order-actions-terminal">{t("This order has no further status changes.")}</p>)}
          {error && <p className="error" role="alert">
              {error}
            </p>}
          <div className="order-actions-footer">
            <button type="button" className="order-actions-view-details" disabled={mutation.isPending} onClick={() => {
            dialog.current.close();
            onViewDetails();
          }}>
              <TbEye aria-hidden="true" />{t("View details")}</button>
            {options.length > 0 && <button type="submit" className="btn-primary" disabled={!selected || mutation.isPending}>
                {t(mutation.isPending ? "Updating…" : selected === "refunded" ? "Review refund" : selected === "paid" ? "Mark paid" : "Update status")}
              </button>}
          </div>
        </form>
      </dialog>
    </>;
}
