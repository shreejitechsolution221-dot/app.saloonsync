export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.DATABASE_URL);
}
export function legalConfig() {
  const terms = process.env.LEGAL_TERMS_URL ?? '';
  const privacy = process.env.LEGAL_PRIVACY_URL ?? '';
  const version = process.env.LEGAL_DOCUMENT_VERSION ?? '';
  const valid = (value: string) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  return { terms, privacy, version, ready: valid(terms) && valid(privacy) && Boolean(version) };
}
export function passwordMinimum() {
  const value = Number(process.env.AUTH_PASSWORD_MIN_LENGTH ?? '12');
  return Number.isInteger(value) && value >= 8 && value <= 128 ? value : 12;
}
