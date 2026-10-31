import Link from 'next/link';
import {redirect} from 'next/navigation';
import {guard} from '@/lib/auth/page-guard';
import {requireAuthenticatedUser} from '@/lib/authorization/server';
import {businessSchemaReady} from '@/lib/operations/schema-ready';
export const dynamic='force-dynamic';
export default async function Setup(){await guard('salon',requireAuthenticatedUser);if(await businessSchemaReady())redirect('/salon');return <main id="main" className="error-page"><p className="eyebrow">Workspace update</p><h1>A few new things are on the way.</h1><p className="muted">An administrator needs to finish this workspace update before the new features open. Your account and existing records are preserved.</p><Link className="primary" href="/salon">Check again</Link><p><Link href="/salon/select-workspace">Choose another workspace</Link></p></main>;}
