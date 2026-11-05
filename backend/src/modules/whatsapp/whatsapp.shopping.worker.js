import mongoose from "mongoose";
import Store from "../store/store.model.js";
import { AISettings, Conversation, Message, Receipt } from "./whatsapp.model.js";
import { applyReceipt } from "./whatsapp.send.js";
import { shoppingEnabled, testRecipientAllowed, StagingAISettings, ShoppingSession, ShoppingJob, AvailabilityVerification, SHOPPING_QUIET_MS } from "./whatsapp.shopping.models.js";
import { generateShoppingReply } from "./whatsapp.shopping.js";
import { downloadWhatsAppImage } from "./whatsapp.media.js";
import { sendShoppingResponse } from "./whatsapp.shopping.send.js";
export async function queueStagingEvent(raw) {
  if (!shoppingEnabled()) return;
  const event = JSON.parse(raw.toString("utf8"));
  const store = await Store.findOne({ slug: process.env.STORE_SLUG || "originsofbeauty" });
  if (!store) return;
  for (const entry of event.entry || []) for (const change of entry.changes || []) {
    if (change.field !== "messages" || change.value?.metadata?.phone_number_id !== process.env.META_WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const item of change.value.messages || []) {
      if (!item.id || !testRecipientAllowed(item.from) || !["text", "image"].includes(item.type)) continue;
      const timestamp = new Date(Number(item.timestamp) * 1000);
      if (!Number.isFinite(+timestamp) || +timestamp > Date.now() + 60000 || +timestamp < Date.now() - 86400000) continue;
      // Only explicitly enabled local sessions respond; existing customers are never opted in.
      const session = await ShoppingSession.findOne({ store: store._id, phone: item.from, aiEnabled: true }).sort({ createdAt: -1 });
      const settings = await StagingAISettings.findOne({ store: store._id, enabled: true });
      if (!session || !settings) continue;
      const inserted = await ShoppingJob.updateOne({ metaId: item.id }, { $setOnInsert: { store: store._id, session: session._id, settingsRevision: settings.revision, sessionRevision: session.revision, phone: item.from, text: item.text?.body || item.image?.caption || "ছবির প্রোডাক্টটি খুঁজে দিন।", mediaId: item.image?.id, replyToMetaId: item.context?.id, timestamp, notBefore: new Date(Date.now() + SHOPPING_QUIET_MS) } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
      // Duplicate Meta retries do not extend the customer's waiting time.
      if (inserted?.upsertedCount) await ShoppingJob.updateMany({ store: store._id, phone: item.from, status: "queued" }, { $set: { notBefore: new Date(Date.now() + SHOPPING_QUIET_MS) } });
    }
  }
}
export async function processShoppingJob(job, { generate = generateShoppingReply, send = sendShoppingResponse, download = downloadWhatsAppImage } = {}) {
  try {
    if (!testRecipientAllowed(job.phone)) throw Error("Recipient is not approved");
    if (await ShoppingJob.countDocuments({ store: job.store, status: "sent", updatedAt: { $gt: new Date(Date.now() - 60000) } }) >= 20) throw Error("Staging message rate limit reached");
    const session = await ShoppingSession.findOne({ store: job.store, phone: job.phone, aiEnabled: true, ...(job.session ? { _id: job.session } : {}) }).sort({ createdAt: -1 });
    const settings = await StagingAISettings.findOne({ store: job.store, enabled: true }).select("+encryptedKey");
    // Mirrored production controls are read-only and take precedence over staging tests.
    const production = await AISettings.findOne({ store: job.store });
    const chat = await Conversation.findOne({ store: job.store, phone: job.phone });
    if (!session || !settings || (production?.enabled && chat?.aiEnabled)) throw Error("AI disabled or production AI owns this conversation");
    if ((job.settingsRevision != null && job.settingsRevision !== settings.revision) || (job.sessionRevision != null && job.sessionRevision !== session.revision)) throw Error("AI controls changed after the message arrived");
    const claim = await ShoppingSession.findOneAndUpdate({ _id: session._id, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now() + 70000) } });
    if (!claim) throw Error("Session is processing another message");
    try {
      let inboundText = job.text, mediaId = job.mediaId, replyToMetaId = job.replyToMetaId;
      const nearby = await ShoppingJob.find({ store: job.store, phone: job.phone, status: "queued", _id: { $ne: job._id } }).sort({ createdAt: 1 }).limit(10);
      const waiting = nearby.filter(next => +next.notBefore > Date.now()).sort((a, b) => +b.notBefore - +a.notBefore)[0];
      if (waiting) { await ShoppingJob.updateOne({ _id: job._id }, { $set: { status: "queued", notBefore: waiting.notBefore } }); return; }
      for (const next of nearby) {
        const merged = await ShoppingJob.updateOne({ _id: next._id, status: "queued" }, { $set: { status: "skipped", error: "Combined into one response after the 10-second wait" } });
        if (!merged.modifiedCount) continue;
        inboundText = `${inboundText}\n${next.text}`.slice(-2000);
        mediaId = next.mediaId || mediaId; replyToMetaId = next.replyToMetaId || replyToMetaId;
        if (+next.timestamp > +job.timestamp) job.timestamp = next.timestamp;
      }
      const history = [...session.history];
      if (replyToMetaId) {
        const referenced = await Message.findOne({ store: job.store, metaId: replyToMetaId, conversation: chat?._id }).lean();
        if (referenced?.productIds?.length) history.push({ direction: "outbound", text: "Customer is replying to these products", products: referenced.productIds.map(id => ({ id: String(id) })) });
      }
      const image = mediaId ? await download(mediaId) : undefined;
      const result = await generate({ store: job.store, settings, history, prompt: inboundText, image });
      const superseded = await deferForNewMessage(job, { inboundText, mediaId, replyToMetaId });
      if (superseded) return;
      if (result.needsVerification && history.at(-1)?.text === result.reply && await AvailabilityVerification.exists({ store: job.store, session: session._id, status: "pending" })) {
        await ShoppingJob.updateOne({ _id: job._id }, { $set: { status: "skipped" } });
        return;
      }
      const [fresh, currentSettings, prod] = await Promise.all([ShoppingSession.findById(session._id), StagingAISettings.findById(settings._id), AISettings.findOne({ store: job.store })]);
      const currentChat = await Conversation.findOne({ store: job.store, phone: job.phone });
      if (!fresh?.aiEnabled || fresh.revision !== session.revision || !currentSettings?.enabled || currentSettings.revision !== settings.revision || (prod?.enabled && currentChat?.aiEnabled)) throw Error("Human takeover or AI settings changed");
      const target = currentChat || { store: job.store, phone: job.phone, lastInboundAt: job.timestamp };
      if (!target._id) throw Error("Waiting for mirrored test conversation; no message sent");
      target.lastInboundAt = job.timestamp;
      if (result.needsVerification) for (const product of result.products.length ? result.products : [{ id: null, name: "Customer request" }]) await AvailabilityVerification.updateOne({ store: job.store, session: session._id, product: product.id, status: "pending" }, { $setOnInsert: { conversation: target._id, customer: job.phone, productName: product.name } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
      await ShoppingJob.updateOne({ _id: job._id, status: "processing" }, { $set: { status: "sending" } });
      const beforeSend = async () => {
        if (await deferForNewMessage(job, { inboundText, mediaId, replyToMetaId })) return false;
        const [activeSession, activeSettings, prodSettings, prodChat] = await Promise.all([
          ShoppingSession.exists({ _id: session._id, aiEnabled: true, revision: session.revision }),
          StagingAISettings.exists({ _id: settings._id, enabled: true, revision: settings.revision }),
          AISettings.findOne({ store: job.store }), Conversation.findOne({ store: job.store, phone: job.phone }),
        ]);
        return Boolean(activeSession && activeSettings && !(prodSettings?.enabled && prodChat?.aiEnabled));
      };
      const messages = await send({ chat: target, result, requestId: `shopping-live-${job._id}`, stagingOnly: true, beforeSend });
      if (messages.some(message => !["sent", "delivered", "read"].includes(message.status))) throw Error("Meta delivery failed or is uncertain; no retry");
      await ShoppingSession.updateOne({ _id: session._id }, { $set: { history: [...history, { direction: "inbound", text: inboundText }, { direction: "outbound", text: result.reply, products: result.products.map(p => ({ id: p.id })) }].slice(-12) } });
      await ShoppingJob.updateOne({ _id: job._id }, { $set: { status: "sent" } });
    } finally { await ShoppingSession.updateOne({ _id: session._id }, { $unset: { leaseUntil: 1 } }); }
  } catch { await ShoppingJob.updateOne({ _id: job._id, status: { $ne: "skipped" } }, { $set: { status: "failed", error: "Staging AI stopped or failed. Check settings, takeover and provider status. No automatic resend." } }); }
}
export async function deferForNewMessage(job, { inboundText, mediaId, replyToMetaId }) {
  const newer = await ShoppingJob.findOne({ store: job.store, phone: job.phone, status: "queued", _id: { $ne: job._id } }).sort({ createdAt: 1 });
  if (!newer) return false;
  const carried = await ShoppingJob.updateOne({ _id: newer._id, status: "queued" }, { $set: { text: `${inboundText}\n${newer.text}`.slice(-2000), mediaId: newer.mediaId || mediaId, replyToMetaId: newer.replyToMetaId || replyToMetaId } });
  if (!carried.modifiedCount) return false;
  await ShoppingJob.updateOne({ _id: job._id }, { $set: { status: "skipped", error: "Waiting for the latest customer message before replying" } });
  return true;
}
export const readyShoppingJobs = (now = new Date()) => ({ status: "queued", $or: [{ notBefore: { $lte: now } }, { notBefore: null, createdAt: { $lte: new Date(+now - SHOPPING_QUIET_MS) } }] });
export function startShoppingWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || !shoppingEnabled() || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
      const outstanding = await Message.find({ requestId: /^shopping-/, status: { $in: ["sent", "unknown", "sending", "delivered"] }, metaId: { $type: "string" }, createdAt: { $gt: new Date(Date.now() - 86400000) } }).limit(30).lean();
      for (const message of outstanding) { const receipt = await Receipt.findOne({ store: message.store, metaId: message.metaId }); if (receipt) await applyReceipt(receipt); }
      await ShoppingJob.updateMany({ status: { $in: ["processing", "sending"] }, updatedAt: { $lt: new Date(Date.now() - 90000) } }, { $set: { status: "unknown", error: "Worker interrupted; inspect delivery before manual retry" } });
      const job = await ShoppingJob.findOneAndUpdate(readyShoppingJobs(), { $set: { status: "processing" } }, { sort: { createdAt: 1 }, new: true });
      if (job) await processShoppingJob(job);
    } catch {} finally { busy = false; }
  }, 1000);
  timer.unref(); return () => clearInterval(timer);
}
