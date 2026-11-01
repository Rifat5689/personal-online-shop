export const orderNoticeKey = (order) => `order:${order._id}`;
export const stockNoticeKey = (product) =>
  `stock:${product._id}:${product.stock}:${product.updatedAt || ""}`;

export function readSeenNotifications(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key));
    return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

export function unseenNotifications(orders, products, seen) {
  return {
    orders: orders.filter(order => order.status === "pending" && !seen.has(orderNoticeKey(order))),
    products: products.filter(product => product.isActive && product.stock <= 5 && !seen.has(stockNoticeKey(product))),
  };
}
