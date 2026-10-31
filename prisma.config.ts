import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
config({ path: '.env.local', quiet: true });
config({ path: '.env.migrations.local', quiet: true });
config({ quiet: true });
// Runtime/CLI scripts use node-postgres URL options. The migration engine uses
// sslcert/sslaccept instead; translate the CA option without weakening verification.
let migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (migrationUrl) {
  const url = new URL(migrationUrl);
  const root = url.searchParams.get('sslrootcert');
  if (root) {
    url.searchParams.delete('sslrootcert');
    url.searchParams.set('sslcert', root);
    url.searchParams.set('sslaccept', 'strict');
    url.searchParams.set('sslmode', 'require');
    migrationUrl = url.toString();
  }
}
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: migrationUrl } });
