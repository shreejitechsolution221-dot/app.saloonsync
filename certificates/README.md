# Supabase database CA

`supabase-ca.crt` is the public Supabase Root 2021 CA used by this project's
existing verified migration connection. It contains no private key.

SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Expires April 26, 2031. Next.js traces this file into server functions so the
configured Supabase pooler connection can verify its TLS certificate. Never
replace this with a private key or disable certificate verification.
