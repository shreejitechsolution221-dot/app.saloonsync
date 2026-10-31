# Password, email and recovery improvements

Updated 28 October 2026.

## Password creation and reset

Owner registration, customer registration and password reset share the same live
controls. They show minimum-length feedback, a local zxcvbn strength estimate,
confirmation mismatch feedback and a positive matching state. Changing either
field updates the result. Strength is guidance; provider rules and the configured
minimum remain authoritative server-side checks.

“Suggest a strong password” uses the browser's cryptographic random generator,
unbiased sampling and shuffling. It fills both fields without copying the password
to the clipboard or logging it. Save suggestions in a password manager. Password
strength dictionaries load lazily only after a new password is typed, not on the
login page. Password contents never go to an external checking service.

After a valid recovery link and a successful provider password update, the server
signs out provider sessions and redirects to the originating portal's sign-in
page with a confirmation message. Provider errors do not produce success states.
The recovery marker alone never authenticates a request.

## Registered-account recovery

Forgot-password rate-limits the request, looks up whether the normalized email
exists in Supabase Auth and is not soft-deleted, and only then requests a provider
reset email. Unknown addresses receive “Email not found” and cause no reset-email
request. Lookup failures also cause no email request. This deliberately exposes
account existence in recovery, as requested, while login errors remain generic.

`registeredEmailExists` is server-only and returns a boolean. A restricted runtime
database role now needs USAGE on auth and SELECT on **only email and deleted_at**
columns of auth.users for this lookup, in addition to its app-schema permissions.
Do not grant browser roles this access. The development postgres connection
already has the necessary privileges. No emails or new accounts were created by
verification; provider reset behavior is tested with mocks.

## Disposable and fake signup addresses

Both signup portals and new team invitations reject known disposable domains,
including their subdomains. The server uses a pinned CC0 list of 9,963 domains:
`src/lib/email/data/disposable-domains.json`. Source revision and license are stored
in that file. The archived npm list was removed in favor of the maintained source.
Update the JSON and database seed through a reviewed migration as the list evolves.

Reserved/example domains are rejected. New signup/invitation addresses also get a
bounded DNS check for mail routing, with a small expiring domain-only cache and
standard address-record fallback when MX is absent. Transient DNS errors ask the
user to retry. Checks do not probe mailboxes or send test mail. Domain checks cannot
prove a mailbox exists or identify every fabricated address; provider email
verification remains required before protected access. Existing accounts keep
their login/recovery path rather than being stranded by a later blocklist change.

There is no temporary-email generator or temp-mail button in the application.
Email inputs now use a neutral label/placeholder and retain normal email and
password-manager autocomplete. Browser-extension controls are outside app markup.

## One remaining Supabase project setting

The sixth migration deployed the blocklist and `app.before_user_created(jsonb)`
hook function. Synthetic live database queries confirm it rejects blocked domains.
The function is SECURITY INVOKER; supabase_auth_admin can execute it and read only
its blocklist. Public/anonymous/authenticated roles get no function or table access.

**The function must still be enabled in Supabase Auth settings** to protect callers
who bypass the app and call the provider signup API directly:

1. Open the selected project `danlbqamhuiaqspikazv` in Supabase.
2. Go to Authentication → Hooks → Before User Created.
3. Choose the Postgres function `app.before_user_created` and enable/save the hook.

The connector lacks management access to this new project, and the available
browser requires Supabase dashboard sign-in. Hook activation was not silently
assumed or bypassed. Application signup/invitation filtering is already active.

## Login overhead

Anonymous requests, public entry pages and Server Action POSTs skip proxy Auth
roundtrips. Signed-in protected GET requests use provider signed-claims validation
for cookie refresh; protected handlers still verify the provider user and current
database authorization. Identity/provider clients are deduplicated only within a
React server-render request. Existing profiles are read rather than upserted on
every check. No cross-user or cross-request authorization result cache is added.

Real authenticated login latency still depends on the Supabase region/network.
No live credentials were used to benchmark an actual successful login.

References: [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook),
[maintained domain list](https://github.com/disposable-email-domains/disposable-email-domains),
[local password estimator](https://zxcvbn-ts.github.io/zxcvbn/guide/getting-started/).

## Email OTP login and reset confirmation

Salon and customer login now offer email OTP for existing accounts only (`shouldCreateUser: false`). Codes are verified by Supabase; the HttpOnly pending-login cookie binds the requested email and portal. Requests and verification attempts are database rate limited, resend waits at least 60 seconds, and normal protected-page authorization still applies. Platform login does not offer OTP.

Provider configuration required: in the selected project's Authentication → Email Templates → Magic Link template, include `{{ .Token }}` in the email body, for example:

```html
<h2>Your Saloonsync sign-in code</h2>
<p>Enter this one-time code on the sign-in screen:</p>
<p><strong>{{ .Token }}</strong></p>
<p>If you did not request this code, ignore this email.</p>
```

Supabase generates and expires the code. Configure the OTP expiration/length in your project's Auth settings as appropriate (the form accepts 6–10 numeric digits). Keep email sign-in enabled and configure working SMTP delivery. The management connection does not currently have access to this project, so template activation must be performed in the dashboard. Without the token variable, the default template sends a link instead of displaying a code. See https://supabase.com/docs/guides/auth/auth-email-passwordless .

Successful reset requests now open a modal with inbox guidance, a Got the email button, and the portal's Sign in link. Popular email providers have an Open inbox link; other addresses show an email-app instruction. Success means the provider accepted the request, not proof of delivery or mailbox ownership. Unknown accounts and provider failures never open the popup. Mailbox ownership is verified only through the reset link or OTP.

## Performance verification (28 October 2026)

Independent authorized reads now run concurrently on salon and platform dashboards. Customer dashboard reads profile and appointments concurrently without writing a profile on each visit. Saving a customer profile still creates it when needed. Database pools keep idle connections for 60 seconds and enable TCP keepalive. Current permission and email/MFA checks remain in place.

Fixed platform advisory-lock queries to cast PostgreSQL's void result to text, which the Prisma PostgreSQL adapter can decode. Confirmed this against the selected database during authorized operator provisioning.

The local app now runs the production build with supported bundled Node 24 (`npm start`), avoiding development compilation delays. Three local HTTP requests per sign-in page returned 200; warm response times were 8–16 ms (cold salon page 111 ms). These measure HTML responses, not successful provider authentication or email delivery. Database latency was approximately 188 ms per warm round trip and 1.6 seconds for a fresh connection plus lookup, so remote Auth/database/SMTP operations still depend on network and provider response time.

Validation: production build and typecheck passed, 113 unit tests, 20 database integration tests, and eight production desktop/mobile authentication UI checks passed. No successful password login was benchmarked using an administrator's credentials.
