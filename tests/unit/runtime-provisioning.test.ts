import {expect,it} from 'vitest';
import {runtimeProvisioningTarget} from '@/lib/performance/runtime-provisioning';
const source='postgresql://postgres:runtime-test@db.project.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=trusted.crt';
const admin='postgresql://postgres.project:admin-test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
it('uses the verified same-project session pooler while preserving database and TLS options',()=>{
 const target=runtimeProvisioningTarget(source,admin,'saloonsync_web');
 expect(target.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');expect(target.username).toBe('saloonsync_web.project');expect(target.password).toBe('runtime-test');expect(target.pathname).toBe('/postgres');expect(target.searchParams.get('sslmode')).toBe('verify-full');expect(target.searchParams.get('sslrootcert')).toBe('trusted.crt');
});
it.each([admin.replace('postgres.project:','postgres.other:'),admin.replace(':5432/postgres',':5432/other')])('refuses another project or database',candidate=>{
 expect(()=>runtimeProvisioningTarget(source,candidate,'saloonsync_web')).toThrow('mismatch');
});
it('does not adopt an untrusted pooler hostname or administrative password',()=>{
 const target=runtimeProvisioningTarget(source,admin.replace('.pooler.supabase.com','.pooler.supabase.com.evil.invalid'),'saloonsync_web');expect(target.hostname).toBe('db.project.supabase.co');expect(target.password).toBe('runtime-test');
});
