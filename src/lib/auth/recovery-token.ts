// Supabase PKCE recovery hashes include a pkce_ prefix. Preserve it when
// verifying with the provider; local shape checks never establish validity.
export const recoveryTokenPattern = /^(?:pkce_)?[a-fA-F0-9]{32,256}$/;
