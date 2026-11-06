import { applicationOrigin } from '@/lib/auth/origin';
export type EnvironmentFinding = { level: 'error' | 'warning' | 'info'; code: string; keys: string[]; message: string };
export function databaseProject(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    return url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ?? (url.hostname.endsWith('.pooler.supabase.com') ? decodeURIComponent(url.username).split('.').slice(1).join('.') : undefined);
  } catch { return undefined; }
}
export function auditEnvironment(env: Record<string, string | undefined>, migrationEnv: Record<string, string | undefined> = {}, certificateExists = (_path: string) => true) {
  const findings: EnvironmentFinding[] = [];
  const add = (level: EnvironmentFinding['level'], code: string, keys: string[], message: string) => findings.push({ level, code, keys, message });
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN']) if (!env[key]) add('error','REQUIRED',[key],'Required application configuration is missing.');
  try { applicationOrigin(env.APP_ORIGIN); } catch { add('error','ORIGIN',['APP_ORIGIN'],'Use an HTTPS origin or an exact HTTP loopback origin, without credentials, a path, query or fragment.'); }
  let project: string | undefined;
  try {
    const url=new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error();
    project=url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  } catch { add('error','AUTH_URL',['NEXT_PUBLIC_SUPABASE_URL'],'Use the configured Supabase project URL.'); }
  for (const [key,value] of Object.entries(env)) {
    if (!key.startsWith('NEXT_PUBLIC_') || !value) continue;
    let role: string | undefined;
    try { role=JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString()).role; } catch { /* Modern publishable keys are not JWTs. */ }
    if (value.startsWith('sb_secret_') || role === 'service_role' || /(?:SECRET|PASSWORD|SERVICE_ROLE|PRIVATE|DATABASE_URL)/.test(key)) add('error','PUBLIC_SECRET',[key],'A privileged value must never be exposed through NEXT_PUBLIC_.');
  }
  const runtime=env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  for (const [key,value] of [['DATABASE_URL',runtime],['DIRECT_URL',env.DIRECT_URL],['migration DIRECT_URL',migrationEnv.DIRECT_URL]] as const) {
    if (!value) { if (key==='DATABASE_URL') add('error','DATABASE_REQUIRED',[key],'A runtime PostgreSQL connection is required.'); continue; }
    try {
      const url=new URL(value); if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error();
      const target=databaseProject(value);
      if (project && target && project!==target) add('error','PROJECT_MISMATCH',[key,'NEXT_PUBLIC_SUPABASE_URL'],'Database and Auth configurations point to different projects.');
      if (key==='DATABASE_URL') {
        const role=decodeURIComponent(url.username).split('.')[0];
        if (['postgres','supabase_admin'].includes(role) && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) add('error','PRIVILEGED_RUNTIME',[key],'The application uses a database administrator login. Provision a restricted runtime credential before production.');
        if (target && url.searchParams.get('sslmode')!=='verify-full') add('error','DATABASE_TLS',[key],'Supabase runtime connections must verify TLS certificates.');
      }
      const certificate=url.searchParams.get('sslrootcert');
      if (certificate && !certificateExists(certificate)) add('error','CERTIFICATE_MISSING',[key],'The configured database CA certificate file is missing.');
    } catch { add('error','DATABASE_URL',[key],'Use a valid PostgreSQL connection URL.'); }
  }
  for (const keys of [ ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'], ['RESEND_API_KEY','EMAIL_FROM'], ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PORTFOLIO_BUCKET'], ['GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET','CALENDAR_TOKEN_ENCRYPTION_KEY'], ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_FROM'] ]) {
    const present=keys.filter(key=>Boolean(env[key]));
    if (present.length && present.length!==keys.length) add('error','PARTIAL_INTEGRATION',keys.filter(key=>!env[key]),'Complete this integration configuration or leave the entire group unset.');
    else if (!present.length) add('info','OPTIONAL_DISABLED',keys,'Optional integration is not configured.');
  }
  const legal=['LEGAL_TERMS_URL','LEGAL_PRIVACY_URL','LEGAL_DOCUMENT_VERSION'];
  if (!legal.every(key=>Boolean(env[key]))) add('warning','REGISTRATION_DISABLED',legal,'Registration stays disabled until legal URLs and a document version are configured.');
  for (const key of ['LEGAL_TERMS_URL','LEGAL_PRIVACY_URL']) if (env[key]) { try { if(new URL(env[key]).protocol!=='https:') throw new Error(); } catch { add('error','LEGAL_URL',[key],'Legal documents require valid HTTPS URLs.'); } }
  const minimum=Number(env.AUTH_PASSWORD_MIN_LENGTH ?? '12');
  if (!Number.isInteger(minimum)||minimum<8||minimum>128) add('error','PASSWORD_MINIMUM',['AUTH_PASSWORD_MIN_LENGTH'],'The password minimum must be an integer between 8 and 128.');
  for (const key of ['METRICS_SECRET','COMMUNICATIONS_WORKER_SECRET','CALENDAR_WORKER_SECRET','SERVICE_WORKER_SECRET']) if (env[key] && env[key].length<32) add('error','WEAK_WORKER_SECRET',[key],'Configured worker and metrics secrets must contain at least 32 characters.');
  if (env.CALENDAR_TOKEN_ENCRYPTION_KEY && Buffer.from(env.CALENDAR_TOKEN_ENCRYPTION_KEY,'base64').length!==32) add('error','CALENDAR_KEY',['CALENDAR_TOKEN_ENCRYPTION_KEY'],'Calendar token encryption requires a base64-encoded 32-byte key.');
  if (env.UPSTASH_REDIS_REST_URL) { try { if(new URL(env.UPSTASH_REDIS_REST_URL).protocol!=='https:') throw new Error(); } catch { add('error','REDIS_URL',['UPSTASH_REDIS_REST_URL'],'Use an HTTPS Redis REST endpoint.'); } }
  return findings;
}
