import Event from "./analytics.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import Category from "../category/category.model.js";
import { changePercent } from "./analytics.utils.js";
const dateKey = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dhaka" } };
const isPaid = { $and: [{ $in: ["$payment.paymentStatus", ["paid", "partially_refunded", "refunded"]] }, { $not: [{ $in: ["$status", ["cancelled", "returned"]] }] }] };
const net = { $max: [0, { $subtract: ["$totalPrice", { $ifNull: ["$refundedAmount", 0] }] }] };
const paidValue = { $cond: [isPaid, net, 0] };

async function period(tenantId, start, end) {
  const match = { tenantId, resetId: null, createdAt: { $gte: start, $lt: end } };
  const [eventResult, orderResult] = await Promise.all([
    Event.aggregate([{ $match: match }, { $facet: {
      counts: [{ $group: { _id: "$type", count: { $sum: 1 }, sessions: { $addToSet: "$sessionId" }, seconds: { $sum: "$seconds" } } }],
      daily: [{ $group: { _id: dateKey, views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } }, clicks: { $sum: { $cond: [{ $eq: ["$type", "product_click"] }, 1, 0] } } } }, { $sort: { _id: 1 } }],
      sessions: [{ $group: { _id: "$sessionId", engaged: { $max: { $cond: [{ $in: ["$type", ["engagement", "add_to_cart", "checkout_start", "search"]] }, 1, 0] } }, seconds: { $sum: "$seconds" } } }],
      devices: [{ $match: { type: "page_view" } }, { $sort: { createdAt: 1 } }, { $group: { _id: "$sessionId", device: { $first: "$device" } } }, { $group: { _id: "$device", count: { $sum: 1 } } }],
      sources: [{ $match: { type: "page_view" } }, { $sort: { createdAt: 1 } }, { $group: { _id: "$sessionId", source: { $first: "$source" } } }, { $group: { _id: "$source", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }],
      pages: [{ $match: { type: "page_view" } }, { $group: { _id: "$page", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      products: [{ $match: { productId: { $ne: null } } }, { $group: { _id: "$productId", views: { $sum: { $cond: [{ $eq: ["$type", "product_view"] }, 1, 0] } }, clicks: { $sum: { $cond: [{ $eq: ["$type", "product_click"] }, 1, 0] } }, adds: { $sum: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } } } }],
    } }]),
    Order.aggregate([{ $match: match }, { $facet: {
      totals: [{ $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: paidValue }, refunds: { $sum: { $ifNull: ["$refundedAmount", 0] } }, paidOrders: { $sum: { $cond: [isPaid, 1, 0] } }, gross: { $sum: { $cond: [isPaid, "$totalPrice", 0] } } } }],
      daily: [{ $group: { _id: dateKey, orders: { $sum: 1 }, revenue: { $sum: paidValue } } }, { $sort: { _id: 1 } }],
      statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      buyers: [{ $group: { _id: "$shippingDetails.phone", orders: { $sum: 1 } } }, { $group: { _id: null, customers: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ["$orders", 1] }, 1, 0] } } } }],
      purchases: [{ $match: { status: { $nin: ["cancelled", "returned"] }, analyticsSessionId: { $ne: null } } }, { $group: { _id: "$analyticsSessionId" } }],
      products: [{ $unwind: "$orderItems" }, { $group: { _id: "$orderItems.productId", units: { $sum: { $cond: [isPaid, { $subtract: ["$orderItems.quantity", { $ifNull: ["$orderItems.refundedQuantity", 0] }] }, 0] } }, revenue: { $sum: { $cond: [isPaid, { $multiply: ["$orderItems.price", { $subtract: ["$orderItems.quantity", { $ifNull: ["$orderItems.refundedQuantity", 0] }] }] }, 0] } } } }],
    } }]),
  ]);
  const events = eventResult[0], orders = orderResult[0];
  const byType = Object.fromEntries(events.counts.map(row => [row._id, row]));
  const sessions = new Set(events.sessions.map(row => row._id));
  const purchaseSessions = orders.purchases.filter(row => sessions.has(row._id)).length;
  const checkoutSet = new Set(byType.checkout_start?.sessions || []);
  const purchasedSet = new Set(orders.purchases.map(row => row._id));
  const abandoned = [...checkoutSet].filter(id => !purchasedSet.has(id)).length;
  const totals = orders.totals[0] || {};
  const engaged = events.sessions.filter(row => row.engaged).length;
  const metrics = {
    revenue: totals.revenue || 0, orders: totals.orders || 0, refunds: totals.refunds || 0, gross: totals.gross || 0,
    averageOrder: totals.paidOrders ? totals.revenue / totals.paidOrders : 0,
    sessions: sessions.size, pageViews: byType.page_view?.count || 0, productViews: byType.product_view?.count || 0,
    clicks: byType.product_click?.count || 0, adds: byType.add_to_cart?.count || 0, searches: byType.search?.count || 0,
    engagementRate: sessions.size ? engaged / sessions.size * 100 : 0,
    averageEngagement: sessions.size ? events.sessions.reduce((sum, row) => sum + row.seconds, 0) / sessions.size : 0,
    conversion: sessions.size ? purchaseSessions / sessions.size * 100 : 0,
    checkoutAbandonment: checkoutSet.size ? abandoned / checkoutSet.size * 100 : 0,
    customers: orders.buyers[0]?.customers || 0, repeatBuyers: orders.buyers[0]?.repeat || 0,
  };
  return { metrics, events, orders, funnel: [
    { label: "Store sessions", value: sessions.size },
    { label: "Product viewers", value: byType.product_view?.sessions.length || 0 },
    { label: "Added to cart", value: byType.add_to_cart?.sessions.length || 0 },
    { label: "Started checkout", value: checkoutSet.size },
    { label: "Placed an order", value: purchaseSessions },
  ] };
}

export async function buildAnalytics(tenantId, range, since = null) {
  const after = start => since && since > start ? since : start;
  const inventoryScope = { tenantId, deletedAt: null, ...(since ? { createdAt: { $gte: since } } : {}) };
  const [current, previous, inventory, catalog, firstEvent] = await Promise.all([
    period(tenantId, after(range.start), range.end), period(tenantId, after(range.previousStart), range.start),
    Product.aggregate([{ $match: inventoryScope }, { $group: { _id: null, products: { $sum: 1 }, stock: { $sum: "$stock" }, outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } }, lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", 5] }] }, 1, 0] } } } }]),
    Product.find({ tenantId, resetId: null, deletedAt: null }).select("name slug stock images category deletedAt createdAt").populate("category", "name").lean(),
    Event.findOne({ tenantId, resetId: null }).sort({ createdAt: 1 }).select("createdAt").lean(),
  ]);
  const productEvents = new Map(current.events.products.map(row => [String(row._id), row]));
  const productSales = new Map(current.orders.products.map(row => [String(row._id), row]));
  const products = catalog.map(product => ({ id: product._id, name: product.name, slug: product.slug, category: product.category?.name || "Uncategorised", stock: product.stock, deleted: !!product.deletedAt, image: product.images?.[0]?.url, views: productEvents.get(String(product._id))?.views || 0, clicks: productEvents.get(String(product._id))?.clicks || 0, adds: productEvents.get(String(product._id))?.adds || 0, units: productSales.get(String(product._id))?.units || 0, revenue: productSales.get(String(product._id))?.revenue || 0 }));
  const daily = [];
  for (let i = 0; i < range.days; i++) {
    const date = new Date(range.start.getTime() + i * 86400000 + 6 * 3600000).toISOString().slice(0, 10);
    const events = current.events.daily.find(row => row._id === date);
    const orders = current.orders.daily.find(row => row._id === date);
    const priorDate = new Date(range.previousStart.getTime() + i * 86400000 + 6 * 3600000).toISOString().slice(0, 10);
    const priorOrders = previous.orders.daily.find(row => row._id === priorDate);
    const priorEvents = previous.events.daily.find(row => row._id === priorDate);
    daily.push({ date, revenue: orders?.revenue || 0, orders: orders?.orders || 0, views: events?.views || 0, clicks: events?.clicks || 0, previousRevenue: priorOrders?.revenue || 0, previousOrders: priorOrders?.orders || 0, previousViews: priorEvents?.views || 0, previousClicks: priorEvents?.clicks || 0 });
  }
  return {
    range: { start: range.start, end: range.end, previousStart: range.previousStart, days: range.days, timezone: "Asia/Dhaka" },
    metrics: Object.fromEntries(Object.entries(current.metrics).map(([key, value]) => [key, { value, previous: previous.metrics[key], change: changePercent(value, previous.metrics[key]) }])),
    daily, funnel: current.funnel, devices: current.events.devices, sources: current.events.sources, pages: current.events.pages,
    statuses: current.orders.statuses, inventory: { ...(inventory[0] || { products: 0, stock: 0, outOfStock: 0, lowStock: 0 }), categories: await Category.countDocuments({ tenantId, resetId: null, ...(since ? { createdAt: { $gte: since } } : {}) }) },
    products: since ? products.filter(product => product.views || product.clicks || product.adds || product.units || product.revenue || catalog.find(item => String(item._id) === String(product.id))?.createdAt >= since) : products,
    trackingStartedAt: firstEvent?.createdAt || null,
  };
}
