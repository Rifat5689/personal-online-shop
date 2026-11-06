import { test, expect } from "@playwright/test";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lCEAAAAASUVORK5CYII=", "base64");
test("WhatsApp-style media composer previews photos/videos and requires AI off", async ({ page }, info) => {
  await page.goto("/secure/admin/login"); await page.getByRole("button", { name: "Sign In", exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
  let ai = false, productionOwnsChat = true, sends = 0; const messages = [{ _id: "inbound", direction: "inbound", text: "Apu product er pic den", type: "text", timestamp: new Date().toISOString(), status: "received" }];
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => socket.onMessage(() => socket.send(JSON.stringify({ type: "ready" }))));
  await page.route("**/api/v1/whatsapp/**", async route => {
    const path = new URL(route.request().url()).pathname; let data;
    if (path.endsWith("live-ticket")) data = { ticket: "fixture" };
    else if (path.endsWith("conversations")) data = { configured: true, aiEnabled: true, productionAIEnabled: true, autoRepliesAvailable: false, conversations: [{ _id: "fixture", name: "Test customer", phone: "8801300000000", stagingTest: true, productionAIEnabled: productionOwnsChat, aiEnabled: ai, preview: "Apu product er pic den", lastMessageAt: new Date().toISOString() }] };
    else if (path.endsWith("/takeover")) { expect(route.request().postDataJSON().confirmed).toBe(true); productionOwnsChat = false; data = { aiEnabled: false }; }
    else if (path.endsWith("/ai")) { ai = route.request().postDataJSON().enabled; data = { aiEnabled: ai }; }
    else if (path.endsWith("/media")) {
      expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
      expect(route.request().postDataBuffer().toString()).toContain("Product details"); sends++;
      data = { _id: `out-${sends}`, direction: "outbound", type: sends === 1 ? "image" : "video", imageUrl: sends === 1 ? `data:image/png;base64,${png.toString("base64")}` : undefined, text: "Product details", timestamp: new Date().toISOString(), status: "sent" }; messages.push(data);
    } else data = { messages, canReply: true, windowExpiresAt: new Date(Date.now() + 3600000).toISOString() };
    await route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp"); await page.getByRole("button", { name: /Test customer/ }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeDisabled(); await page.getByRole("button", { name: "Take over chat", exact: true }).click(); await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Emoji", exact: true }).click(); await page.getByRole("button", { name: "Insert 😊", exact: true }).click(); await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue("😊"); await page.getByRole("textbox", { name: "Message", exact: true }).fill("");
  await page.getByRole("button", { name: "Attach media", exact: true }).click(); await expect(page.getByRole("button", { name: "Photos", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Videos", exact: true })).toBeVisible();
  await page.getByLabel("Choose photo or video").setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Photo ready to send")).toBeVisible(); await page.getByRole("textbox", { name: "Message", exact: true }).fill("Product details");
  await page.getByRole("button", { name: "Send message", exact: true }).click(); await expect(page.getByRole("log")).toContainText("Product details"); expect(sends).toBe(1);
  await page.getByLabel("Choose photo or video").setInputFiles({ name: "product.mp4", mimeType: "video/mp4", buffer: Buffer.from("video fixture") });
  await expect(page.getByText("product.mp4", { exact: true })).toBeVisible(); await expect(page.locator(".wa-attachment-preview video")).toHaveAttribute("controls", "");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Product details"); await page.getByRole("button", { name: "Send message", exact: true }).click(); await expect.poll(() => sends).toBe(2);
  await page.getByRole("switch", { name: "AI for this conversation" }).click(); await expect(page.getByRole("button", { name: "Attach media", exact: true })).toBeDisabled();
  await page.getByRole("switch", { name: "AI for this conversation" }).click(); await expect(page.getByRole("button", { name: "Attach media", exact: true })).toBeEnabled();
  await page.getByLabel("Choose photo or video").setInputFiles({ name: "not-a-photo.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") }); await expect(page.getByRole("alert")).toContainText("Choose JPEG/PNG");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => { const nav = document.querySelector(".admin-bottom-nav"), compose = document.querySelector(".wa-compose"); return !nav || getComputedStyle(nav).display === "none" || compose.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top; })).toBe(true);
  await page.screenshot({ path: `artifacts/whatsapp-redesign-${info.project.name}.png`, fullPage: true });
});
