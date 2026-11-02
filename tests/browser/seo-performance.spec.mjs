import { test, expect } from '@playwright/test';
test('home and product share previews work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + '/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//);
    const link = page.locator('a[href^="/products/"]').first();
    const href = await link.getAttribute('href');
    await page.goto(baseURL + href);
    const name = await page.locator('h1').innerText();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', new RegExp(name));
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');
    expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@type']).toBe('Product');
  } finally { await context.close(); }
});
test('hover prefetch is reused when opening product details', async ({ page }) => {
  let detailRequests = 0;
  page.on('request', request => { if (/\/api\/v1\/products\/store\/[^/]+\/[^/?]+(?:\?|$)/.test(request.url())) detailRequests++; });
  await page.goto('/products');
  const link = page.locator('.product-card a').first();
  await link.hover();
  await expect.poll(() => detailRequests).toBe(1);
  await link.click();
  await expect(page.locator('.ob-product-detail, .ob-gallery').first()).toBeVisible();
  expect(detailRequests).toBe(1);
});
