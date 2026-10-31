import { notFound } from 'next/navigation';
import { AuthLayout } from '@/components/auth/layout';
import { LoginForm } from '@/components/auth/forms';
import { portals, type Portal, safeDestination } from '@/lib/auth/redirects';
import { authConfigured } from '@/lib/auth/config';
export const dynamic = 'force-dynamic';
export default async function Login({ params, searchParams }: { params: Promise<{ portal: string }>; searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { portal } = await params; if (!portals.includes(portal as Portal)) notFound();
  const query = await searchParams;
  const copy = { salon: ['Welcome back', 'Run your salon.', 'A little less juggling. A little more doing what you love. Sign in to your salon workspace.'], customer: ['A moment for you', 'Plan your next visit.', 'Your appointments, your details, your time. Sign in to your personal space.'], platform: ['Behind the scenes', 'Manage the platform.', 'Sign in with your authorized administrator account to continue.'] }[portal as Portal];
  return <AuthLayout portal={portal as Portal}><p className="eyebrow">{copy[0]}</p><h1>{copy[1]}</h1><p className="intro">{copy[2]}</p><>{query.reset === 'success' && <p className="status" role="status">Password updated. Sign in with your new password.</p>}</><LoginForm portal={portal as Portal} next={safeDestination(query.next, `/${portal}`)} configured={authConfigured()}/></AuthLayout>;
}
