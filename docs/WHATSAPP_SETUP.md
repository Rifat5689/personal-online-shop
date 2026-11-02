# Shared WhatsApp inbox

Admin: https://test-originsofbeauty.web.app/secure/admin/whatsapp

Production admin: https://originsofbeauty.web.app/secure/admin/whatsapp

Privacy Policy: https://originsofbeauty.web.app/privacy-policy

Webhook callback: https://test-originsofbeauty.azurewebsites.net/api/v1/whatsapp/webhook

The original callback URL and verify token remain valid for both environments. The testing endpoint validates Meta's original signature and forwards the unchanged signed body to the production receiver. It acknowledges only after production accepts the event. Production saves the record once; the existing one-way database mirror supplies testing with production conversations, messages and delivery receipts. Do not register two callbacks or send the same event independently to both databases.

Use the production admin for live replies. A reply sent from the testing admin still uses the same real WhatsApp phone, but a testing-only write is not replicated back to production.

## Meta configuration

1. Open the same Meta app that owns the configured phone number. Under WhatsApp → Configuration, edit the webhook callback. Paste the HTTPS URL above and the separate verify token supplied at handoff. The verify token is stored in Azure `WHATSAPP_VERIFY_TOKEN`; it is not the app secret or access token.
2. Subscribe the `whatsapp_business_account` object to the `messages` field. That field delivers both incoming messages and outbound delivery/read/error events. Do not create a separate `message_status` subscription.
3. Ensure this Meta app is subscribed to the WhatsApp Business Account (WABA). If needed, use Meta's API Explorer to POST `/{WABA_ID}/subscribed_apps` with a suitably authorized token. The WABA ID differs from the phone number ID.
4. Ensure the token has `whatsapp_business_messaging` permission and access to this business phone. WABA administration/subscription requires `whatsapp_business_management` and the appropriate business asset assignment. Temporary API Setup tokens expire; replace with an appropriate system-user token in Azure before it expires.
5. For a Meta test phone number, add and verify the recipient in WhatsApp → API Setup. Account review, phone registration, payment setup, app mode and business verification requirements depend on the Meta account's state.

## Test messages

1. Send a text from the verified recipient's WhatsApp to the business/test number shown in Meta API Setup.
2. Sign in to the production admin and open WhatsApp. A live WebSocket notification refreshes the inbox when a message is saved. The testing inbox receives a copy after database replication and its own live notification. Select it to view messages. If live connectivity is unavailable, polling refreshes the inbox every few seconds.
3. Type a reply and press Send. Confirm it arrives in the recipient's WhatsApp, then open it to check delivery/read status (read receipts depend on the recipient's settings).
4. Reply from WhatsApp and confirm the admin inbox updates. Incoming media is recorded as a type placeholder; this version sends text only.
5. Free-form replies are blocked on the backend and UI after 24 hours from the latest customer message. Have the customer send a new message to reopen the window. Templates are not implemented.

## Backend settings

Both Azure apps are configured with the same Meta phone, access token, app secret and existing verify token. Only `test-originsofbeauty` has `WHATSAPP_WEBHOOK_RELAY_URL=https://originsofbeauty-aegyapebd0gxadfh.centralindia-01.azurewebsites.net/api/v1/whatsapp/webhook`. Production must leave that variable unset. All Meta/WhatsApp variables are backend-only. Never put them in React `VITE_` variables.

Live chat uses the existing `ws` dependency, with one authenticated WebSocket per open inbox. `POST /api/v1/whatsapp/live-ticket` requires the existing admin authentication, role and store assignment. A short-lived ticket is sent in the first WebSocket frame to `/api/v1/whatsapp/live`; no credential appears in the URL. Origins and admin/store access are checked on the backend, with periodic permission rechecks and reconnects. MongoDB change streams notify the inbox about new messages, delivery updates and records arriving through the mirror. Notifications contain no message text; the browser reads message data through authenticated HTTP APIs. A 60-second reconciliation handles missed updates and the reply window, while 3–4 second polling provides fallback if the live connection drops.

To update a token through CLI without printing it, run `node scripts/configure-whatsapp-testing.mjs` in an authorized terminal and provide one JSON object on hidden stdin containing the setting(s) to update. This helper merges only allowlisted WhatsApp app settings into the testing app. Obtain secrets securely; do not embed them in tracked files or shell history.

MongoDB collections: `whatsappconversations`, `whatsappmessages`, `whatsappreceipts`. Unique indexes prevent duplicate incoming message IDs and outbound request IDs. Early/out-of-order receipts are retained and successful delivery status cannot regress. Uncertain send outcomes are shown as `unknown`; the backend never automatically retries a send that may have reached Meta.

Local verification: `node --test tests/whatsapp-security.test.mjs tests/whatsapp-api.test.mjs tests/whatsapp-live.test.mjs tests/database-mirror.test.mjs`. Tests use disposable MongoDB replica sets and mocked Meta sends, covering signatures, the signed relay, duplicate delivery, tenant/auth isolation, early receipts, idempotent sends, expired windows, admin WebSocket authentication, live database updates and one-way replication. Browser checks use fixture conversations and never send real messages.

Production deployment was explicitly authorized. GitHub Actions remain unchanged; deployment uses Azure and Firebase CLIs. Publishing the Privacy Policy and passing local checks do not confirm Meta's app-mode, WABA subscription or phone account configuration. Verify real incoming and outgoing messages after Meta configuration is saved.
