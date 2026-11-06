import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import ApiError from "../../utils/ApiError.js";
import { Conversation } from "./whatsapp.model.js";
export const deleteChatRouter = express.Router();
const productionName = "personalshop_originsofbeauty", stagingName = "personalshop_originsofbeauty_test";
async function targetFor(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid conversation");
  const chat = await Conversation.findOne({ _id: req.params.id, store: req.store._id }).lean();
  if (!chat) throw new ApiError(404, "Conversation not found");
  if (process.env.DATABASE_ROLE !== "test" || mongoose.connection.name !== stagingName) return { chat, scope: mongoose.connection.name === productionName ? "production-and-staging" : "staging-only" };
  const db = mongoose.connection.getClient().db(productionName);
  let store, productionChat;
  try {
    store = await db.collection("stores").findOne({ slug: process.env.STORE_SLUG || "originsofbeauty" }, { projection: { _id: 1 } });
    if (!store) throw Error("Production store not found");
    productionChat = await db.collection("whatsappconversations").findOne({ store: store._id, phone: chat.phone });
  } catch { throw new ApiError(503, "Production inbox could not be verified. No chat was deleted."); }
  return { chat, db, productionStore: store, productionChat, scope: productionChat ? "production-and-staging" : "staging-only" };
}
async function purge(db, chat, session) {
  const filter = { store: chat.store, conversation: chat._id }, options = { session };
  const locked = await db.collection("whatsappconversations").updateOne({ _id: chat._id, store: chat.store }, { $set: { aiEnabled: false }, $inc: { aiRevision: 1 } }, options);
  if (!locked.matchedCount) throw Error("Conversation changed during deletion");
  await db.collection("whatsappaijobs").deleteMany(filter, options);
  await db.collection("whatsappshoppingjobs").deleteMany({ store: chat.store, phone: chat.phone }, options);
  await db.collection("whatsappshoppingsessions").deleteMany({ store: chat.store, $or: [{ conversation: chat._id }, { phone: chat.phone }] }, options);
  await db.collection("whatsappavailabilityverifications").deleteMany({ store: chat.store, $or: [{ conversation: chat._id }, { customer: chat.phone }] }, options);
  const cursor = db.collection("whatsappmessages").find(filter, { session, projection: { metaId: 1 } });
  let ids = [];
  for await (const message of cursor) {
    if (message.metaId) ids.push(message.metaId);
    if (ids.length === 500) { await db.collection("whatsappreceipts").deleteMany({ store: chat.store, metaId: { $in: ids } }, options); ids = []; }
  }
  if (ids.length) await db.collection("whatsappreceipts").deleteMany({ store: chat.store, metaId: { $in: ids } }, options);
  await db.collection("whatsappmessages").deleteMany(filter, options);
  await db.collection("whatsappconversations").deleteOne({ _id: chat._id, store: chat.store }, options);
}
deleteChatRouter.get("/conversations/:id/delete-scope", async (req, res) => {
  const target = await targetFor(req);
  res.json({ data: { scope: target.scope, requiresProductionAuthentication: Boolean(target.productionChat), phone: target.chat.phone } });
});
deleteChatRouter.delete("/conversations/:id", rateLimit({ windowMs: 900000, limit: 10, keyGenerator: req => String(req.user._id) }), async (req, res) => {
  if (req.body?.confirmed !== true) throw new ApiError(400, "Confirm permanent chat deletion first");
  const target = await targetFor(req);
  if (target.productionChat) {
    const { productionUsername, productionPassword } = req.body;
    if (typeof productionUsername !== "string" || !/^[a-z0-9_.-]{1,100}$/i.test(productionUsername) || typeof productionPassword !== "string" || productionPassword.length > 128) throw new ApiError(400, "Enter the production owner's username and password");
    const owner = await target.db.collection("users").findOne({ username: productionUsername.toLowerCase(), tenantId: target.productionStore._id, role: "ADMIN", isActive: { $ne: false } }, { projection: { password: 1 } });
    if (!owner?.password || !await bcrypt.compare(productionPassword, owner.password)) throw new ApiError(403, "Production owner authentication failed. Nothing was deleted.");
  }
  const session = await mongoose.connection.startSession();
  try {
    await session.withTransaction(async () => {
      if (target.productionChat) await purge(target.db, target.productionChat, session);
      await purge(mongoose.connection.db, target.chat, session);
    });
  } catch { throw new ApiError(503, "Chat deletion could not complete atomically. Nothing was deleted; try again later."); }
  finally { await session.endSession(); }
  res.json({ data: { deleted: true, scope: target.scope } });
});
