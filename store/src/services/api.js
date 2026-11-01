import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: { "X-App-Client": import.meta.env.VITE_APP_CLIENT || "store-admin" },
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  config.headers["X-Store-Slug"] = "originsofbeauty";
  const token = sessionStorage.getItem("ownshop_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshPromise;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.errors?.some(item => item.code === "SUBSCRIPTION_REQUIRED")) window.dispatchEvent(new Event("ownshop:subscription-denied"));
    const config = error.config;
    const hasSession =
      sessionStorage.getItem("ownshop_access") ||
      localStorage.getItem("ownshop_session");
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      config.url?.includes("/auth/") ||
      !hasSession
    )
      return Promise.reject(error);
    config._retried = true;
    try {
      if (!refreshPromise)
        refreshPromise = api
          .post("/users/auth/refreshtoken")
          .then((response) => {
            const token = response.data.data?.accessToken;
            if (token) sessionStorage.setItem("ownshop_access", token);
          })
          .finally(() => {
            refreshPromise = null;
          });
      await refreshPromise;
      return api(config);
    } catch {
      sessionStorage.removeItem("ownshop_access");
      localStorage.removeItem("ownshop_session");
      window.dispatchEvent(new Event("ownshop:unauthorized"));
      return Promise.reject(error);
    }
  },
);
export const request = async (method, url, data, config) =>
  (await api.request({ method, url, data, ...config })).data.data;
export const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to complete the request";
export const productService = {
  getProductsByStore: (slug) =>
    request("get", `/products/store/${encodeURIComponent(slug)}`),
  createProduct: (data) => request("post", "/products", data),
};
export const storeService = {
  getStores: () => request("get", "/stores"),
  createStore: (data) => request("post", "/stores", data),
};
export default api;
