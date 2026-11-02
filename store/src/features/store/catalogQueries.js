import { request } from '../../services/api';

export const catalogStaleTime = 60_000;
export const productQuery = (storeSlug, productSlug) => ({
  queryKey: ['product', storeSlug, productSlug],
  queryFn: () => request('get', `/products/store/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productSlug)}`),
  staleTime: catalogStaleTime,
  gcTime: 30 * 60_000,
  enabled: Boolean(storeSlug && productSlug),
});
