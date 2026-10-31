# Optional integration setup

Core operations work without these providers. Keep credentials in server environment variables, never in public variables or chat messages. Restart the application after configuration. Use .env.example for names.

## Private portfolio and receipt images

Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PORTFOLIO_BUCKET to a dedicated private bucket, for example saloonsync-private. Configure the bucket public flag as false and deny anon/authenticated browser access through storage policies. Existing broad storage policies must not grant access to this bucket. The application verifies the private flag but cannot prove all external policy combinations.

Uploads accept JPEG, PNG or WebP, up to 5 MB and 20 megapixels, validate signatures and sanitize/resize images through Sharp. Reads require current authorization and issue a signed URL valid for 60 seconds. Withdrawing consent prevents new portfolio links; previously issued links may remain valid until expiry. Configure backups, retention and deletion procedures before collecting customer images.

## WhatsApp

Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM. Set the five TWILIO_TEMPLATE_* variables to approved Content Template SIDs. Templates use numbered variables 1/2/3; review the payload mapping in src/lib/operations/communications.ts when submitting templates. Enable business automation rules only after template and customer opt-in review.

Configure a scheduler to POST /api/internal/communications periodically with Authorization: Bearer <COMMUNICATIONS_WORKER_SECRET>. Use a random secret of at least 32 characters, HTTPS and a server-side scheduler. Never place this secret in a browser. Jobs recheck consent before sending; each worker claims a bounded batch. Provider acceptance is recorded as sent, not proven delivery. Ambiguous network outcomes are held for operator review to avoid duplicate messages; do not blindly replay them.

Provider requirements: [Twilio Content templates](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder) and [WhatsApp notification templates](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).

## Google Calendar

Create a Google OAuth web client, configure its consent screen/test users or verification as appropriate, and enable Calendar API. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET. Register the exact callback APP_ORIGIN/api/calendar/callback, where APP_ORIGIN is the deployed HTTPS origin. Set CALENDAR_TOKEN_ENCRYPTION_KEY to base64 encoding of 32 cryptographically random bytes. Preserve this key securely: replacing it makes existing encrypted tokens unreadable and requires reconnecting accounts.

In Settings → Integrations, each user connects their own Google account. The application uses calendar.app.created to manage a secondary calendar. It does not read all primary-calendar events or treat Google Calendar as the booking source of truth. Configure a periodic POST to /api/internal/calendar with Authorization: Bearer <CALENDAR_WORKER_SECRET>, another random secret of at least 32 characters. Jobs recheck membership and assignment, retry bounded failures and support manual retry. Calendar updates are asynchronous.

See [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) and [event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

## Acceptance checks

Use dedicated test accounts and a test location to verify owner/staff access, booking → checklist → completion → invoice → payment, customer consent withdrawal, inventory deductions, cash closing and owned-business report scope. Test provider flows with opted-in test recipients before enabling automation. No external messages or OAuth connections were created during implementation.
