import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../application/providers/AuthProvider";
import { request } from "../../services/api";
export function useSubscription(options = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subscription", user?._id, user?.tenantId],
    queryFn: async () => ({analyticsAllowed:true,themeAllowed:true,plan:"PRO",status:"ACTIVE"}),
    staleTime: 0,
    refetchInterval: 15000,
    ...options,
  });
}
export const bdt = (paisa) =>
  `\u09f3${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format((paisa || 0) / 100)}`;
export const date = (value) =>
  value
    ? new Date(value).toLocaleString("en-BD", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Dhaka",
      })
    : "\u2014";
