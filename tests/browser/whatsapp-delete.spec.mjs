import { test, expect } from "@playwright/test";
test("delete chat previews both environments, requires production authentication and refreshes the inbox", async ({ page }, info) => {
  await page.goto("/secure/admin/login"); await page.getByRole("button", { name: "Sign In", exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
  let deleted = false, attempts = 0;
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => socket.onMessage(() => socket.send(JSON.stringify({ type: "ready" }))));
  await page.route("**/api/v1/whatsapp/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname; let data;
    if (path.endsWith("live-ticket")) data = { ticket: "fixture" };
    else if (path.endsWith("conversations")) data = { configured: true, conversations: deleted ? [] : [{ _id: "fixture", name: "Test customer", phone: "8801300000000", preview: "Hello", lastMessageAt: new Date().toISOString() }] };
    else if (path.endsWith("delete-scope")) data = { scope: "production-and-staging", requiresProductionAuthentication: true, phone: "8801300000000" };
    else if (req.method() === "DELETE") {
      const body = req.postDataJSON(); expect(body.confirmed).toBe(true); expect(body.productionUsername).toBe("origins"); attempts++;
      if (body.productionPassword !== "test-only-password") return route.fulfill({ status: 403, json: { message: "Production owner authentication failed. Nothing was deleted." } });
      deleted = true; data = { deleted: true, scope: "production-and-staging" };
    } else data = { messages: [{ _id: "in", direction: "inbound", text: "Hello", timestamp: new Date().toISOString() }], canReply: true, windowExpiresAt: new Date(Date.now() + 3600000).toISOString() };
    await route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp"); await page.getByRole("button", { name: /Test customer/ }).click();
  const open = async () => { await page.getByRole("button", { name: "Chat menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Delete chat", exact: true }).click(); };
  await open(); const dialog = page.getByRole("dialog", { name: "Delete chat", exact: true });
  await expect(dialog).toContainText("BOTH production and staging"); await expect(dialog.getByRole("button", { name: "Delete everywhere" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); expect(attempts).toBe(0);
  await open(); await expect(dialog.getByLabel("Production password", { exact: true })).toHaveAttribute("type", "password");
  await dialog.getByLabel("Production username").fill("origins"); await dialog.getByLabel("Production password", { exact: true }).fill("incorrect"); await dialog.getByRole("button", { name: "Delete everywhere" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nothing was deleted"); await expect(dialog.getByLabel("Production password", { exact: true })).toHaveValue(""); expect(deleted).toBe(false);
  await page.screenshot({ path: `artifacts/whatsapp-delete-${info.project.name}.png`, fullPage: true });
  await dialog.getByLabel("Production password", { exact: true }).fill("test-only-password"); await dialog.getByRole("button", { name: "Delete everywhere" }).click();
  await expect(dialog).not.toBeVisible(); await expect(page.getByText("No conversations yet.", { exact: false })).toBeVisible(); expect(attempts).toBe(2);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes("test-only-password"))).toBe(false);
});
