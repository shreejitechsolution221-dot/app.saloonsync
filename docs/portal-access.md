# Portal access

Login validates the account's current database records after the identity provider
verifies the password or email code. The login form and editable identity metadata
cannot assign roles. Wrong-portal login closes the attempted local session and
shows an account-role error. The `next` parameter cannot select another portal.

- Customer: requires an existing customer profile, an enabled application account,
  no salon registration or membership history, and no active platform grant.
- Salon: requires an active membership in an active salon, or salon registration
  details/accepted salon terms before the first workspace is created. Suspended
  and revoked memberships cannot fall back to customer access.
- Platform: requires a current, active, unrevoked `platform.manage` grant.
  Existing platform MFA checks still protect platform operations.

Salon owners and team accounts are excluded from the customer portal even if
older behavior created a customer profile for them. Those rows are preserved;
this change does not delete booking history or alter memberships.

Customer pages, actions, and the private booking API check roles on the server.
Existing salon sessions opening customer pages are sent to the salon panel.
Public customer discovery remains available to signed-out visitors. Email recovery
and invitation acceptance keep their existing dedicated authorization flows.
Role reads are deduplicated only within a React request, never cached in Redis.

Regression coverage includes password, OTP, callback, direct API, suspended
membership, legacy owner profiles, onboarding, cross-portal redirects, and guest
discovery. No database migration is needed.
