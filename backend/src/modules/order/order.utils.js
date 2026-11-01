import ApiError from "../../utils/ApiError.js";
const calculatePrice = (product) =>
  Math.round(
    Number(product.price) * (1 - Number(product.discount || 0) / 100) * 100,
  ) / 100;
const validateCheckout = (body) => {
  const { orderItems, shippingDetails } = body;
  if (
    !Array.isArray(orderItems) ||
    !orderItems.length ||
    orderItems.length > 100
  )
    throw new ApiError(400, "Your cart must contain between 1 and 100 items");
  if (
    !shippingDetails ||
    ["name", "phone", "address"].some(
      (key) =>
        typeof shippingDetails[key] !== "string" ||
        !shippingDetails[key].trim(),
    )
  )
    throw new ApiError(400, "Name, phone, and delivery address are required");
  if (!/^[+\d ()-]{7,20}$/.test(shippingDetails.phone))
    throw new ApiError(400, "Invalid phone number");
  if (shippingDetails.name.length > 100 || shippingDetails.address.length > 500)
    throw new ApiError(400, "Shipping details are too long");
  if (
    orderItems.some(
      (item) =>
        !/^[a-f\d]{24}$/i.test(item.productId || "") ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100,
    )
  )
    throw new ApiError(400, "Invalid product or quantity");
  if (
    new Set(orderItems.map((item) => item.productId)).size !== orderItems.length
  )
    throw new ApiError(400, "Duplicate product in cart");
  if (body.paymentMethod && body.paymentMethod !== "cash on delivery")
    throw new ApiError(400, "Only cash on delivery is currently supported");
  if (
    body.shippingZone &&
    !["insideDhaka", "outsideDhaka"].includes(body.shippingZone)
  )
    throw new ApiError(400, "Select a valid delivery area");
  if (
    body.customerUsername !== undefined &&
    (typeof body.customerUsername !== "string" ||
      body.customerUsername.trim().length > 40)
  )
    throw new ApiError(400, "Invalid customer username");
};
const transitions = {
  pending: ["confirmed", "processing", "shipping", "shipped", "cancelled"],
  confirmed: ["processing", "shipping", "shipped", "cancelled"],
  processing: ["shipping", "shipped", "cancelled"],
  shipping: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};
export { calculatePrice, validateCheckout, transitions };
