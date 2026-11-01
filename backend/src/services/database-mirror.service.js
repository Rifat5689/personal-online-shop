import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";

const { MongoClient, BSON } = mongoose.mongo;
const STATE = "_ownshop_mirror_state";
const OWNED = "_ownshop_mirror_documents";
const ARCHIVE = "_ownshop_mirror_conflicts";
const ID = "production-to-test";
const digest = (value) => createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex");
const ownedId = (collection, id) => digest({ collection, id });
export const mirrorStatus = { status: "disabled", lastCheckedAt: null, lastAppliedAt: null };

export class DatabaseMirror {
  constructor({ source, target, collections, status = {}, retryMs = 3000, leaseMs = 30000, log = console }) {
    this.source = source;
    this.target = target;
    this.collections = new Set(collections);
    this.status = status;
    this.retryMs = retryMs;
    this.leaseMs = leaseMs;
    this.log = log;
    this.owner = randomUUID();
    this.stopped = false;
  }
  start() {
    this.status.status = "starting";
    this.task = this.run();
    return this;
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.wake?.();
    await this.stream?.close().catch(() => {});
    await this.task;
    if (this.target.client.topology?.isConnected()) {
      await this.target.collection(STATE).updateOne({ _id: ID, owner: this.owner }, { $unset: { owner: "" }, $set: { leaseUntil: new Date(0) } }).catch(() => {});
    }
  }
  async pause() {
    if (this.stopped) return;
    await new Promise((resolve) => { this.wake = resolve; this.timer = setTimeout(resolve, this.retryMs); });
    this.wake = null;
  }
  async identity() {
    const [a, b] = await Promise.all([this.source.command({ hello: 1 }), this.target.command({ hello: 1 })]);
    const identity = (db, hello) => ({ database: db.databaseName, servers: [...(hello.hosts || [db.client.options.srvHost || db.client.options.hosts?.map(String).join(",")])].sort(), set: hello.setName || null });
    const primary = identity(this.source, a), secondary = identity(this.target, b);
    if (digest(primary) === digest(secondary)) throw Object.assign(new Error("Mirror databases must be different"), { code: "SAME_DATABASE" });
    this.fingerprint = digest(primary);
  }
  async acquire() {
    const state = this.target.collection(STATE);
    const existing = await state.findOne({ _id: ID });
    if (existing?.source && existing.source !== this.fingerprint) throw Object.assign(new Error("Mirror belongs to a different source"), { code: "SOURCE_MISMATCH" });
    try {
      return await state.findOneAndUpdate(
        { _id: ID, $or: [{ leaseUntil: { $lt: new Date() } }, { owner: this.owner }, { owner: { $exists: false } }] },
        { $set: { owner: this.owner, leaseUntil: new Date(Date.now() + this.leaseMs) }, $setOnInsert: { source: this.fingerprint, phase: "snapshot" } },
        { upsert: true, returnDocument: "after" },
      );
    } catch (error) { if (error.code === 11000) return null; throw error; }
  }
  async transaction(action, checkpoint = {}) {
    const session = this.target.client.startSession();
    try {
      await session.withTransaction(async () => {
        const lease = await this.target.collection(STATE).updateOne(
          { _id: ID, owner: this.owner, leaseUntil: { $gt: new Date() } },
          { $set: { ...checkpoint, leaseUntil: new Date(Date.now() + this.leaseMs), checkedAt: new Date() } },
          { session },
        );
        if (lease.matchedCount !== 1) throw Object.assign(new Error("Mirror lease lost"), { code: "LEASE_LOST" });
        await action(session);
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 });
    } finally { await session.endSession(); }
    this.status.lastCheckedAt = new Date().toISOString();
  }
  async preserveConflict(collection, document, error, session) {
    if (error.code !== 11000 || !error.keyValue) throw error;
    const conflict = await this.target.collection(collection).findOne(error.keyValue, { session });
    if (!conflict || digest(conflict._id) === digest(document._id)) throw error;
    await this.target.collection(ARCHIVE).updateOne(
      { _id: ownedId(collection, conflict._id) },
      { $setOnInsert: { collection, original: conflict, archivedAt: new Date(), reason: "unique-key collision with production" } },
      { upsert: true, session },
    );
    const field = ["slug", "username", "usernameLower", "email", "transactionId", "idempotencyKey"].find((key) => error.keyPattern?.[key] && typeof conflict[key] === "string");
    if (field) {
      const suffix = digest(conflict._id).slice(0, 20);
      await this.target.collection(collection).updateOne({ _id: conflict._id }, { $set: { [field]: field === "email" ? `local-${suffix}@example.invalid` : `local-${suffix}`, ...(collection === "customers" && field === "usernameLower" ? { username: `local-${suffix}` } : {}), ...(collection === "stores" && field === "slug" ? { name: `${conflict.name} (local copy)` } : {}) } }, { session });
    } else {
      // A foreign-key-only unique conflict is the same logical resource (e.g. cart).
      await this.target.collection(collection).deleteOne({ _id: conflict._id }, { session });
    }
  }
  async writeDocument(collection, id, document, generation, checkpoint) {
    // Duplicate-key aborts a transaction: resolve the conflict in its own fenced
    // transaction, then retry the atomic document/checkpoint operation.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await this.transaction(async (session) => {
          if (document) {
            let copy = document;
            if (["users", "customers"].includes(collection)) {
              const local = await this.target.collection(collection).findOne({ _id: id }, { session });
              copy = { ...document };
              for (const field of ["refreshToken", "resetPasswordToken", "passwordResetToken", "verificationToken"]) {
                delete copy[field];
                if (local?.[field] !== undefined && local.password === document.password) copy[field] = local[field];
              }
            }
            await this.target.collection(collection).replaceOne({ _id: id }, copy, { upsert: true, session });
            await this.target.collection(OWNED).updateOne({ _id: ownedId(collection, id) }, { $set: { collection, documentId: id, generation } }, { upsert: true, session });
          } else {
            await this.target.collection(collection).deleteOne({ _id: id }, { session });
            await this.target.collection(OWNED).deleteOne({ _id: ownedId(collection, id) }, { session });
          }
        }, checkpoint);
        this.status.lastAppliedAt = new Date().toISOString();
        return;
      } catch (error) {
        if (error.code !== 11000 || !document) throw error;
        await this.transaction((session) => this.preserveConflict(collection, document, error, session));
      }
    }
    throw Object.assign(new Error("Unresolved mirror conflict"), { code: "UNIQUE_CONFLICT" });
  }
  async snapshot(state) {
    const hello = await this.source.command({ hello: 1 });
    const startTime = state.startTime || hello.operationTime || hello.$clusterTime?.clusterTime;
    if (!startTime) throw Object.assign(new Error("Change streams require a replica set"), { code: "NO_OPERATION_TIME" });
    const generation = state.generation || randomUUID();
    await this.transaction(async () => {}, { startTime, generation, phase: "snapshot", resumeToken: state.resumeToken || null });
    for (const name of this.collections) {
      if (this.stopped) return;
      for await (const document of this.source.collection(name).find({}, { readConcern: { level: "majority" } })) {
        if (this.stopped) return;
        await this.writeDocument(name, document._id, document, generation, {});
      }
    }
    // Remove only records this mirror owned before a recovery snapshot. Local-only
    // records survive. Ownership is persisted independently of local deletions.
    for await (const old of this.target.collection(OWNED).find({ generation: { $ne: generation } })) {
      if (this.stopped) return;
      if (this.collections.has(old.collection)) await this.writeDocument(old.collection, old.documentId, null, generation, {});
    }
    await this.transaction(async () => {}, { phase: "streaming" });
    return { startTime, generation, phase: "streaming", resumeToken: state.resumeToken };
  }
  async streamChanges(state) {
    const options = { maxAwaitTimeMS: 1000, ...(state.resumeToken ? { resumeAfter: state.resumeToken } : { startAtOperationTime: state.startTime }) };
    this.stream = this.source.watch([{ $match: { "ns.coll": { $in: [...this.collections] } } }], options);
    this.status.status = "starting";
    while (!this.stopped) {
      const change = await this.stream.tryNext();
      if (this.stream.closed && !this.stopped) throw Object.assign(new Error("Mirror cursor closed"), { code: 280 });
      this.status.status = "streaming";
      delete this.status.errorCode;
      if (!change) {
        await this.transaction(async () => {}, this.stream.resumeToken ? { resumeToken: this.stream.resumeToken } : {});
        continue;
      }
      const name = change.ns.coll;
      const checkpoint = { resumeToken: change._id };
      if (["insert", "update", "replace", "delete"].includes(change.operationType)) {
        const id = change.documentKey._id;
        const document = await this.source.collection(name).findOne({ _id: id }, { readConcern: { level: "majority" } });
        await this.writeDocument(name, id, document, state.generation, checkpoint);
      } else if (change.operationType === "drop" || change.operationType === "rename") {
        // Reconcile owned records after collection-level changes. Never drop test DB.
        await this.transaction(async () => {}, { phase: "snapshot", startTime: change.clusterTime, generation: randomUUID(), resumeToken: change._id });
        return;
      } else {
        await this.transaction(async () => {}, checkpoint);
      }
    }
  }
  async run() {
    while (!this.stopped) {
      try {
        await this.target.client.connect();
        await this.identity();
        // Internal collections must exist before transactions on older replica sets.
        for (const name of [STATE, OWNED, ARCHIVE]) await this.target.createCollection(name).catch((error) => { if (error.code !== 48) throw error; });
        let state = await this.acquire();
        if (!state) { this.status.status = "standby"; await this.pause(); continue; }
        const collectionsHash = digest([...this.collections].sort());
        if (state.collectionsHash !== collectionsHash) {
          await this.transaction(async () => {}, { collectionsHash, phase: "snapshot", startTime: null, resumeToken: null, generation: randomUUID() });
          state = await this.target.collection(STATE).findOne({ _id: ID });
        }
        if (state.phase !== "streaming") state = await this.snapshot(state);
        if (this.stopped) break;
        await this.streamChanges(state);
      } catch (error) {
        if (this.stopped) break;
        this.status.status = ["SAME_DATABASE", "SOURCE_MISMATCH", "UNIQUE_CONFLICT"].includes(error.code) ? "blocked" : "retrying";
        this.status.errorCode = String(error.code || error.name || "MIRROR_ERROR");
        this.log.warn("Database mirror paused; production remains primary", { code: this.status.errorCode });
        if ([136, 237, 260, 280, 286, 40573].includes(error.code)) {
          await this.target.collection(STATE).updateOne({ _id: ID, owner: this.owner }, { $set: { phase: "snapshot", startTime: null, resumeToken: null, generation: randomUUID() } }).catch(() => {});
        }
        await this.pause();
      } finally {
        await this.stream?.close().catch(() => {});
        this.stream = null;
      }
    }
  }
}

let active;
let targetClient;
export function startDatabaseMirror() {
  if (process.env.DB_MIRROR_ENABLED !== "true") return;
  try {
    targetClient = new MongoClient(process.env.MONGODB_MIRROR_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 5, retryWrites: true });
    const collections = [...new Set(Object.values(mongoose.connection.models).map((model) => model.collection.collectionName))];
    active = new DatabaseMirror({ source: mongoose.connection.db, target: targetClient.db(), collections, status: mirrorStatus }).start();
  } catch {
    mirrorStatus.status = "blocked";
    mirrorStatus.errorCode = "INVALID_MIRROR_CONFIG";
    console.warn("Database mirror configuration is invalid; production remains primary");
  }
}
export async function stopDatabaseMirror() {
  await active?.stop();
  await targetClient?.close();
}
