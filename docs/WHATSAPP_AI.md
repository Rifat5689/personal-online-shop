# Gemini replies and WhatsApp settings

This phase adds settings and a durable, text-only automatic-reply worker to the existing WhatsApp integration. No RAG, embeddings, file uploads or training features are included.

## Admin controls

Open WhatsApp → three-dot menu → **AI Settings**. The large **About Me / AI Personality & Instructions** field accepts up to 12,000 characters about the administrator, business facts, preferred language and communication style. The saved text is included in the system instruction for every generated reply, together with identity/factuality rules and a bounded recent conversation history.

Paste a Gemini key into the password field, check the connection, select an available Flash model, save the instructions, and use **Test AI Response**. A preview never sends a WhatsApp message. The saved key is encrypted; its value is never returned to the browser or stored in browser storage. An entered key is cleared after a successful save.

AI is off by default globally and for each conversation. Global OFF saves immediately without contacting Gemini. When enabled in production, individual chats must also be explicitly enabled. A manual reply turns AI off for that chat until the admin enables it again. Turning AI off cancels queued or generating replies at the final pre-send check; a request already submitted to Meta cannot be recalled.

The testing inbox is a relay and mirror of production. It can save instructions and keys and run previews. It cannot enable an independent auto-reply worker or change production conversation controls, which would duplicate or conflict with production replies. Once global AI is active in production, use the production inbox for manual takeover and replies; testing cannot cancel production jobs through the one-way mirror. The new AI release must be published to production with approval before real automatic replies can be enabled there. Settings entered only in testing are not mirrored back to production.

## Files changed for this phase

- Backend: `whatsapp.model.js`, `whatsapp.routes.js`, `whatsapp.live.js`, new `whatsapp.ai.routes.js`, `whatsapp.ai.worker.js`, `whatsapp.gemini.js` and `whatsapp.send.js` under `backend/src/modules/whatsapp/`.
- Wiring: `backend/server.js`, `backend/src/app.js`, `backend/src/config/db.js`, `backend/.env.example`, and backend package/lock files for the official SDK.
- Interface: `store/src/features/whatsapp/WhatsAppPage.jsx`, `AISettingsPanel.jsx` and `whatsapp.css`.
- Disclosure: `store/src/pages/store/PrivacyPolicy/policyDocument.js`.
- Verification: `tests/whatsapp-ai.test.mjs`, `tests/browser/whatsapp-ai.spec.mjs`, and the deployed-inbox checks in `scripts/verify-shared-whatsapp.mjs`.

## Backend variables

- Existing Meta variables remain unchanged.
- `WHATSAPP_AI_ENCRYPTION_KEY`: random 32-byte value encoded as base64. Required before saving a Gemini key through the UI. Store only in backend Azure settings and preserve it across deployments. Losing or changing it prevents reading keys already encrypted with it. When deploying the AI code to production, use the same encryption key if encrypted settings are to be mirrored between environments.
- `GEMINI_API_KEY`: optional backend-only fallback when no encrypted UI key exists. The UI key takes precedence. No key is included in source or frontend build variables.

The official `@google/genai` SDK is loaded on demand. Available text Flash models are checked using the key's models list; the current default is `gemini-3.8-flash`. Model availability can differ by project, region or API access. Connection failures return a generic safe error without provider credentials or chat contents.

## API endpoints

All paths below are under `/api/v1/whatsapp` and require the existing ADMIN/ECO authentication and assigned-store authorization.

| Endpoint | Purpose |
| --- | --- |
| `GET /ai/settings` | Non-secret settings for this authenticated admin; key-configured flag only |
| `PUT /ai/settings` | Save instructions, model, tone and optionally an encrypted key |
| `PATCH /ai/enabled` | Immediately turn global AI on/off; OFF does not depend on Gemini |
| `POST /ai/models` | Validate a supplied or saved key and list supported Flash models |
| `POST /ai/preview` | Preview using saved instructions and optional conversation context; never sends to WhatsApp |
| `PATCH /conversations/:id/ai` | Turn AI on/off for this conversation |

Settings schema: `store`, `enabled`, `instructions`, `model`, `tone`, `encryptedKey` (excluded from normal queries), `connectionState`, `connectedAt`, `revision`, timestamps. Conversations add `aiEnabled`, `aiRevision` and a worker lease. Messages record `source` (`customer`, `admin`, `ai`), `aiReplyTo` and first-receipt eligibility/revisions. Persistent AI jobs record the incoming message, status, settings/chat revisions, lease, schedule and safe error.

## Message processing

The signed webhook saves the incoming message and enqueues a unique job only if it was eligible when first received. Gemini is called by a background worker after the webhook can acknowledge promptly. Duplicate webhook events cannot enqueue multiple jobs or make an originally ineligible message eligible later.

Workers claim jobs and conversation leases in MongoDB, use up to 12 recent text messages, apply a 20-second Gemini timeout and bounded output, and recheck both switches, revisions, the latest inbound message and the 24-hour WhatsApp service window before sending. Global generation is capped at 20 AI send attempts per minute per store. Model failures never produce a fabricated fallback reply. The send boundary and unique reply ID are persisted, and uncertain deliveries are flagged for human review rather than retried automatically.

WebSocket invalidations include settings and job updates. Staff can distinguish AI-generated replies and inspect safe job errors in the inbox. Customer text and API credentials are not logged by this feature.

## Validation and publication

`node --test tests/whatsapp-ai.test.mjs tests/whatsapp-api.test.mjs tests/whatsapp-live.test.mjs tests/whatsapp-security.test.mjs tests/database-mirror.test.mjs`

`npx playwright test tests/browser/whatsapp-ai.spec.mjs tests/browser/whatsapp.spec.mjs tests/browser/privacy-policy.spec.mjs`

Tests use disposable databases and mocked Google/Meta responses. No real automatic WhatsApp reply has been sent. Before enabling AI for customers, connect a real Gemini key, preview replies, then perform the requested test with an approved WhatsApp test recipient. Keep global AI off until the administrator explicitly enables it.

The updated Privacy Policy discloses optional Gemini processing. Publish that updated policy together with the AI feature when production publication is approved. GitHub Actions remain unchanged; hosting uses the existing CLIs.
