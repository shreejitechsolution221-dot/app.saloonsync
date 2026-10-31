'use client';
import Link, { useLinkStatus } from 'next/link';
import { useState, type ComponentProps } from 'react';
type Props = Omit<ComponentProps<typeof Link>, 'prefetch'> & { warm?: boolean };
function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? <span className="navigation-pending" role="status"><span className="ui-spinner" aria-hidden="true"/><span className="sr-only">Loading page…</span><span className="navigation-progress" aria-hidden="true"/></span> : null;
}
// Keep full data prefetch limited to explicit user intent.
export function NavigationLink({ warm = true, onMouseEnter, onFocus, children, ...props }: Props) {
  const [intended, setIntended] = useState(false);
  return <Link {...props} prefetch={warm && intended}
    onMouseEnter={event => { if (warm) setIntended(true); onMouseEnter?.(event); }}
    onFocus={event => { if (warm) setIntended(true); onFocus?.(event); }}>{children}<PendingNavigation/></Link>;
}
