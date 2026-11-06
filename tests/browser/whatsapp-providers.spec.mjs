import { test, expect } from "@playwright/test";
test("Groq configuration keeps keys private and supports primary, fallback and model selection", async ({ page }) => {
  await page.goto("/secure/admin/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  let settings = { enabled: false, instructions: "Reply briefly in Bangla.", tone: "Friendly", model: "gemini-3.1-flash-lite", primaryProvider: "gemini", fallbackProvider: "none", keyConfigured: true, geminiKeyConfigured: true, groqKeyConfigured: false, connectionState: "connected", autoRepliesAvailable: true };
  await page.routeWebSocket("**/api/v1/whatsapp/live", socket => socket.onMessage(() => socket.send(JSON.stringify({ type: "ready" }))));
  await page.route("**/api/v1/whatsapp/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path.endsWith("live-ticket")) data = { ticket: "fixture" };
    else if (path.endsWith("conversations")) data = { configured: true, conversations: [] };
    else if (path.endsWith("ai/models")) data = { models: ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"], visionModels: ["qwen/qwen3.8-27b"], limits: {} };
    else if (path.endsWith("ai/connection")) data = { provider: "groq", state: "connected", limits: { "x-ratelimit-limit-tokens": "8000" } };
    else if (path.endsWith("ai/settings")) {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        expect(body.groqApiKey).toBe("test-private-groq"); expect(body.primaryProvider).toBe("groq"); expect(body.fallbackProvider).toBe("gemini");
        const { groqApiKey, ...safe } = body;
        settings = { ...settings, ...safe, groqKeyConfigured: true, providerConnections: { groq: { state: "connected" } } };
      }
      data = settings;
    } else throw Error(`Unexpected request ${path}`);
    await route.fulfill({ json: { data } });
  });
  await page.goto("/secure/admin/whatsapp");
  await page.getByRole("button", { name: "Inbox menu" }).click();
  await page.getByRole("menuitem", { name: "AI Settings" }).click();
  await page.getByLabel("Primary AI provider").selectOption("groq");
  await page.getByLabel("Fallback provider").selectOption("gemini");
  await page.getByLabel("Groq API key", { exact: true }).fill("test-private-groq");
  await expect(page.getByLabel("Groq API key", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Retrieve Groq models" }).click();
  await page.getByLabel("Groq text model").selectOption("openai/gpt-oss-20b");
  await page.getByLabel("Groq vision model").selectOption("qwen/qwen3.8-27b");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Settings saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Groq API key", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Test Connection", exact: true }).click();
  await expect(page.getByText("Connection and reply generation verified.")).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes("test-private-groq"))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
