import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/layout';
import { portals, type Portal } from '@/lib/auth/redirects';
export default async function Denied({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params; if (!portals.includes(portal as Portal)) notFound();
  return <AuthLayout portal={portal as Portal}><p className="eyebrow">Access unavailable</p><h1>A different door.</h1><p className="intro">Your account does not currently have access to this space. Contact the salon owner or platform administrator if you believe you should have access.</p><div className="actions"><Link className="primary" href={`/${portal}/login`}>Back to sign in</Link><Link className="secondary" href="/">Choose another space</Link></div></AuthLayout>;
}
