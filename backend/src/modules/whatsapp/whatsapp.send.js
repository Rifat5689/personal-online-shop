import ApiError from "../../utils/ApiError.js";
import { Conversation, Message, Receipt } from "./whatsapp.model.js";
import { windowOpen } from "./whatsapp.security.js";
export async function applyReceipt(receipt) {
  const ranks = { sent: 1, delivered: 2, read: 3 };
  const allowed = receipt.status === "failed" ? ["sending", "unknown", "sent"] : ["sending", "unknown", ...Object.keys(ranks).filter(key => ranks[key] <= ranks[receipt.status])];
  await Message.updateOne({ store: receipt.store, metaId: receipt.metaId, status: { $in: allowed } }, { $set: { status: receipt.status, statusAt: receipt.statusAt, error: receipt.error } });
}
export async function sendWhatsAppText({ chat, text, requestId, source = "admin", aiReplyTo }) {
  if (!windowOpen(chat.lastInboundAt)) throw new ApiError(409, "The 24-hour reply window is closed. Ask the customer to message you again.");
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN, phone = process.env.META_WHATSAPP_PHONE_NUMBER_ID, version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^\d+$/.test(phone || "") || !/^v\d+\.0$/.test(version || "")) throw new ApiError(503, "WhatsApp backend configuration is incomplete");
  const message = await Message.create({ store: chat.store, conversation: chat._id, direction: "outbound", text: text.trim(), requestId, source, aiReplyTo, status: "sending", timestamp: new Date() });
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phone}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: chat.phone, type: "text", text: { body: text.trim() } }), signal: AbortSignal.timeout(20000) });
    const payload = await response.json();
    if (!response.ok) {
      message.status = "failed";
      message.error = `Meta error ${payload.error?.code || response.status}: Message rejected. Check account permissions and phone configuration.`;
    } else if (payload.messages?.[0]?.id) { message.metaId = payload.messages[0].id; message.status = "sent"; }
    else { message.status = "unknown"; message.error = "Meta did not return a message ID. Verify delivery before sending again."; }
  } catch { message.status = "unknown"; message.error = "Delivery could not be confirmed. Verify in WhatsApp before sending again."; }
  await message.save();
  if (message.metaId) { const receipt = await Receipt.findOne({ metaId: message.metaId, store: chat.store }); if (receipt) await applyReceipt(receipt); }
  await Conversation.updateOne({ _id: chat._id, $or: [{ lastMessageAt: { $lte: message.timestamp } }, { lastMessageAt: null }] }, { $set: { lastMessageAt: message.timestamp, preview: message.text.slice(0, 160) } });
  return Message.findById(message._id);
}
