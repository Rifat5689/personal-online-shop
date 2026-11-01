export const readStorage = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
};
export const priceOf = (product) =>
  Math.round(
    Number(product.price) * (1 - Number(product.discount || 0) / 100) * 100,
  ) / 100;
export const addCartItem = (items, product, quantity = 1) => {
  if (!Number.isInteger(quantity) || quantity < 1 || product.stock < 1)
    return items;
  if (items.some((item) => item.product._id === product._id)) return items;
  return [...items, { product, quantity: Math.min(product.stock, quantity) }];
};
