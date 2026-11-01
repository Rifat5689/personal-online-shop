import { useQuery } from "@tanstack/react-query";
import { useManagementPage } from "../../management/hooks/useManagementPage";
import { request } from "../../../services/api";
import { useAuth } from "../../../application/providers/AuthProvider";
export function useProductsPage() {
  const management = useManagementPage("adminProducts", "/products");
  const { user } = useAuth();
  const platform = user?.role === "SUPER_ADMIN";
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => request("get", "/stores"),
    enabled: platform,
  });
  const categories = useQuery({
    queryKey: ["adminCategories", user?.tenantId],
    queryFn: () => request("get", "/categories"),
    enabled: !platform,
  });
  return { ...management, stores, categories, platform, user };
}
