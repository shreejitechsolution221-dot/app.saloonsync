# Customer panel and Redis

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the server environment (or `.env.local` for development). Use a separate Redis database per environment. Both values must be configured; neither belongs in browser environment variables or source control. Rotate any token previously committed to the repository.

The existing shared Redis client now has a one-second request timeout and no automatic retries. Cached reads, writes, and invalidations have a 300ms budget and fall back to database reads when unavailable.

Customer dashboard, booking history, and loyalty/offer DTOs use customer-specific keys with a 15-second TTL. Public explore results and salon profiles use a 30-second TTL. Search keys include a digest of the filters. Customer mutations invalidate that customer's private entries after commit. Changes made through the salon panel appear in customer caches after at most their TTL; browser/public API caching can add another 30 seconds for the salon directory.

Availability and final booking/rescheduling validation always read live database state. The same validation applies opening hours, service eligibility, active branch/staff status, approved leave, required shifts, and overlapping appointments across branches. The existing PostgreSQL overlap trigger remains the final concurrent-write safeguard. Cancellation, rescheduling, and feedback lock the owned appointment before checking its state.

Application action rate limits use an atomic Redis increment/expiry with hashed identifiers and a 15-minute window. If Redis is unavailable, the existing shared PostgreSQL rate limiter is used. Login and registration retain their existing separate limits.

Favorites remain browser-local. `/api/salons` supplies the public salon directory; malformed local storage is ignored. Notification settings are no longer presented as saved switches: consent is collected during booking, and delivery depends on the salon's messaging configuration.
