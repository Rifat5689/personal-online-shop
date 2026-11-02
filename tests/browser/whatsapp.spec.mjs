import { test, expect } from "@playwright/test";
test("WebSocket notifications refresh the chat immediately", async ({ page }) => {
  await page.goto("/secure/admin/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/secure\/admin\/dashboard/);
  let liveSocket, updated = false;
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => {
    liveSocket = socket;
    socket.onMessage(raw => {
      const event = JSON.parse(String(raw));
      expect(event.type).toBe("auth");
      expect(event.ticket).toBe("browser-fixture-ticket");
      socket.send(JSON.stringify({ type: "ready" }));
    });
  });
  await page.route("**/api/v1/whatsapp/**", route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/live-ticket") ? { ticket: "browser-fixture-ticket" } : path.endsWith("/conversations") ? { conversations: [{ _id: "fixture", name: "Live customer", phone: "8801700000000", preview: "Hello" }], configured: true } : { messages: [{ _id: "one", direction: "inbound", text: updated ? "New message via WebSocket" : "Initial message", timestamp: new Date().toISOString(), status: "received" }], canReply: true, windowExpiresAt: new Date(Date.now() + 3600000).toISOString() };
    return route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp");
  await expect(page.getByText("Live · Connected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Live customer/ }).click();
  await expect(page.getByRole("log")).toContainText("Initial message");
  updated = true;
  liveSocket.send(JSON.stringify({ type: "invalidate" }));
  await expect(page.getByRole("log")).toContainText("New message via WebSocket", { timeout: 2000 });
  liveSocket.close();
  await expect(page.getByText("Connecting live chat · Updates refresh automatically", { exact: true })).toBeVisible();
});
test("WhatsApp inbox renders conversations and responsive chat without sending live messages", async ({ page }, info) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/secure/admin/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/secure\/admin\/dashboard/);
  await page.goto("/secure/admin/whatsapp");
  await expect(page.getByRole("heading", { name: "WhatsApp inbox" })).toBeVisible();
  await expect(page.getByText("No conversations yet.", { exact: false })).toBeVisible();
  // Representative conversation is browser-only fixture data; no test message reaches Meta.
  await page.route("**/api/v1/whatsapp/**", route => route.fulfill({ json: { data: route.request().url().endsWith("/conversations") ? {
    conversations: [{ _id: "fixture", name: "Test customer", phone: "8801700000000", preview: "Hello from WhatsApp", lastMessageAt: new Date().toISOString() }], configured: true,
  } : { messages: [{ _id: "one", direction: "inbound", text: "Hello from WhatsApp", timestamp: new Date().toISOString(), status: "received" }, { _id: "two", direction: "outbound", text: "How can we help?", timestamp: new Date().toISOString(), status: "delivered" }], canReply: true, windowExpiresAt: new Date(Date.now() + 3600000).toISOString() } } }));
  await page.reload();
  await page.getByRole("button", { name: /Test customer/ }).click();
  await expect(page.getByRole("log")).toContainText("Hello from WhatsApp");
  await expect(page.getByRole("log")).toContainText("delivered");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: `artifacts/whatsapp-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
