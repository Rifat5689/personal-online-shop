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

### Provider selection and token use

Staging AI settings support Groq and Gemini through a shared content/tool adapter.
The business instructions live in `whatsapp.instructions.js`; catalog validation,
conversation history, human verification and the WhatsApp send boundary are shared.
Groq uses separate text and vision selections. Current defaults are
`openai/gpt-oss-20b` and `qwen/qwen3.8-27b`; model access is checked against the live
provider list. Vision selection is limited to models with documented image input
and tool support. Available models can change.

Groq keys use the existing backend AES-256-GCM encryption key and a separate
`select: false` database field. Settings responses contain only configured flags,
model names, connection metadata and safe rate-limit headers. Saved keys never
return to the client. Test Connection verifies actual generation as well as model
access; unknown quota values are labelled unknown rather than estimated. Gemini
does not expose account quotas through its model-list API.

Choose a primary provider and an optional different fallback. Rate limits,
timeouts and temporary server failures can switch providers during generation.
Authentication, invalid input and product-validation failures do not trigger an
automatic retry. A short Groq `retry-after` can be honoured once within the request
deadline. Generation uses bounded timeouts; fallback never repeats a WhatsApp send.
No automatic rotation between Gemini models is implemented.

The common instructions are 42% shorter by character count than the previous
template. Simple, unambiguous price questions use a fresh tenant-scoped product
lookup with no model call. Model tool responses omit storage/image URL repetition,
use short search descriptions, and retain fuller descriptions for explicit product
details. Recent conversation text has a 12,000-character budget across up to forty
entries; persisted recommendation IDs are still revalidated separately. Recognized
short product requests can be prefetched from the catalog to reduce model search
rounds. Groq uses low/no reasoning and at most 1,024 output tokens per round.

`scripts/check-groq-staging.mjs` accepts Azure test settings JSON on stdin and
`GROQ_API_KEY` in the process environment. It checks real Groq replies without
fallback so that Gemini cannot mask a failing Groq test. `--image` also tests
vision; `--configure` saves only the isolated staging settings after all requested
cases succeed. It does not send WhatsApp messages or modify production settings.
The process reports safe error codes/limits and persists completed cases under
ignored `artifacts/`. Do not put a real key in source, command output or reports.

Provider references: [Groq vision](https://console.groq.com/docs/vision),
[Groq limits](https://console.groq.com/docs/rate-limits),
[Qwen reasoning controls](https://console.groq.com/docs/model/qwen/qwen3.8-27b).

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
2,048 output tokens per round, six products, forty history entries, and a
55-second provider deadline. Database operations have a 2.5-second limit.
After three searches, further search functions are disabled and Gemini must
finish from verified results or report a concise no-match response. Search
exhaustion does not fail the whole customer reply. Product-type category terms
also fall back to strict keyword matching when no matching category label exists;
for example Banglish `kan er jinish` maps to earrings, not unrelated jewellery.
Known safe worker errors are preserved for the admin, including explicit Gemini
quota/rate-limit messages. Unknown internal errors remain generic to protect secrets.
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
Up to three candidate photos are fetched anonymously from the configured Azure
account or Cloudinary, validated, and supplied to Gemini for visual comparison.
Unavailable candidate photos leave text-supported possible matches. This phase
does not provide a dedicated visual similarity index or embeddings.

Price-only responses are generated from verified prices. Requested product images
use Meta image messages with product name, verified price, short description and
real public URL in a caption (up to 1,024 characters). Missing catalog images fall
back to a truthful text card. A definitive image-link rejection can fall back to
a validated storage download, Meta media upload and one media-ID send. An uncertain
send is never retried; other failures stop the batch. Numbering is persisted
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

### Ten-second customer message wait

Live staging replies wait for ten seconds after the most recent new customer
message. New messages reset pending deadlines; duplicate webhook retries do not.
An image and following text are combined into one bounded request and one reply.
If new input arrives during generation, the unsent draft is discarded and its
image/context is carried to the next queued request, which observes the renewed
deadline. This uses persistent `notBefore` values, not an in-memory timer, so a
restart preserves waiting messages. Turning AI off still takes priority. A message
already submitted to Meta cannot be recalled.

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
   Testing explicitly restarts after its package update so the Node process loads
   the new release marker. No production restart step was added.
8. Confirm `/api/v1/health`, public catalog, authenticated shopping preview,
   owner verification and mobile/desktop admin. Live Meta checks must use only
   the approved recipient after that person messages the business number.

The existing opt-in Azure storage live test and reference-design comparison need
their documented external configuration. Report skipped checks separately from
passed ones. Real customer availability/order/payment confirmations are never a
valid test technique.


## Manual admin media and extended history

The inbox uses a WhatsApp-style rail, chat list, paper background, green outgoing
bubbles and a photo/video attachment menu. Admins can select JPEG/PNG up to 5 MB
or H.264 MP4 up to 16 MB, preview it, add an optional 1,024-character caption and
send when effective chat AI is off. Videos need AAC audio if audio is present.
The server validates the tenant, customer-initiated reply window, test allowlist,
AI state, file type/size and request ID. A database reservation precedes upload;
identical retries return the same record and never re-upload/re-send. Reusing an
ID with a different file/caption is rejected. AI is checked again after upload.
Unknown deliveries require review, not automatic resend. Stale upload/send states
become unknown when the inbox refreshes. Photos/videos are uploaded to Meta; no
public customer-media storage or new credentials are required. Video previews use
an authenticated endpoint and load on demand, with private/no-store responses.

Conversation context now considers up to forty recent messages and 12,000
characters, newest first, with at most 1,000 characters per message. Older message
records remain in the database. Explicit WhatsApp reply-to product references
remain tenant/conversation scoped and are revalidated. Session history keeps forty
entries; monotonic history versions preserve send idempotency after the history
reaches its cap. A full-history continuation regression test covers this case.

Groq image processing first extracts visible characteristics using the selected
vision model without the long business prompt. Subsequent catalog/tool rounds use
the selected text model and those untrusted observations, avoiding repeated image
tokens. Gemini continues to use its established multimodal flow. Photo matches
remain possible only. Current Groq limits can still constrain large histories;
falling back to Gemini does not guarantee capacity if both accounts are limited.

## Individual chat deletion shared with production

Chat menu → Delete chat first checks whether the selected phone has a matching
production conversation. A staging-only chat can be deleted locally after
confirmation. A shared chat requires a separate production ADMIN username/password
check against the actual production account; the demo staging login alone cannot
authorize deletion. Credentials are transient input and never returned or stored.
The dialog explicitly identifies production and staging impact and explains that
delivered messages remain on the customer's phone.

For the explicitly supported `personalshop_originsofbeauty_test` database, the
existing connection accesses `personalshop_originsofbeauty` only for this owner-
authorized operation. Both deletions run in one MongoDB transaction. Conversation
history, receipts, AI jobs, shopping sessions/jobs and verification requests are
removed for the selected tenant/chat only. Other chats, catalog records, orders,
AI configuration and credentials are untouched. Failure rolls back both databases;
there is no best-effort partial-delete fallback. Existing production change streams
and mirroring observe the deletion. New incoming customer messages can start a new
conversation. Production credentials/settings do not need to be changed or copied.

Disposable replica-set tests verify wrong-password rejection, cleanup, unaffected
other chats and rollback after a simulated local failure. Deployment verification
checks production scope and transaction access read-only; it does not delete real
customer histories as a test.
