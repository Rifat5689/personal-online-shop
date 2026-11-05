import ApiError from "../../utils/ApiError.js";
import { createCatalog } from "./whatsapp.catalog.js";
import { sendWhatsAppText } from "./whatsapp.send.js";
import { testRecipientAllowed } from "./whatsapp.shopping.models.js";
import { uploadCatalogImage } from "./whatsapp.media.js";
export async function sendShoppingResponse({ chat, result, requestId, stagingOnly = true, beforeSend = async () => true }) {
  if (stagingOnly && !testRecipientAllowed(chat.phone)) throw new ApiError(403, "Staging recipient is not approved");
  const catalog = createCatalog(chat.store), messages = [];
  const products = [];
  for (const reference of result.products.slice(0, 6)) { const product = await catalog.getProductDetails({ productId: reference.id }); if (product) products.push(product); }
  if (result.format !== "images" || !products.length) {
    if (!await beforeSend()) throw new ApiError(409, "Human takeover stopped the reply");
    return [await sendWhatsAppText({ chat, text: result.reply, requestId, source: "ai" })];
  }
  for (const [index, product] of products.entries()) {
    const text = `${result.imageMatch ? "সম্ভাব্য মিল: " : ""}${products.length > 1 ? `${index + 1}. ` : ""}${product.name}\n${product.salePrice.toLocaleString("bn-BD")} টাকা\n${product.description.slice(0, 150)}\n${product.url || ""}`.trim();
    // One caption per product; no redundant introductory text message.
    if (!await beforeSend()) throw new ApiError(409, "Human takeover stopped remaining images");
    let message = await sendWhatsAppText({ chat, text, requestId: `${requestId}-${index}`, source: "ai", image: product.images[0], productIds: [product.id] });
    // Retry by uploaded media only after an explicit rejection, never uncertain delivery.
    if (message.status === "failed" && product.images[0] && await beforeSend()) {
      const mediaId = await uploadCatalogImage(product.images[0]);
      if (mediaId && await beforeSend()) message = await sendWhatsAppText({ chat, text, requestId: `${requestId}-${index}-uploaded`, source: "ai", image: product.images[0], imageMediaId: mediaId, productIds: [product.id] });
    }
    messages.push(message);
    if (["failed", "unknown"].includes(message.status)) break;
  }
  return messages;
}
