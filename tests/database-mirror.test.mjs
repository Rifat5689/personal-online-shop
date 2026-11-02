import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "../backend/node_modules/mongoose/index.js";
import { DatabaseMirror } from "../backend/src/services/database-mirror.service.js";
const { MongoClient, Collection } = mongoose.mongo;
const until = async (check) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error("Mirror did not converge before timeout");
};

test("one-way database mirror preserves production isolation, resumes writes and protects local-only data", { timeout: 120000 }, async (context) => {
  const cluster = await MongoMemoryReplSet.create({ instanceOpts: [{ args: ["--wiredTigerCacheSizeGB", "0.25"] }], replSet: { count: 1 }, binary: { version: "7.0.14" } });
  const client = new MongoClient(cluster.getUri());
  await client.connect();
  const source = client.db("production"), target = client.db("testing");
    const collections = ["users", "products", "orders", "customers", "whatsappconversations", "whatsappmessages", "whatsappreceipts"];
  const workers = [];
  const create = (options = {}) => {
    const status = {};
    const worker = new DatabaseMirror({ source, target, collections, status, retryMs: 100, leaseMs: 5000, log: { warn() {} }, ...options }).start();
    workers.push(worker);
    return { worker, status };
  };
  try {
    await target.collection("users").createIndex({ username: 1 }, { unique: true });
    await target.collection("users").insertOne({ _id: "old-local-user", username: "shop-owner", local: true });
    await target.collection("products").insertOne({ _id: "local-only", name: "Local product" });
    await source.collection("users").insertOne({ _id: "primary-user", username: "shop-owner", password: "hashed-password", refreshToken: "production-session-secret" });
    await source.collection("products").insertOne({ _id: "product", name: "Primary product", stock: 10, obsolete: true, images: [1, 2] });
    await source.collection("unrelated_portfolio").insertOne({ _id: 1, private: true });
    let active = create();
    await until(async () => active.status.status === "streaming" && await target.collection("users").findOne({ _id: "primary-user" }));
    assert.match((await target.collection("users").findOne({ _id: "old-local-user" })).username, /^local-/);
    assert.equal((await target.collection("_personalshop_mirror_conflicts").findOne({})).original.username, "shop-owner");
    assert.equal((await target.collection("users").findOne({ _id: "primary-user" })).refreshToken, undefined);
    await target.collection("users").updateOne({ _id: "primary-user" }, { $set: { refreshToken: "local-session" } });
    await source.collection("users").updateOne({ _id: "primary-user" }, { $set: { email: "new@example.test" } });
    await until(async () => (await target.collection("users").findOne({ _id: "primary-user" }))?.email === "new@example.test");
    assert.equal((await target.collection("users").findOne({ _id: "primary-user" })).refreshToken, "local-session");
    assert.equal(await target.collection("unrelated_portfolio").countDocuments(), 0);
    assert.ok(await target.collection("products").findOne({ _id: "local-only" }));

    const session = client.startSession();
    await session.withTransaction(async () => {
      await source.collection("orders").insertOne({ _id: "order", customerId: "customer", total: 100 }, { session });
      await source.collection("customers").insertOne({ _id: "customer", name: "Customer" }, { session });
      await source.collection("products").updateOne({ _id: "product" }, { $inc: { stock: -1 }, $unset: { obsolete: "" }, $set: { images: [2] } }, { session });
    });
    await session.endSession();
    await until(async () => (await target.collection("products").findOne({ _id: "product" }))?.stock === 9 && await target.collection("orders").findOne({ _id: "order" }) && await target.collection("customers").findOne({ _id: "customer" }));
    assert.deepEqual((await target.collection("products").findOne({ _id: "product" })).images, [2]);
    assert.equal((await target.collection("products").findOne({ _id: "product" })).obsolete, undefined);
    await target.collection("products").deleteOne({ _id: "product" });
    assert.equal((await source.collection("products").findOne({ _id: "product" })).stock, 9);
    await source.collection("products").updateOne({ _id: "product" }, { $set: { stock: 8 } });
    await until(async () => (await target.collection("products").findOne({ _id: "product" }))?.stock === 8);
    await target.collection("products").updateOne({ _id: "product" }, { $set: { stock: 500 } });
    assert.equal((await source.collection("products").findOne({ _id: "product" })).stock, 8);

    // One production webhook record supplies both inboxes; replies and receipts
    // written in production stream to testing without another webhook write.
    await source.collection("whatsappconversations").insertOne({ _id: "wa-chat", phone: "8801700000000" });
    await source.collection("whatsappmessages").insertOne({ _id: "wa-in", conversation: "wa-chat", metaId: "wamid.in", direction: "inbound", text: "Customer message" });
    await source.collection("whatsappmessages").insertOne({ _id: "wa-out", conversation: "wa-chat", metaId: "wamid.out", direction: "outbound", status: "sent" });
    await source.collection("whatsappreceipts").insertOne({ _id: "wa-receipt", metaId: "wamid.out", status: "read" });
    await source.collection("whatsappmessages").updateOne({ _id: "wa-out" }, { $set: { status: "read" } });
    await until(async () => !!await target.collection("whatsappconversations").findOne({ _id: "wa-chat" }) && (await target.collection("whatsappmessages").findOne({ _id: "wa-out" }))?.status === "read" && !!await target.collection("whatsappreceipts").findOne({ _id: "wa-receipt" }));
    assert.equal(await target.collection("whatsappmessages").countDocuments({ metaId: "wamid.in" }), 1);
    await target.collection("whatsappmessages").insertOne({ _id: "wa-local", conversation: "wa-chat", text: "Testing-only reply" });
    assert.equal(await source.collection("whatsappmessages").findOne({ _id: "wa-local" }), null);

    await active.worker.stop();
    await source.collection("products").updateOne({ _id: "product" }, { $set: { stock: 7 } });
    await source.collection("orders").deleteOne({ _id: "order" });
    active = create();
    await until(async () => (await target.collection("products").findOne({ _id: "product" }))?.stock === 7 && !await target.collection("orders").findOne({ _id: "order" }));

    let unavailable = true;
    const original = Collection.prototype.replaceOne;
    context.mock.method(Collection.prototype, "replaceOne", async function (...args) {
      if (unavailable && this.dbName === "testing" && this.collectionName === "customers") throw Object.assign(new Error("secret-connection-string"), { code: "NETWORK_OUTAGE" });
      return original.apply(this, args);
    });
    await source.collection("customers").insertOne({ _id: "during-outage", name: "Still accepted in production" });
    await until(() => active.status.status === "retrying");
    assert.ok(await source.collection("customers").findOne({ _id: "during-outage" }));
    assert.equal(await target.collection("customers").findOne({ _id: "during-outage" }), null);
    unavailable = false;
    await until(async () => !!await target.collection("customers").findOne({ _id: "during-outage" }));

    const standby = create();
    await until(() => standby.status.status === "standby");
    await active.worker.stop();
    await until(() => standby.status.status === "streaming");
    await source.collection("products").deleteMany({ _id: "product" });
    await until(async () => !await target.collection("products").findOne({ _id: "product" }));
    assert.ok(await target.collection("products").findOne({ _id: "local-only" }));
    await standby.worker.stop();

    // Recovery snapshots remove only previously mirrored rows, preserving local-only data.
    await source.collection("customers").deleteOne({ _id: "customer" });
    await target.collection("_personalshop_mirror_state").updateOne({ _id: "production-to-test" }, { $set: { phase: "snapshot", startTime: null, generation: "recovery", resumeToken: null } });
    active = create();
    await until(async () => active.status.status === "streaming" && !await target.collection("customers").findOne({ _id: "customer" }));
    assert.ok(await target.collection("products").findOne({ _id: "local-only" }));
    await active.worker.stop();
    const rejected = create({ target: source });
    await until(() => rejected.status.status === "blocked");
    assert.equal(rejected.status.errorCode, "SAME_DATABASE");
    assert.equal(await source.collection("_personalshop_mirror_state").countDocuments(), 0);
  } finally {
    await Promise.all(workers.map((worker) => worker.stop()));
    await client.close();
    await cluster.stop();
  }
});
