// Static HTML is served by Firebase before its SPA rewrite, including to social crawlers.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { escapeHtml as e, plainText, renderPage } from './seo.mjs';
const dist = new URL('../dist/', import.meta.url);
const origin = process.env.VITE_STOREFRONT_URL || 'https://originsofbeauty.web.app';
const api = process.env.VITE_API_URL;
const required = process.env.REQUIRE_CATALOG_SEO === 'true';
const slug = 'originsofbeauty';
let store = { name: 'Origins of Beauty', description: 'Shop authentic beauty, skincare, makeup and accessories at Origins of Beauty.' }, products = [], categories = [];
if (api) {
  try {
    const get = async path => {
      const response = await fetch(`${api.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw Error(`Catalog request failed (${response.status})`);
      return (await response.json()).data;
    };
    [store, products, categories] = await Promise.all([get(`/stores/slug/${slug}`), get(`/products/store/${slug}`), get(`/categories/store/${slug}`)]);
    if (!store?.name || !Array.isArray(products) || !Array.isArray(categories)) throw Error('Invalid catalog response');
  } catch (error) {
    if (required) throw error;
    console.warn(`SEO catalog unavailable: ${error.message}. Local build uses branding only.`);
  }
} else if (required) throw Error('VITE_API_URL is required for deployed product previews');
const template = await readFile(new URL('index.html', dist), 'utf8');
const imageUrl = value => { try { const url = new URL(value || '/images/store-share.png', origin); return /^https?:$/.test(url.protocol) ? url.href : new URL('/images/store-share.png', origin).href; } catch { return new URL('/images/store-share.png', origin).href; } };
const brandImage = imageUrl(store.profileImage?.url);
const paths = [];
async function page(path, data, body, schema) {
  const file = new URL(path === '/' ? 'index.html' : `${path.slice(1)}.html`, dist);
  await mkdir(new URL('./', file), { recursive: true });
  let html = renderPage(template, { image: brandImage, ...data, url: new URL(path, origin).href }, body, schema);
  if (api) html = html.replace('</head>', `<link rel="preconnect" href="${e(new URL(api).origin)}" crossorigin/></head>`);
  if (path === '/') html = html.replace('</head>', '<link rel="preload" as="image" href="/images/banners/banner1.webp" fetchpriority="high"/></head>');
  if (data.type === 'product') html = html.replace('</head>', `<link rel="preload" as="image" href="${e(data.image)}" fetchpriority="high"/></head>`);
  await writeFile(file, html);
  paths.push(path);
}
const cards = items => items.map(product => `<article><a href="/products/${e(encodeURIComponent(product.slug))}">${product.images?.[0]?.url ? `<img src="${e(imageUrl(product.images[0].url))}" alt="${e(product.name)}" width="200" height="200" loading="lazy"/>` : ''}<h2>${e(product.name)}</h2></a></article>`).join('');
const description = plainText(store.description) || 'Shop authentic beauty, skincare, makeup and accessories.';
await page('/', { title: store.name, description }, `<main><h1>${e(store.name)}</h1><p>${e(description)}</p><a href="/products">Shop all products</a>${cards(products.slice(0, 8))}</main>`, { '@context': 'https://schema.org', '@type': 'Store', name: store.name, url: origin, image: brandImage });
await page('/products', { title: `All Products | ${store.name}`, description }, `<main><h1>All Products</h1>${cards(products)}</main>`);
for (const category of categories) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(category.slug)) continue;
  await page(`/categories/${category.slug}`, { title: `${category.name} | ${store.name}`, description }, `<main><h1>${e(category.name)}</h1>${cards(products.filter(product => product.category?.slug === category.slug))}</main>`);
}
for (const product of products) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(product.slug)) throw Error('Unsafe product slug');
  const path = `/products/${product.slug}`, image = imageUrl(product.images?.[0]?.url);
  const text = plainText(product.shortDescription || product.description).slice(0, 240) || `Discover ${product.name} at ${store.name}.`;
  const price = Math.round(Number(product.price) * (1 - Number(product.discount || 0) / 100) * 100) / 100;
  await page(path, { title: `${product.name} | ${store.name}`, description: text, image, type: 'product' }, `<main><a href="/">${e(store.name)}</a><h1>${e(product.name)}</h1><img src="${e(image)}" alt="${e(product.name)}" width="600" height="600" fetchpriority="high"/><p>${e(text)}</p></main>`, {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: text, image: [image], sku: String(product._id),
    offers: { '@type': 'Offer', priceCurrency: 'BDT', price, availability: `https://schema.org/${product.stock > 0 ? 'InStock' : 'OutOfStock'}`, url: new URL(path, origin).href },
  });
}
for (const path of ['/cart', '/checkout', '/orders', '/account', '/login', '/signin', '/signup', '/register', '/order-success']) await page(path, { title: store.name, description, noindex: true }, '');
const sitemapPaths = paths.filter(path => path === '/' || path === '/products' || path.startsWith('/products/') || path.startsWith('/categories/')).concat('/privacy-policy');
await writeFile(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPaths.map(path => `<url><loc>${e(new URL(path, origin).href)}</loc></url>`).join('')}</urlset>`);
await writeFile(new URL('robots.txt', dist), `User-agent: *\nAllow: /\nDisallow: /secure/\nDisallow: /checkout\nDisallow: /cart\nDisallow: /account\nDisallow: /orders\nSitemap: ${origin}/sitemap.xml\n`);
// Only public, stable metadata enters this fingerprint, never counters or secrets.
const fingerprint = createHash('sha256').update(JSON.stringify({ store, products, categories })).digest('hex');
await writeFile(new URL('catalog-version.json', dist), JSON.stringify({ fingerprint, productCount: products.length }));
console.log(`Rendered ${products.length} product previews, ${categories.length} categories, sitemap and store branding.`);
