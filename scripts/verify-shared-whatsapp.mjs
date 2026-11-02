// Read settings from stdin. Probe only: never sends a WhatsApp message or creates records.
import { createHmac } from "node:crypto";
import mongoose from "../backend/node_modules/mongoose/index.js";
import jwt from "../backend/node_modules/jsonwebtoken/index.js";
import { WebSocket } from "../backend/node_modules/ws/wrapper.mjs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const configurations = JSON.parse(input);
const environments = [
  { key: "production", origin: "https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net", frontend: "https://originsofbeauty.web.app" },
  { key: "testing", origin: "https://test-originsofbeauty.azurewebsites.net", frontend: "https://test-originsofbeauty.web.app" },
];
for (const { key, origin, frontend } of environments) {
  // Windows PowerShell may serialize a pipeline array inside its `value` wrapper.
  const settings = Array.isArray(configurations[key]) ? configurations[key] : configurations[key]?.value;
  if (!Array.isArray(settings)) throw Error("Expected an Azure settings array on stdin");
  const value = name => settings.find(setting => setting.name === name)?.value;
  const verifyToken = value("WHATSAPP_VERIFY_TOKEN"), secret = value("META_APP_SECRET");
  if (!verifyToken || !secret) throw Error("Webhook verification settings missing");
  const aiEnvironment = process.argv.includes("--ai-both") || (key === "testing" && process.argv.includes("--ai-testing"));
  const expectedRelease = aiEnvironment ? "whatsapp-ai-20261101-3" : "whatsapp-live-20261101";
  let data;
  for (let attempt = 0; attempt < 36; attempt++) {
    try {
      const health = await fetch(origin + "/api/v1/health?verify=" + Date.now(), { signal: AbortSignal.timeout(10000) });
      data = (await health.json()).data;
      if (health.ok && data?.release === expectedRelease) break;
    } catch { /* Allow the bounded Azure startup interval. */ }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (data?.release !== expectedRelease) throw Error(`Expected release not ready on ${new URL(origin).hostname}`);
  console.log(`${new URL(origin).hostname}: database ${data.database}, release ${data.release}, mirror ${data.replication.status}`);
  const webhook = origin + "/api/v1/whatsapp/webhook";
  const query = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": verifyToken, "hub.challenge": "shared-webhook-verified" });
  const challenge = await fetch(webhook + "?" + query, { signal: AbortSignal.timeout(15000) });
  if (!challenge.ok || await challenge.text() !== "shared-webhook-verified") throw Error("Webhook verification failed");
  const unauthorized = await fetch(origin + "/api/v1/whatsapp/conversations", { signal: AbortSignal.timeout(15000) });
  if (unauthorized.status !== 401) throw Error("Admin auth protection check failed");
  const unsigned = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000) });
  if (unsigned.status !== 401) throw Error("Signature protection check failed");
  // An empty, signed notification exercises the entire relay without persisting customer data.
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const signed = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": signature }, body, signal: AbortSignal.timeout(30000) });
  if (signed.status !== 200) throw Error(`Signed webhook probe failed: ${signed.status}`);
  console.log("  Challenge, admin auth, signature rejection and signed notification: passed");
  // Read an existing administrator's ID and use a one-minute test session in memory.
  // No account/password changes, customer data output or message sends are involved.
  const db = await mongoose.createConnection(value("MONGODB_URI"), { serverSelectionTimeoutMS: 10000 }).asPromise();
  let access;
  try {
    const store = await db.db.collection("stores").findOne({ slug: "originsofbeauty", status: "ACTIVE" }, { projection: { _id: 1 } });
    const admin = store && await db.db.collection("users").findOne({ tenantId: store._id, role: { $in: ["ADMIN", "ECO"] }, isActive: { $ne: false } }, { projection: { _id: 1 } });
    if (!admin) throw Error("No active assigned admin for live connection check");
    access = jwt.sign({ _id: String(admin._id) }, value("ACCESS_TOKEN_SECRET"), { expiresIn: "60s" });
  } finally { await db.close(); }
  const ticketResponse = await fetch(origin + "/api/v1/whatsapp/live-ticket", { method: "POST", headers: { Authorization: `Bearer ${access}`, "X-App-Client": "store-admin", "X-Store-Slug": "originsofbeauty" }, signal: AbortSignal.timeout(15000) });
  if (!ticketResponse.ok) throw Error(`Admin live ticket failed: ${ticketResponse.status}`);
  const { ticket } = (await ticketResponse.json()).data;
  if (aiEnvironment) {
    const response = await fetch(origin + "/api/v1/whatsapp/ai/settings", { headers: { Authorization: `Bearer ${access}`, "X-Store-Slug": "originsofbeauty" }, signal: AbortSignal.timeout(15000) });
    const settings = (await response.json()).data;
    if (!response.ok || settings.enabled !== false || settings.autoRepliesAvailable !== (key === "production") || "encryptedKey" in settings || "apiKey" in settings) throw Error("AI settings protection check failed");
    console.log("  AI settings authenticated, global OFF, no API key returned: passed");
    console.log(`  ${key} setup: keyConfigured=${settings.keyConfigured}, instructionsConfigured=${Boolean(settings.instructions?.trim())}, connection=${settings.connectionState}`);
  }
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(origin.replace("https:", "wss:") + "/api/v1/whatsapp/live", { origin: frontend });
    const timer = setTimeout(() => { socket.terminate(); reject(Error("Production WebSocket handshake timed out")); }, 15000);
    socket.on("open", () => socket.send(JSON.stringify({ type: "auth", ticket })));
    socket.on("message", raw => { if (JSON.parse(raw).type === "ready") { clearTimeout(timer); socket.close(); resolve(); } });
    socket.on("error", () => { clearTimeout(timer); reject(Error("WebSocket connection failed")); });
    socket.on("close", code => { if (code !== 1000) { clearTimeout(timer); reject(Error(`WebSocket closed: ${code}`)); } });
  });
  console.log("  Authenticated WSS connection: passed");
  if (process.argv.includes("--browser")) {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.addInitScript(token => sessionStorage.setItem("ownshop_access", token), access);
      await page.goto(frontend + "/secure/admin/whatsapp", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "WhatsApp inbox", exact: true }).waitFor({ timeout: 30000 });
      await page.getByText("Live · Connected", { exact: true }).waitFor({ timeout: 30000 });
      if (await page.locator(".wa-error").count()) throw Error("Inbox displays an error");
      console.log("  Public admin inbox in browser, authenticated and live: passed");
      if (aiEnvironment) {
        await page.getByRole("button", { name: "Inbox menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "AI Settings", exact: true }).click();
        await page.getByLabel("About Me / AI Personality & Instructions", { exact: true }).waitFor({ timeout: 20000 });
        if (await page.getByLabel("Gemini API key", { exact: true }).inputValue() !== "") throw Error("Saved key must not appear in the browser");
        if (await page.getByRole("switch", { name: "Global AI Auto Reply" }).isChecked()) throw Error("AI must stay off");
        await page.getByRole("button", { name: "Close AI Settings" }).click();
        console.log("  Three-dot AI settings, editable personality field and private empty key field: passed");
      }
    } finally { await browser.close(); }
  }
}
