import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useManagementPage } from "../../management/hooks/useManagementPage";
import { request } from "../../../services/api";
export function useOrdersPage(id) {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const hook = useManagementPage("adminOrders", "/orders", Object.hasOwn(transitions, initialStatus) ? initialStatus : "");
  const details = useQuery({
    queryKey: ["adminOrder", id],
    queryFn: () => request("get", `/orders/${id}`),
    enabled: !!id,
  });
  return { ...hook, details };
}
export const transitions = {
  pending: ["confirmed", "processing", "shipping", "shipped", "cancelled"],
  confirmed: ["processing", "shipping", "shipped", "cancelled"],
  processing: ["shipping", "shipped", "cancelled"],
  shipping: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const orderStatusLabel = status => status === "delivered" ? "Paid" : status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending";
