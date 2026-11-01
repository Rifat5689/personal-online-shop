import { useQuery } from "@tanstack/react-query";
import { useStore } from "../../../application/providers/StoreProvider";
import { request } from "../../../services/api";
export function useCatalog() {
  const { storeSlug } = useStore();
  const products = useQuery({
    queryKey: ["products", storeSlug],
    queryFn: () => request("get", `/products/store/${storeSlug}`),
    enabled: !!storeSlug,
  });
  const categories = useQuery({
    queryKey: ["categories", storeSlug],
    queryFn: () => request("get", `/categories/store/${storeSlug}`),
    enabled: !!storeSlug,
  });
  return { products, categories, storeSlug };
}
