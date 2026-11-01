import { useQuery } from "@tanstack/react-query";
import { request } from "../../../services/api";
import { useAuth } from "../../../application/providers/AuthProvider";
export const useDashboard = (days = "30") => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["summary", user?._id, user?.tenantId, days],
    queryFn: () => request("get", `/stores/summary?days=${days}`),
    refetchInterval: 30000,
  });
};
