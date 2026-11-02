import { createHmac, timingSafeEqual } from "node:crypto";
export function validSignature(raw, signature, secret) {
  if (!secret || !Buffer.isBuffer(raw) || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function windowOpen(lastInboundAt, now = Date.now()) {
  const time = new Date(lastInboundAt || 0).getTime();
  return time > 0 && time <= now && now - time < 24 * 60 * 60 * 1000;
}
