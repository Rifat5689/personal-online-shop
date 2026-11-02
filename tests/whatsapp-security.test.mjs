import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validSignature, windowOpen } from "../backend/src/modules/whatsapp/whatsapp.security.js";
test("webhook signatures require the exact original bytes and secret", () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const signature = "sha256=" + createHmac("sha256", "test-secret").update(body).digest("hex");
  assert.equal(validSignature(body, signature, "test-secret"), true);
  assert.equal(validSignature(Buffer.from(body + " "), signature, "test-secret"), false);
  for (const bad of [undefined, "sha256=", "sha256=" + "z".repeat(64), "sha256=" + "0".repeat(64)]) assert.equal(validSignature(body, bad, "test-secret"), false);
  assert.equal(validSignature(body, signature, "wrong"), false);
  assert.equal(validSignature(body, signature, ""), false);
});
test("reply window closes exactly 24 hours after the last customer message", () => {
  const now = Date.now();
  assert.equal(windowOpen(new Date(now - 86400000 + 1), now), true);
  assert.equal(windowOpen(new Date(now - 86400000), now), false);
  assert.equal(windowOpen(new Date(now - 86400001), now), false);
  assert.equal(windowOpen(null, now), false);
  assert.equal(windowOpen(new Date(now + 1000), now), false);
});
