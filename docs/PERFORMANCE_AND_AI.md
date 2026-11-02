# Gemini, sharing and loading improvements

## Measured findings

Production AI jobs showed timeouts and temporary provider failures. A direct test with the saved key reproduced the `gemini-3.8-flash` timeout in about 28.5 seconds. Model listing worked even though generation did not. `gemini-3.1-flash-lite` repeatedly generated Bangla replies in roughly 1.1-2.4 seconds. The verified model was saved without changing global/per-chat enable switches. Model availability and response timing depend on Google's service and account.

The main JavaScript bundle changed from 558.80 KB to about 224.41 KB before compression. This is the main chunk, not the total of all downloaded chunks. Three banners changed from 868,522 bytes of PNG to 58,984 bytes of WebP. These are measured asset reductions, not a claim that every page is a fixed percentage faster.

## Gemini implementation

- New configurations default to the live-tested Flash-Lite model. Existing saved model choices are respected.
- Lightweight supported models use minimal thinking. Other model families use compatible thinking settings.
- Start with 4,096 output tokens; retry once with 8,192 only if thinking exhausts that budget. Never send a truncated reply.
- Retry temporary 500/502/503 generation failures once. Do not retry quota or permission errors. Overall generation has a 55-second deadline.
- Exclude thought parts from visible text. Keep blocked/blank/oversized responses as errors rather than inventing an answer.
- Saving a new key/model verifies generation before marking the connection connected. Listing models proves only access to models.
- Preview waits up to 65 seconds; settings save allows 80 seconds for listing plus generation. The default API timeout remains short for normal requests.
- Durable job deduplication, conversation switches, last-message checks and uncertain-send protection remain intact. Retrying Gemini generation never retries a WhatsApp send.

`scripts/probe-gemini.mjs` reads Azure settings from stdin, keeps secrets in memory and tests harmless prompts without sending WhatsApp messages. `--activate` saves a verified model; `--endpoint=...` tests the deployed authenticated preview route. No customer history is printed.

## Social previews and SEO

React effects execute too late for crawlers that only read HTML. `store/scripts/render-storefront.mjs` fetches public catalog data at build time and writes product/category HTML, Open Graph tags, Twitter cards, canonical links, Product/Offer structured data, robots.txt and sitemap.xml. Product names/images appear in the first response, and React takes over for interactive browsing.

Firebase clean URLs serve these HTML files before the SPA fallback. HTML revalidates on every reuse. The homepage uses the store's public profile image, with a generated store-brand fallback. Sensitive shopping/account routes are noindex. Admin responses retain no-store and noindex headers.

The production hourly refresh workflow builds from main, compares a stable public-catalog fingerprint and publishes hosting only when changed. It uses OIDC rather than saved deployment keys. It does not redeploy the backend. Catalog changes reach the interactive app through its API immediately subject to short caches, while static preview snapshots update on deployment/refresh. GitHub schedules and social platform cache refreshes are not immediate guarantees. Run the refresh workflow manually after important launches.

## Caching and preload rules

| Content | Policy | Purpose |
| --- | --- | --- |
| Hashed `/assets/*` JS/CSS | 1 year, immutable | New content gets a new filename |
| Public HTML | max-age=0, must-revalidate | Pick up releases and fresh metadata |
| Static `/images/*` | 1 day; stale while revalidate up to 7 days | Reuse branding and local imagery |
| Anonymous public catalog GET | 15 seconds; stale while revalidate 30 seconds | Small safe freshness window |
| API requests with auth/cookies; errors/mutations | no-store, private | Prevent personal data sharing |
| React Query public catalog/product | staleTime 60 seconds | Reuse fresh data during navigation |
| In-memory inactive queries | gcTime 30 minutes | Smooth return visits in the same session |

Public cache middleware varies on Authorization and Cookie; only specific successful public catalog GET endpoints can opt in. Checkout still verifies price and stock server-side. No persistent browser cache of administrator/customer API data was added.

Store configuration and catalog requests begin together. Product hover/focus prefetches the detail query and route code; React Query deduplicates the later click. Save-data/2G users skip speculative fetching. Product edits/category edits/checkout invalidate affected queries. Product GET no longer increments views; real product-view analytics events do, so prefetches do not inflate counts.

## Images and route loading

Admin pages and secondary storefront routes load on demand using React lazy/Suspense. The storefront shell remains visible while a secondary page loads. First-banner and main-product images receive high fetch priority and preload hints; offscreen content uses lazy loading. Product images reserve dimensions and use asynchronous decoding. WebP copies replace referenced heavy local PNG imagery; old image URLs remain valid.

## Validation and deployment

API/unit checks include Gemini thinking-budget exhaustion, safe retries, blocked text, quota, encryption, worker controls, signed webhook handling, deduplication, order stock/idempotency and cache isolation. Browser checks cover desktop/mobile shopping, cart/checkout, private admin settings, live inbox, no-JavaScript product previews and prefetch reuse. Tests use a disposable MongoDB replica set, not production orders.

Local test commands:

```powershell
node tests/qa-server.mjs
# In another shell:
$env:TEST_API_URL='http://127.0.0.1:5001/api/v1'
npm test
$env:VITE_API_URL='http://127.0.0.1:5001/api/v1'
$env:VITE_STOREFRONT_URL='https://test-originsofbeauty.web.app'
$env:VITE_DEMO_MODE='true'
$env:REQUIRE_CATALOG_SEO='true'
npm run build
node tests/serve.mjs
# In another shell:
npx playwright test
```

CLI deployment first publishes the testing candidate. GitHub Actions validates candidate code before testing deployment; production deployment is explicitly dispatched from main. Dependency download caches include backend/store locks, and deployment installs production backend dependencies only. Release health must match the packaged commit before frontend publication. Never overlap CLI and Actions deployment on the same Azure app: the previous failed release encountered a Kudu deployment-lock conflict.

Production deployment exposed a missing Oryx extraction manifest: code was updated but a fresh runtime could not load its runtime-local dependencies. Packaging now includes one `node_modules.tar.gz` plus `oryx-manifest.toml` with `CompressedNodeModulesFile`, instead of thousands of individual files. Oryx extracts dependencies into local container storage at startup. The real package was inspected for the manifest, expected modules, and absence of environment files; it contained 72 outer entries instead of over 16,000. Existing startup metadata was repaired to restore production while the permanent packaging change was prepared.

## Maintenance

Use versioned filenames when replacing long-cached assets. After catalog changes, manually dispatch the preview refresh if an hourly update is too slow. Verify a product's HTML using View Source, then request a re-scrape through the social platform's sharing debugger if an old preview persists. Avoid storing secrets in URLs, logs, git or the learning PDF. Keep third-party provider errors visible and check actual generation instead of trusting a green model-list connection badge.

References: [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking), [Firebase hosting configuration](https://firebase.google.com/docs/hosting/full-config), [TanStack Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
