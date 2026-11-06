import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { AIJob, AISettings, Conversation, Message } from "./whatsapp.model.js";
import { generateProviderReply as generateAIReply } from "./whatsapp.providers.js";
import { sendWhatsAppText } from "./whatsapp.send.js";
import { windowOpen } from "./whatsapp.security.js";
export async function queueIncomingAI(message) {
  if (!message.aiEligible || message.type !== "text" || message.direction !== "inbound") return;
  await AIJob.updateOne({ inbound: message._id }, { $setOnInsert: { store: message.store, conversation: message.conversation, inbound: message._id, settingsRevision: message.aiSettingsRevision, chatRevision: message.aiChatRevision, status: "queued" } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
}
async function permitted(job) {
  const [settings, chat, latest] = await Promise.all([
    AISettings.findOne({ store: job.store }).select("+encryptedKey +encryptedGroqKey"),
    Conversation.findOne({ _id: job.conversation, store: job.store }),
    Message.findOne({ store: job.store, conversation: job.conversation, direction: "inbound" }).sort({ timestamp: -1, _id: -1 }),
  ]);
  if (!settings?.enabled || settings.revision !== job.settingsRevision || !chat?.aiEnabled || chat.aiRevision !== job.chatRevision || !windowOpen(chat.lastInboundAt) || String(latest?._id) !== String(job.inbound)) return null;
  return { settings, chat };
}
export async function processAIJob(job, { generate = generateAIReply, send = sendWhatsAppText } = {}) {
  if (job.status !== "processing") return;
  let locked = false;
  try {
    let current = await permitted(job);
    if (!current) { job.status = "skipped"; return; }
    const recent = await Message.countDocuments({ store: job.store, source: "ai", createdAt: { $gte: new Date(Date.now() - 60000) } });
    if (recent >= 20) { job.status = "queued"; job.notBefore = new Date(Date.now() + 60000); return; }
    const lease = await Conversation.findOneAndUpdate({ _id: job.conversation, aiEnabled: true, aiRevision: job.chatRevision, $or: [{ aiLeaseUntil: null }, { aiLeaseUntil: { $lt: new Date() } }] }, { $set: { aiLeaseUntil: new Date(Date.now() + 90000), aiLeaseOwner: job.owner } }, { new: true });
    if (!lease) { job.status = "queued"; job.notBefore = new Date(Date.now() + 1000); return; }
    locked = true;
    if (await Message.exists({ aiReplyTo: job.inbound })) { job.status = "skipped"; return; }
    const history = (await Message.find({ store: job.store, conversation: job.conversation, type: "text", status: { $nin: ["failed", "unknown", "sending"] } }).sort({ timestamp: -1, _id: -1 }).limit(40).lean()).reverse();
    const text = await generate(current.settings, history);
    current = await permitted(job);
    if (!current) { job.status = "skipped"; return; }
    // Persist the send boundary before the network call. Recovery never retries an
    // uncertain WhatsApp send, preventing duplicate automatic replies after a crash.
    const claimed = await AIJob.findOneAndUpdate({ _id: job._id, owner: job.owner, status: "processing", leaseUntil: { $gt: new Date() } }, { $set: { status: "sending" } });
    if (!claimed) { job.status = "skipped"; return; }
    job.status = "sending";
    const result = await send({ chat: current.chat, text, requestId: `ai-${job.inbound}`, source: "ai", aiReplyTo: job.inbound });
    job.status = ["sent", "delivered", "read"].includes(result.status) ? "sent" : result.status === "failed" ? "failed" : "unknown";
    if (job.status !== "sent") job.error = "Automatic reply delivery was not confirmed; human review required.";
  } catch (error) {
    job.status = job.status === "sending" ? "unknown" : "failed";
    job.error = job.status === "unknown" ? "Delivery uncertain; no automatic retry was made." : error?.statusCode === 400 ? error.message : "AI reply could not be generated or sent. No fallback response was fabricated.";
  } finally {
    await AIJob.updateOne({ _id: job._id, owner: job.owner }, { $set: { status: job.status, notBefore: job.notBefore, error: job.error || "" }, $unset: { leaseUntil: 1 } });
    if (locked) await Conversation.updateOne({ _id: job.conversation, aiLeaseOwner: job.owner }, { $unset: { aiLeaseUntil: 1, aiLeaseOwner: 1 } });
  }
}
export function startAIWorker() {
  let busy = false, stopped = false;
  const owner = randomUUID();
  const timer = setInterval(async () => {
    if (busy || stopped || mongoose.connection.readyState !== 1 || process.env.WHATSAPP_WEBHOOK_RELAY_URL) return;
    busy = true;
    try {
      await AIJob.updateMany({ status: "processing", leaseUntil: { $lt: new Date() } }, { $set: { status: "queued" } });
      await AIJob.updateMany({ status: "sending", leaseUntil: { $lt: new Date() } }, { $set: { status: "unknown", error: "Worker restarted during delivery; verify before sending again." } });
      await Message.updateMany({ source: "ai", status: "sending", createdAt: { $lt: new Date(Date.now() - 90000) } }, { $set: { status: "unknown", error: "Delivery could not be confirmed after a worker restart. No automatic retry was made." } });
      const job = await AIJob.findOneAndUpdate({ status: "queued", notBefore: { $lte: new Date() } }, { $set: { status: "processing", owner, leaseUntil: new Date(Date.now() + 90000) } }, { new: true, sort: { createdAt: 1 } });
      if (job) await processAIJob(job);
    } catch { /* Persistent jobs remain inspectable; never log keys or conversations. */ }
    finally { busy = false; }
  }, 1000);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
