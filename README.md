# Origins of Beauty — personalshop

Independent, single-owner copy of the Ownshop Origins of Beauty storefront and merchant panel. The reference `ownshop/` checkout is ignored and is never deployed or modified by this project's scripts.

- Frontend: `store/` — React 18, Vite, React Router, TanStack Query, Axios, Tailwind and the original responsive CSS/components.
- Backend: `backend/` — Express, Mongoose/MongoDB, JWT authentication, Azure Blob Storage, WebSocket analytics.
- Store: `/`; merchant admin: `/secure/admin`. No public store directory, platform owner routes, merchant registration, SaaS subscription checkout, or per-store URL prefix.
- Test Firebase project: `personalshop-test`; hosting site: `test-originsofbeauty`.
- Production Firebase project: `personalshop`; hosting site: `originsofbeauty`.

## Local setup

Use Node 22.12+ and Python 3 for backend packaging. Install with `npm ci`, `npm ci --prefix backend`, and `npm ci --prefix store`. Copy `backend/.env.example` to `backend/.env`, fill in your own database, token secrets and Azure container, and copy `store/.env.example` to `store/.env.local`.

Run `npm run dev:backend` and `npm run dev:store` in separate terminals. The frontend runs at http://localhost:3001 and proxies `/api` to port 5000. For the provisioned test database, `node scripts/run-backend.mjs` loads its settings through your authenticated Azure CLI without persisting secrets locally.

## Data and accounts

The test database is `personalshop_originsofbeauty_test`; production is `personalshop_originsofbeauty`. The original store was copied read-only with its relational IDs, historical orders, customers, categories, archived products and analytics. Azure-hosted images were copied into separate `personalshop-test` and `personalshop-production` containers. New uploads use the respective app's managed identity.

Before launch, both databases were refreshed at the owner's request: orders, customers, carts, reviews/questions and historical analytics were removed, and counters reset. Catalog records, images, store configuration and administrator accounts were retained. New visits and real business activity will accumulate normally.

The original has 10 active products. Testing adds 40 clearly named demo products for a total of 50; production retains only the original active catalog. Testing supports `demouser` / `123456` and `origins` / `123456`. Production supports only `origins` / `123456`, without autofill. These are the requested initial credentials; replace the production password securely in the database during manual setup.

`backend/scripts/copy-origin-store.mjs` performed the initial copy from Ownshop and never updates that reference database. The new production app now continuously replicates its committed database changes to testing. Production reads only `personalshop_originsofbeauty`; testing/localhost read and write only `personalshop_originsofbeauty_test`. Test-only records survive synchronization and never appear in production. A production update replaces the matching test record, and a production deletion removes its test copy. Replication retries after outages using persisted checkpoints; it is asynchronous, so testing can briefly lag production. Mirroring is disabled on the test app. Test refresh tokens remain separate from production sessions. See the health endpoint's `replication` field for status. Do not rerun `configure-azure.mjs` on an established installation: it rotates session signing secrets and resets environment settings.

## Verification and releases

The testing WhatsApp shopping assistant, isolated AI settings, Gemini catalog
tools, image flows and human availability verification are documented in
[WhatsApp shopping staging](docs/WHATSAPP_SHOPPING_STAGING.md).

Run `npm test` while the backend is running. For a disposable database, start `node tests/qa-server.mjs` and set `TEST_API_URL=http://127.0.0.1:5001/api/v1`. GitHub validation always uses this disposable backend to test candidate changes before deployment. Run `npx playwright install chromium`, then `npm run test:browser` while both apps are running. `TEST_API_URL` and `TEST_URL` can also select a deployed test environment. Tests exercise isolation, owner login, optional categories and category deletion, product CRUD, idempotent checkout, stock restoration, order privacy, storefront navigation, demo admin login and mobile/desktop rendering. Screenshots and traces are written to ignored artifact folders.

Categories are optional. Deleting a category atomically clears its reference on all its products (including archived products) and removes the category. Products, images, stock and order history are preserved.

`develop` is the testing branch. GitHub Actions validates the React build and browser/API flows. A successful `develop` validation triggers the testing deployment. Azure and Firebase deployments use repository-restricted OIDC identities, without publishing passwords or service-account keys. Production deployment is a separate manual workflow from `main`, selecting `production`; pushing to `main` does not launch production. See [manual setup](docs/MANUAL_SETUP.md).

Firebase serves the React SPA with build-time public HTML for the homepage, products, categories and privacy policy. Product titles, images, canonical URLs and structured data are available before JavaScript executes. No Next.js or paid Firebase rendering service is required. Production builds must set `REQUIRE_CATALOG_SEO=true`, `VITE_API_URL` and `VITE_STOREFRONT_URL`; they fail rather than publish missing product previews when the catalog is unavailable. The hourly `Refresh product share previews` workflow refreshes changed public catalog metadata; GitHub schedules can be delayed. Use its manual dispatch for an immediate refresh. Facebook/WhatsApp may retain previously fetched previews independently.

Hashed assets cache for a year; HTML revalidates; anonymous public catalog responses cache briefly. Authenticated API data and admin HTML remain `no-store`. React Query reuses catalog data for one minute and invalidates relevant queries after edits and checkout. See [performance and AI changes](docs/PERFORMANCE_AND_AI.md).
