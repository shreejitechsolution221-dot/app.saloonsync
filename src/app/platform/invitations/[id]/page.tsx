import Link from 'next/link';
import { AccessError, requireAuthenticatedUser } from '@/lib/authorization/server';
import { authConfigured } from '@/lib/auth/config';
import { AcceptInvitationForm } from '@/components/platform/forms';
import { Dashboard } from '@/components/dashboard';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { platformSchemaReady } from '@/lib/platform/schema-ready';
export const dynamic = 'force-dynamic';
export default async function Invitation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let user;
  try { if (authConfigured()) user = await requireAuthenticatedUser(); }
  catch (error) { if (!(error instanceof AccessError)) throw error; }
  if (!user) return <Dashboard label="Platform"><section className="panel"><h1>SaloonSync platform invitation</h1><p>Sign in with your existing verified account, then reopen this invitation link to review and accept your proposed role.</p><div className="actions"><Link href="/customer/login">Customer account sign in</Link><Link href="/salon/login">Salon account sign in</Link><Link href="/platform/login">Existing operator sign in</Link></div></section></Dashboard>;
  if (!await platformSchemaReady()) notFound();
  const invitation = await db.platformRecord.findFirst({ where: { id, kind: 'invitation', status: 'pending', payload: { path: ['email'], equals: user.email } }, select: { title: true, payload: true } });
  const payload = invitation?.payload as Record<string, string> | undefined;
  if (!payload || Date.parse(`${payload.expiresAt}Z`) <= Date.now()) notFound();
  return <Dashboard label="Platform"><section className="panel"><h1>SaloonSync platform invitation</h1><p>{invitation?.title}</p><p>Proposed role: <strong>{payload.role}</strong> · Expires {payload.expiresAt} UTC.</p><p>Sign in with the invited, verified email and verify MFA to accept. This grants platform permissions and does not grant salon ownership.</p><Link href="/platform/mfa">Set up or verify MFA</Link><AcceptInvitationForm id={id}/><Link href="/platform">Open platform overview</Link></section></Dashboard>;
}
