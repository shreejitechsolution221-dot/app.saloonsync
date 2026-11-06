import {expect,it} from 'vitest';
import {auditEnvironment} from '@/lib/config/environment-audit';
const valid={APP_ORIGIN:'http://127.0.0.1:3106',NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',DATABASE_URL:'postgresql://saloonsync_web:private-password@db.project.supabase.co/postgres?sslmode=verify-full',DIRECT_URL:'postgresql://postgres:private-admin-password@db.project.supabase.co/postgres'};
it('accepts a consistent restricted runtime and treats absent integrations as optional',()=>{
 expect(auditEnvironment(valid).filter(f=>f.level==='error')).toEqual([]);
});
it('detects stale migration projects without exposing either credential',()=>{
 const result=auditEnvironment(valid,{DIRECT_URL:'postgresql://postgres:old-secret@db.other.supabase.co/postgres'});
 expect(result.some(f=>f.code==='PROJECT_MISMATCH')).toBe(true);expect(JSON.stringify(result)).not.toContain('old-secret');expect(JSON.stringify(result)).not.toContain('private-password');
});
it('rejects administrative runtime credentials and unverified transport',()=>{
 const result=auditEnvironment({...valid,DATABASE_URL:'postgresql://postgres:private-password@db.project.supabase.co/postgres'});
 expect(result.map(f=>f.code)).toContain('PRIVILEGED_RUNTIME');expect(result.map(f=>f.code)).toContain('DATABASE_TLS');
});
it('detects public secrets, incomplete integrations and weak worker secrets',()=>{
 const result=auditEnvironment({...valid,NEXT_PUBLIC_TOKEN:'sb_secret_do-not-expose',UPSTASH_REDIS_REST_URL:'https://redis.example',SERVICE_WORKER_SECRET:'short'});
 expect(result.map(f=>f.code)).toEqual(expect.arrayContaining(['PUBLIC_SECRET','PARTIAL_INTEGRATION','WEAK_WORKER_SECRET']));expect(JSON.stringify(result)).not.toContain('do-not-expose');
});
it('detects a missing trusted certificate',()=>{
 const result=auditEnvironment({...valid,DATABASE_URL:valid.DATABASE_URL+'&sslrootcert=missing.crt'},{},()=>false);expect(result.map(f=>f.code)).toContain('CERTIFICATE_MISSING');
});
it('allows a local development database without applying hosted transport rules',()=>{
 expect(auditEnvironment({...valid,DATABASE_URL:'postgresql://postgres:local-only@localhost/test'}).filter(f=>f.level==='error')).toEqual([]);
});
