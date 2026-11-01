import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
export function liveTicket(req, res) {
  const admin = Boolean(req.user);
  const visitorId = req.body?.visitorId;
  if (!admin && !/^[a-f0-9-]{36}$/i.test(visitorId || "")) throw new ApiError(400, "Invalid visitor identifier");
  const ticket = jwt.sign({ tenantId: String(req.store._id), role: admin ? "admin" : "visitor", visitorId: admin ? undefined : visitorId, userId: admin ? String(req.user._id) : undefined }, process.env.ACCESS_TOKEN_SECRET, { audience: "live-analytics", expiresIn: "60s", jwtid: randomUUID() });
  res.set("Cache-Control", "no-store").json(new ApiResponse(200, { ticket }, "Live connection ready"));
}
