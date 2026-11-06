// Reuse the verified session-pooler endpoint when provisioning a Supabase login.
// Project and database checks prevent accidentally switching credentials to another tenant.
export function runtimeProvisioningTarget(runtimeUrl: string, migrationUrl: string, role: string) {
  const source=new URL(runtimeUrl), administrator=new URL(migrationUrl);
  const project=source.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  const target=new URL(source);
  const username=decodeURIComponent(source.username);const separator=username.indexOf('.');
  target.username=role+(separator<0?'':username.slice(separator));
  if(project && /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(administrator.hostname)) {
    if(decodeURIComponent(administrator.username).split('.').slice(1).join('.')!==project || administrator.pathname!==source.pathname) throw new Error('Database target mismatch.');
    target.hostname=administrator.hostname;
    target.port=administrator.port || '5432';
    target.username=`${role}.${project}`;
  }
  return target;
}
