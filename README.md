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

The original has 10 active products. Testing adds 40 clearly named demo products for a total of 50; production retains only the original active catalog. Testing supports `demouser` / `123456` and `origins` / `123456`. Production supports only `origins` / `123456`, without autofill. These are the requested initial credentials; replace the production password securely in the database during manual setup.

`backend/scripts/copy-origin-store.mjs` only accepts the two designated target apps, rejects an existing destination database, and never updates the source. It is a one-time copy, not ongoing synchronization. Do not rerun `configure-azure.mjs` on an established installation: it rotates session signing secrets.

## Verification and releases

Run `npm test` while the backend is running. Run `npx playwright install chromium`, then `npm run test:browser` while both apps are running. `TEST_API_URL` and `TEST_URL` select a deployed test environment. Tests exercise isolation, owner login, product CRUD, idempotent checkout, stock restoration, order privacy, storefront navigation, demo admin login and mobile/desktop rendering. Screenshots and traces are written to ignored artifact folders.

`develop` is the testing branch. GitHub Actions validates the React build and browser/API flows. A successful `develop` validation triggers the testing deployment. Production deployment is a separate manual workflow from `main`, selecting `production`; pushing to `main` does not launch production. See [manual setup](docs/MANUAL_SETUP.md).

Firebase serves the React SPA with client-side page metadata. Next.js and server rendering were removed at the owner's request. Firebase billing remains disabled. Existing Azure App Service plan/storage usage remains subject to the existing Azure account.
