import { ipKeyGenerator } from "express-rate-limit";

// Azure forwards IPv4:port and [IPv6]:port. Ports must not split rate limits.
export function clientKey(req) {
  const raw = req.ip || req.socket?.remoteAddress || "unknown";
  const bracketed = raw.match(/^\[([\da-f:]+)\]:\d+$/i);
  const address = bracketed ? bracketed[1] : raw.replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  return ipKeyGenerator(address);
}
