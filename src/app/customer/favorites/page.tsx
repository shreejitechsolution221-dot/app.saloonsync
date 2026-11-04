'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CustomerIcon } from '@/components/customer/icons';
import { FavoriteButton } from '@/components/customer/favorite-button';

type SavedSalon = {
  id: string;
  name: string;
  rating: number;
  branches: string[];
};

export default function CustomerFavoritesPage() {
  const [favoriteSalonIds, setFavoriteSalonIds] = useState<string[]>([]);
  const [salons, setSalons] = useState<SavedSalon[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = () => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('glowdesk_fav_salons') || '[]');
      setFavoriteSalonIds(favs);
    } catch {
      setFavoriteSalonIds([]);
    }
  };

  useEffect(() => {
    loadFavorites();
    const handleFavChange = () => loadFavorites();
    window.addEventListener('glowdesk_favorites_changed', handleFavChange);
    return () => window.removeEventListener('glowdesk_favorites_changed', handleFavChange);
  }, []);

  useEffect(() => {
    // Fetch salons to match favorite IDs
    fetch('/api/salons')
      .then((res) => res.json())
      .then((data) => {
        if (data.salons && Array.isArray(data.salons)) {
          setSalons(data.salons);
        }
      })
      .catch(() => {
        // Fallback default
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const savedSalons = salons.filter((s) => favoriteSalonIds.includes(s.id));

  return (
    <div className="customer-page favorites-page">
      <div className="favorites-header">
        <p className="eyebrow">SAVED PLACES & SPECIALISTS</p>
        <h1>Favorites</h1>
        <p className="muted">
          Your saved salons and trusted stylists for instant, one-tap rebooking.
        </p>
      </div>

      {loading ? (
        <p className="muted">Loading your favorites...</p>
      ) : savedSalons.length === 0 ? (
        <div className="empty-favorites-card">
          <CustomerIcon name="heart" size={48} className="empty-heart-icon" />
          <h3>No favorite salons saved yet</h3>
          <p className="muted">
            Tap the heart icon on any salon profile in Explore to save it here for fast access.
          </p>
          <Link href="/customer/explore" className="primary" style={{ marginTop: 20 }}>
            Explore Salons Now ↗
          </Link>
        </div>
      ) : (
        <div className="favorites-grid">
          {savedSalons.map((salon) => (
            <article key={salon.id} className="favorite-card">
              <div className="fav-card-header">
                <div>
                  <h3>{salon.name}</h3>
                  <span className="rating-tag">★ {salon.rating || '4.9'}</span>
                </div>
                <FavoriteButton id={salon.id} type="salon" name={salon.name} />
              </div>

              <div className="fav-actions">
                <Link href={`/customer/salons/${salon.id}`} className="secondary btn-sm">
                  View Menu
                </Link>
                <Link href={`/customer/book?salonId=${salon.id}`} className="primary btn-sm">
                  Book Visit
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
