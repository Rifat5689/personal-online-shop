import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "../../../services/api";
import { useAuth } from "../../../application/providers/AuthProvider";
export function useManagementPage(resource, endpoint, initialStatus = "") {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [resource, user?._id, user?.tenantId],
    queryFn: () => request("get", endpoint),
  });
  const mutation = useMutation({
    mutationFn: ({ method = "post", id, data }) =>
      request(method, id ? `${endpoint}/${id}` : endpoint, data,
        data instanceof FormData ? { timeout: 90000 } : undefined),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [resource] });
      client.invalidateQueries({ queryKey: ["summary"] });
      client.invalidateQueries({ queryKey: ["analytics"] });
      if (resource === "adminProducts") {
        client.invalidateQueries({ queryKey: ["product"] });
        client.invalidateQueries({ queryKey: ["relatedProducts"] });
        client.invalidateQueries({ queryKey: ["adminCategories"] });
        client.invalidateQueries({ queryKey: ["products"] });
      }
      if (resource === "adminCategories") {
        client.invalidateQueries({ queryKey: ["adminProducts"] });
        client.invalidateQueries({ queryKey: ["products"] });
        client.invalidateQueries({ queryKey: ["product"] });
        client.invalidateQueries({ queryKey: ["relatedProducts"] });
        client.invalidateQueries({ queryKey: ["categories"] });
      }
    },
  });
  const filtered = (query.data || []).filter(
    (item) =>
      Object.values(item).some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(search.toLowerCase()),
      ) &&
      (!status || item.status === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  return {
    query,
    mutation,
    search,
    setSearch: (value) => {
      setSearch(value);
      setPage(1);
    },
    status,
    setStatus: (value) => {
      setStatus(value);
      setPage(1);
    },
    page: currentPage,
    setPage,
    pages,
    rows: filtered.slice((currentPage - 1) * 10, currentPage * 10),
  };
}
