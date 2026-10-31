'use client';
import { useEffect, useRef } from 'react';

export function SidebarNavigation({
  active,
  children,
}: {
  active?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Keep the opened/active section in view so the sidebar doesn't reset to top on navigation
    const activeLink = el.querySelector<HTMLElement>('.selected, [aria-current="page"]');
    if (activeLink) {
      activeLink.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
    } else {
      const saved = sessionStorage.getItem('saloonsync_sidebar_scroll');
      if (saved) {
        const top = parseInt(saved, 10);
        if (!isNaN(top)) el.scrollTop = top;
      }
    }

    const onScroll = () => {
      sessionStorage.setItem('saloonsync_sidebar_scroll', String(el.scrollTop));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [active]);

  return (
    <div className="sidebar-navigation" ref={containerRef}>
      {children}
    </div>
  );
}
