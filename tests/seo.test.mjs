import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../store/scripts/seo.mjs';
import { publicCatalogCache } from '../backend/src/middlewares/public-cache.middleware.js';
test('crawler HTML escapes catalog content and includes metadata before JavaScript', () => {
  const html = renderPage('<head><title>Old</title><meta name="description" content="old"/></head><div id="root"></div>', { title: 'A "product" <script>', description: 'Beauty & care', image: 'https://example.test/image.jpg', url: 'https://example.test/products/test' }, '<h1>Product</h1>', { name: '</script><script>alert(1)</script>' });
  assert.match(html, /property="og:title" content="A &quot;product&quot; &lt;script&gt;"/);
  assert.match(html, /og:image/); assert.match(html, /rel="canonical"/);
  assert.match(html, /<div id="root"><h1>Product<\/h1><\/div>/);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal(html.includes('</script><script>alert'), false);
});
test('public caching excludes credentials and error responses', () => {
  for (const [headers, status, expected] of [[{}, 200, true], [{ authorization: 'Bearer secret' }, 200, false], [{ cookie: 'session=secret' }, 200, false], [{}, 404, false]]) {
    let cached = false;
    const res = { statusCode: status, vary() {}, set() { cached = true; }, json() {} };
    publicCatalogCache({ method: 'GET', get: name => headers[name] }, res, () => {});
    res.json({ data: 'catalog' }); assert.equal(cached, expected);
  }
});
