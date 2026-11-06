import 'server-only';

// Do not log raw errors: provider/driver messages can contain URLs, tokens, SQL,
// or personal data. These fixed stages and bounded codes identify the failing
// dependency while the browser receives a non-sensitive error.
export type AuthStage = 'origin' | 'rate-limit' | 'provider' | 'authorization' | 'session' | 'configuration' | 'database';
export function logAuthFailure(stage: AuthStage, error?: unknown) {
  const failure = error as { code?: unknown; cause?: { code?: unknown }; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } } | undefined;
  const safe = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : undefined;
  // Classify private messages internally; never emit those messages themselves.
  let details = error instanceof Error ? error.message : '';
  try { details += JSON.stringify(error) ?? ''; } catch { /* Circular errors. */ }
  const reason = /ENETUNREACH|EHOSTUNREACH|network is unreachable/i.test(details) ? 'network_unreachable'
    : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(details) ? 'dns'
    : /ECONNREFUSED/i.test(details) ? 'connection_refused'
    : /certificate|self.signed|SSL|TLS/i.test(details) ? 'tls'
    : /password authentication failed|28P01/i.test(details) ? 'database_credentials'
    : /42P01|relation .+does not exist|table .+does not exist/i.test(details) ? 'missing_table'
    : /42703|column .+does not exist/i.test(details) ? 'missing_column'
    : /42501|permission denied/i.test(details) ? 'database_permission'
    : /DatabaseNotReachable|Can.t reach database server/i.test(details) ? 'database_unreachable'
    : /timed? ?out|ETIMEDOUT|timeout/i.test(details) ? 'timeout' : undefined;
  console.error(JSON.stringify({ event: 'auth.dependency_failed', stage, code: safe(failure?.code),
    causeCode: safe(failure?.cause?.code), sqlState: safe(failure?.meta?.driverAdapterError?.cause?.originalCode), reason }));
}
