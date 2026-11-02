import { test, expect } from "@playwright/test";

test("privacy policy is public, readable, linked and survives a direct refresh", async ({ page }, info) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/privacy-policy");
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Privacy Policy | Origins of Beauty");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /WhatsApp messages/);
  await expect(page.locator(".privacy-policy-content")).toContainText("official WhatsApp Cloud API");
  await expect(page.getByRole("link", { name: "originsofbeauty9@gmail.com", exact: true })).toHaveAttribute("href", /mailto:originsofbeauty9@gmail.com/);
  await expect(page.locator("footer").getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.getByRole("navigation", { name: "Privacy policy sections" }).getByRole("link", { name: "Data retention and deletion requests" }).click();
  await expect(page).toHaveURL(/#retention$/);
  await expect(page.getByRole("heading", { name: /Data retention and deletion requests/ })).toBeInViewport();
  const refresh = await page.reload();
  expect(refresh.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `artifacts/privacy-policy-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("policy content and SEO metadata are available without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const response = await page.goto(`${baseURL}/privacy-policy`);
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle("Privacy Policy | Origins of Beauty");
    await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Data retention and deletion requests/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "originsofbeauty9@gmail.com", exact: true })).toBeVisible();
  } finally { await context.close(); }
});
