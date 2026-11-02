import { test, expect } from "@playwright/test";
test("three-dot AI settings save personality and a private key, and preview without sending", async ({ page }, info) => {
  await page.goto("/secure/admin/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/secure\/admin\/dashboard/);
  let settings = { enabled: false, instructions: "", tone: "Friendly", model: "gemini-3.8-flash", keyConfigured: false, connectionState: "unconfigured", autoRepliesAvailable: true };
  let saves = 0, sends = 0;
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => socket.onMessage(() => socket.send(JSON.stringify({ type: "ready" }))));
  await page.route("**/api/v1/whatsapp/**", route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data;
    if (path.endsWith("/live-ticket")) data = { ticket: "fixture" };
    else if (path.endsWith("/conversations")) data = { configured: true, aiEnabled: settings.enabled, conversations: [{ _id: "fixture", name: "Customer", phone: "8801700000000", preview: "Hello", lastMessageAt: new Date().toISOString() }] };
    else if (path.endsWith("/ai/settings")) {
      if (req.method() === "PUT") { const body = req.postDataJSON(); expect(body.apiKey).toBe("qa-browser-only-key"); settings = { ...settings, enabled: body.enabled, instructions: body.instructions, tone: body.tone, model: body.model, keyConfigured: true, connectionState: "connected" }; saves++; }
      data = settings;
    } else if (path.endsWith("/ai/models")) data = { models: ["gemini-3.8-flash", "gemini-3.5-flash-lite"] };
    else if (path.endsWith("/ai/enabled")) { settings.enabled = req.postDataJSON().enabled; data = settings; }
    else if (path.endsWith("/ai/preview")) data = { reply: "Assalamu alaikum! Apnake kivabe help korte pari?", model: settings.model };
    else {
      if (req.method() === "POST") sends++;
      data = { messages: [{ _id: "one", direction: "inbound", text: "Hello", timestamp: new Date().toISOString() }], canReply: true, windowExpiresAt: new Date(Date.now() + 3600000).toISOString() };
    }
    return route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp");
  await page.getByRole("button", { name: /Customer/ }).click();
  await page.getByRole("button", { name: "Inbox menu" }).click();
  await page.getByRole("menuitem", { name: "AI Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "AI Settings" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("switch", { name: "Global AI Auto Reply" })).not.toBeChecked();
  const personality = page.getByLabel("About Me / AI Personality & Instructions", { exact: true });
  const instructions = "I run Origins of Beauty. Speak in warm, concise Banglish. Use only the business facts I provide.";
  await personality.fill(instructions);
  await page.getByLabel("Gemini API key", { exact: true }).fill("qa-browser-only-key");
  await expect(page.getByLabel("Gemini API key", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Connection verified" })).toBeVisible();
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Settings saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Gemini API key", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Test AI Response", exact: true }).click();
  await expect(page.getByText("Assalamu alaikum! Apnake kivabe help korte pari?", { exact: true })).toBeVisible();
  expect(saves).toBe(1); expect(sends).toBe(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes("qa-browser-only-key"))).toBeFalsy();
  await page.locator(".wa-settings-form").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/whatsapp-ai-settings-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Close AI Settings" }).click();
  await page.getByRole("button", { name: "Inbox menu" }).click(); await page.getByRole("menuitem", { name: "AI Settings" }).click();
  await expect(personality).toHaveValue(instructions);
  await expect(page.getByLabel("Gemini API key", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});
