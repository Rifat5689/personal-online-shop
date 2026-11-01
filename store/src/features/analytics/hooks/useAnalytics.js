import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../application/providers/AuthProvider";
import { request } from "../../../services/api";
export function useAnalytics(range) {
  const { user } = useAuth();
  const params = range.days === "custom" ? new URLSearchParams({ start: range.start, end: range.end }) : new URLSearchParams({ days: range.days });
  return useQuery({ queryKey: ["analytics", user?._id, user?.tenantId, params.toString()], queryFn: ({ signal }) => request("get", `/analytics?${params}`, undefined, { signal }), staleTime: 30000, refetchInterval: 60000 });
}
