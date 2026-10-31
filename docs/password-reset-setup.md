# Password reset confirmation setup

The app now requests recovery emails with redirectTo `/auth/confirm?portal=platform` (or salon/customer). The new template links directly to that URL with Supabase's TokenHash. GET renders a confirmation button without consuming the token; only the explicit same-origin POST calls verifyOtp with type recovery. This avoids reliance on a PKCE cookie for the new template. It does not revive used/expired tokens or guarantee all scanners will ignore forms.

Required provider change in project danlbqamhuiaqspikazv:

1. Authentication → URL Configuration: Site URL `http://localhost:3000`.
2. Add Redirect URLs `http://localhost:3000/auth/confirm?portal=platform`, `http://localhost:3000/auth/confirm?portal=salon`, `http://localhost:3000/auth/confirm?portal=customer`. Keep existing callback URLs and production entries.
3. Authentication → Email Templates → Reset Password: subject `Reset your Saloonsync password`; replace the body with `supabase/templates/reset-password.html`. Save. This is not the Magic Link template.
4. Request a fresh reset email from the application AFTER saving. Old messages retain the old links.
5. Open the new email's Reset password link, press Continue to reset password, then enter the new password yourself.

The link must use `{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery` exactly. The application supplies the portal query parameter, so appending with & is intentional. Do not wrap this link in ConfirmationURL, which would consume the provider token before the confirmation page.

The old ConfirmationURL template still has a PKCE fallback through the new confirmation page, but it retains its original browser-cookie requirements. The local code cannot activate a hosted Supabase email template. Management access for this selected project remains unavailable; a provider-side save is required.

Auth pages are no-store/no-referrer/noindex. Token hashes are not logged by application code. Treat email URLs as credentials; infrastructure access logs should redact auth URL query strings. The exact cause of the user's original token rejection has not been confirmed from provider logs. No real account password was changed during development.

The shared auth cookie configuration now selects Secure based on the configured transport: explicitly configured HTTP localhost can store/send cookies even under next start; remote hosts retain Secure. A production-build flag alone is insufficient to describe the local transport. Whether this caused the original provider rejection has not been confirmed. Duplicate fragment alerts are cleared when moving to a fresh recovery page.

## PKCE hash format correction

Verified through metadata only (length/prefix, never token contents) that the requested administrator's Supabase recovery hash has the `pkce_` prefix and length 61. The initial local hex-only validator incorrectly rejected this before provider verification. Both page and action now share a validator that accepts plain hexadecimal hashes and `pkce_`-prefixed hashes, preserving the prefix in verifyOtp. Validity, expiration, and one-time use remain Supabase checks. Added regression coverage for the prefixed format. This fixes a confirmed cause of the “incomplete or invalid” message; it cannot restore expired or used tokens.
