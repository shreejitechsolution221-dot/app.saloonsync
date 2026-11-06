'use client';

import { useState, useEffect } from 'react';
import { CustomerIcon } from './icons';

export function FavoriteButton({
  id,
  type = 'salon',
  name,
  className = '',
}: {
  id: string;
  type?: 'salon' | 'stylist';
  name?: string;
  className?: string;
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const key = `saloonsync_fav_${type}s`;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      setIsFavorite(Array.isArray(stored) && stored.includes(id));
    } catch {
      setIsFavorite(false);
    }
  }, [id, key]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      const stored: string[] = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
      let updated: string[];
      if (stored.includes(id)) {
        updated = stored.filter((item) => item !== id);
        setIsFavorite(false);
      } else {
        updated = [...stored, id];
        setIsFavorite(true);
      }
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event('saloonsync_favorites_changed'));
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`customer-fav-btn ${isFavorite ? 'is-favorited' : ''} ${className}`}
      aria-label={isFavorite ? `Remove ${name || 'item'} from favorites` : `Save ${name || 'item'} to favorites`}
      title={isFavorite ? 'Saved in favorites' : 'Save to favorites'}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill={isFavorite ? '#b33e66' : 'none'}
        stroke={isFavorite ? '#b33e66' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}
