import { test, expect } from "@playwright/test";
test("staging shopping preview shows catalog images, owner verification and takeover", async ({ page }, info) => {
  await page.goto("/secure/admin/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/secure\/admin\/dashboard/);
  let stopped = false, resolved = false;
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => socket.onMessage(() => socket.send(JSON.stringify({ type: "ready" }))));
  await page.route("**/api/v1/whatsapp/**", route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path.endsWith("/live-ticket")) data = { ticket: "fixture" };
    else if (path.endsWith("/conversations")) data = { configured: true, shoppingAvailable: true, conversations: [] };
    else if (path.endsWith("/ai/settings")) data = { enabled: false, instructions: "Reply in Bangla", tone: "Short", model: "gemini-3.1-flash-lite", keyConfigured: true, connectionState: "connected", autoRepliesAvailable: false, shoppingAvailable: true, stagingSettings: true, testRecipients: ["8801300000000"] };
    else if (path.endsWith("/verifications")) data = resolved ? [] : [{ _id: "request", productName: "Verified product", customer: "Test session", status: "pending" }];
    else if (path.endsWith("/verifications/request")) { resolved = true; data = { status: "available" }; }
    else if (path.endsWith("/sessions")) data = { id: "session" };
    else if (path.endsWith("/session/preview")) data = { reply: "আপনার বাজেটে এই প্রোডাক্টটি পাওয়া গেছে।", format: "images", searches: 1, products: [{ id: "product", name: "Verified product", salePrice: 850, images: ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='90' height='90' fill='pink'/%3E%3C/svg%3E"], url: "https://test-originsofbeauty.web.app/products/verified" }] };
    else if (path.endsWith("/session/ai")) { stopped = true; data = { aiEnabled: false }; }
    else throw Error(`Unexpected WhatsApp request: ${path}`);
    return route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp");
  await page.getByRole("button", { name: "Inbox menu" }).click();
  await page.getByRole("menuitem", { name: "AI Settings" }).click();
  await page.getByLabel("Customer message", { exact: true }).fill("১০০০ টাকার মধ্যে ফেসওয়াশ দেখান");
  await page.getByRole("button", { name: "Test shopping reply" }).click();
  await expect(page.getByText("৮৫০ টাকা", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Product details" })).toHaveAttribute("href", /\/products\/verified$/);
  await page.getByRole("button", { name: "Mark Available" }).click(); expect(resolved).toBeTruthy();
  await page.getByRole("button", { name: "Stop test / Human takeover" }).click(); expect(stopped).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: `artifacts/whatsapp-shopping-${info.project.name}.png`, fullPage: true });
});
