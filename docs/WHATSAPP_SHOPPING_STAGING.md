# WhatsApp shopping assistant — testing only

The existing testing Azure app is `test-originsofbeauty`, API origin
`https://test-originsofbeauty.azurewebsites.net`. The testing frontend is
`https://test-originsofbeauty.web.app` (Firebase project `personalshop-test`).
Only `develop` is used for this release. Never dispatch deployment with
`target=production` or merge this release into `main` as part of testing.

## Isolation and settings

Shopping features require `DATABASE_ROLE=test` and reject the production app
name. They use the existing test database, which currently contains a one-way
mirror of the catalog. Catalog tools only read that database. No product,
category, order, payment or stock mutation tools exist.

The original `WhatsAppAISettings` collection remains the mirrored production
configuration. Testing settings use `WhatsAppStagingAISettings`, with the same
encrypted-key schema and existing personality/settings UI. The initialization
script copies the mirrored settings to that local collection with AI off; it
does not modify the source. Re-running initialization preserves local settings.
Sessions, jobs and availability requests also use distinct collections, excluded
from future mirror enumeration. New indexes support job/webhook deduplication
and one pending verification per session/product. No catalog migrations occur.

Keep `WHATSAPP_WEBHOOK_RELAY_URL` unchanged: signed events continue to be
forwarded to the existing production receiver. After a successful forward,
testing queues only explicitly allowlisted recipient messages with an enabled
local session and local global AI. It never opts in other customers. If mirrored
production AI owns that chat, staging refuses to send. Production takeover
settings are read-only; staging takeover has separate session revisions.

## Gemini and retrieval

`whatsapp.catalog.js` is the read-only retrieval adapter and the future semantic
search extension point. Tools are `searchProducts`, `getProductDetails`,
`searchProductsByCategory`, `getBusinessInformation`, `getProductImages`, and
`getProductUrl`. Gemini finishes through the validated `respond` function.
Inputs are validated server-side, regex strings are escaped, all catalog queries
include tenant, active and soft-delete filters, and results are capped at six.
Categories are separately tenant-filtered. Stock is never returned as proof of
availability. Product variants are empty because the current product model has
no variants field. Payment policy is reported as unconfigured because the store
model does not contain a verified payment policy.

Search supports name, descriptions, structured description content, categories,
Bangla/Banglish/English synonym groups, strict attribute matching and relevance
ranking. Gemini can retry with relevant alternatives, at most three searches.
The limit is five provider rounds, twelve tool calls, eighteen catalog operations,
2,048 output tokens per round, six products, twelve history entries, and a
55-second provider deadline. Database operations have a 2.5-second limit.
Budget filters apply to the discounted price; server-side budget parsing also
constrains recognized Bangla/Banglish/English requests. Prices match the active
storefront calculation, rounded to two decimal places. Product URLs use the
actual `/products/:slug` public route. No embeddings or vector resources exist.

Product IDs and same-store product URLs take priority. Previous outbound
recommendation IDs are revalidated against the database, and a numbered map is
provided for follow-ups. Reply-to Meta IDs resolve to stored outbound product
IDs within the same tenant and conversation. History is bounded and product
records remain the source of current prices. Customer content and tool results
are data, never privileged instructions.

## Images and message formats

Admin test sessions accept multipart `image` plus `prompt`. Signed WhatsApp image
events use Meta's media metadata and binary endpoints. Downloads require HTTPS,
Meta-owned hostnames, no redirects, a ten-second timeout, a five-MB cap and
JPEG/PNG/WebP magic-byte validation. Credentials and image binaries are not
logged. Gemini receives inline image bytes, extracts visible characteristics and
uses catalog search; all visual matches are labelled possible, never exact.
This phase does not provide a dedicated visual similarity index or embedding
comparison of candidate photos. Catalog text must support a suggested match.

Price-only responses are generated from verified prices. Requested product images
use Meta image messages with product name, verified price, short description and
real public URL in a caption (up to 1,024 characters). Missing catalog images fall
back to a truthful text card. Meta rejection/uncertain delivery stops the batch;
the system does not retry uncertain sends. Recommendation numbering is persisted
on outgoing messages. Up to six product messages are sent only when the customer
requests multiple recommendations; ordinary answers remain one concise message.

Meta free-form messages require a customer-initiated 24-hour window. Public
images must remain accessible to Meta, and old incoming media may expire.
Expired/invalid images show a safe unavailable state. Image-message previews use
an authenticated tenant-scoped endpoint; private media are never public URLs.

## Availability and owner controls

Availability, reservations, orders, payment receipt and delivery guarantees require
human review. The response briefly states that verification is pending and creates
a deduplicated request associated with store, session, customer, conversation and
product where known. The inbox shows a pending-count notification; AI Settings
contains Available, Unavailable, Reply Manually and Resolve controls. Recording
a decision does not send a message, reserve stock, accept an order or confirm a
payment. Unrelated questions can continue during a pending request.

Manual inbox replies stop local sessions for that recipient. Global OFF and
session OFF increment revisions; workers recheck before sending. A Meta request
already submitted cannot be recalled. Durable job states expose failures and
unknown deliveries without automatic resend after a process crash.

## Required configuration

Reuse existing `MONGODB_URI`, token secrets, `STORE_SLUG`,
`META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`,
`META_APP_SECRET`, `META_GRAPH_API_VERSION`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_AI_ENCRYPTION_KEY`, and encrypted Gemini settings or `GEMINI_API_KEY`.
Keep `DATABASE_ROLE=test`, `DB_MIRROR_ENABLED=false`, and the existing relay URL.
`WHATSAPP_TEST_RECIPIENTS` is a comma-separated explicit allowlist of personal
recipient numbers in digits-only international format. Do not include the business
API number, customer lists or supplier lists. `PUBLIC_STOREFRONT_URL` can specify
the public store origin; testing defaults to the existing testing storefront.

## Testing and deployment

1. Run the disposable QA backend: `node tests/qa-server.mjs`.
2. Set `TEST_API_URL=http://127.0.0.1:5001/api/v1`; run `npm test`.
3. Build with `VITE_API_URL=http://127.0.0.1:5001/api/v1`,
   `VITE_STOREFRONT_URL=https://test-originsofbeauty.web.app`, `VITE_DEMO_MODE=true`.
4. Run `node tests/serve.mjs` then `npx playwright test`.
5. There is no existing repository lint script/configuration. Run syntax checks
   and `git diff --check`; do not imply an absent lint suite passed.
6. `scripts/staging-shopping-check.mjs` accepts staging Azure settings JSON on
   stdin without printing secrets. `--initialize` creates isolated AI settings;
   `--live-ai --image` checks real Gemini against existing staging products and
   writes a local report under ignored `artifacts/`. It sends no WhatsApp messages.
7. Commit on `develop`; the existing validation workflow gates automatic testing
   deployment. Check `Deploy isolated shop` uses the `testing` environment and
   the exact validated release SHA. Production deployment is excluded.
8. Confirm `/api/v1/health`, public catalog, authenticated shopping preview,
   owner verification and mobile/desktop admin. Live Meta checks must use only
   the approved recipient after that person messages the business number.

The existing opt-in Azure storage live test and reference-design comparison need
their documented external configuration. Report skipped checks separately from
passed ones. Real customer availability/order/payment confirmations are never a
valid test technique.
