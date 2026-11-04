import Link from 'next/link';
import { getExploreSalonsData } from '@/lib/customer/queries';
import { CustomerIcon } from '@/components/customer/icons';
import { FavoriteButton } from '@/components/customer/favorite-button';
import { SortSelect } from '@/components/customer/sort-select';

export const dynamic = 'force-dynamic';

export default async function ExploreSalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; branchId?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const data = await getExploreSalonsData({
    query: params.q,
    category: params.category,
    branchId: params.branchId,
    sort: params.sort,
  });

  const activeCategory = params.category || 'All';

  return (
    <div className="customer-page explore-page">
      <div className="explore-header-row">
        <div>
          <p className="eyebrow">DISCOVER & BOOK</p>
          <h1>Explore Salons & Specialists</h1>
          <p className="muted">
            Compare services, find locations near you, and reserve appointments with guaranteed real-time availability.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="explore-filter-bar">
        <form method="GET" action="/customer/explore" className="explore-search-form">
          {params.category && <input type="hidden" name="category" value={params.category} />}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <CustomerIcon name="search" size={18} className="search-icon" />
          <input
            type="search"
            name="q"
            defaultValue={params.q || ''}
            placeholder="Search by salon name, service, or area..."
          />
          <button type="submit" className="primary btn-sm">
            Search
          </button>
        </form>

        <form method="GET" action="/customer/explore" className="explore-sort-form">
          {params.q && <input type="hidden" name="q" value={params.q} />}
          {params.category && <input type="hidden" name="category" value={params.category} />}
          <label htmlFor="sortSelect" className="sort-label">Sort by:</label>
          <SortSelect defaultValue={params.sort || 'recommended'} />
        </form>
      </div>

      {/* Category Filter Chips */}
      <div className="category-filter-chips" role="tablist" aria-label="Service categories">
        {data.categories.map((cat) => {
          const isSelected = activeCategory === cat;
          const search = new URLSearchParams();
          if (params.q) search.set('q', params.q);
          if (params.sort) search.set('sort', params.sort);
          if (cat !== 'All') search.set('category', cat);
          const href = `/customer/explore${search.toString() ? '?' + search.toString() : ''}`;

          return (
            <Link
              key={cat}
              href={href}
              className={`filter-chip ${isSelected ? 'active' : ''}`}
              role="tab"
              aria-selected={isSelected}
            >
              {cat}
            </Link>
          );
        })}
      </div>

      {/* Salon Results Count */}
      <div className="results-meta">
        <span>Showing {data.totalCount} verified salon studio{data.totalCount === 1 ? '' : 's'}</span>
        {params.q && (
          <Link href="/customer/explore" className="clear-search-link">
            Clear search ✕
          </Link>
        )}
      </div>

      {/* Salon Cards Grid */}
      {data.salons.length === 0 ? (
        <div className="explore-empty-state">
          <CustomerIcon name="scissors" size={40} />
          <h3>No salons matched your search</h3>
          <p className="muted">Try adjusting your keywords, selecting "All" categories, or clearing filters.</p>
          <Link href="/customer/explore" className="secondary" style={{ marginTop: 15 }}>
            Reset all filters
          </Link>
        </div>
      ) : (
        <div className="explore-salons-grid">
          {data.salons.map((salon) => (
            <article key={salon.id} className="explore-salon-card">
              <div className="card-top">
                <div className="salon-title-area">
                  <div className="salon-name-row">
                    <h3>{salon.name}</h3>
                    <span className="verified-badge">✓ Verified</span>
                  </div>
                  <div className="rating-row">
                    <span className="star-icon">★</span>
                    <strong>{salon.rating}</strong>
                    <span className="muted">({salon.reviewCount} customer reviews)</span>
                  </div>
                </div>
                <FavoriteButton id={salon.id} type="salon" name={salon.name} />
              </div>

              <div className="card-branches-info">
                {salon.branches.map((b) => (
                  <div key={b.id} className="branch-line">
                    <CustomerIcon name="mapPin" size={14} />
                    <span>{b.name}{b.address ? ` · ${b.address}` : ''}</span>
                    {b.phone && <small className="branch-phone">📞 {b.phone}</small>}
                  </div>
                ))}
              </div>

              <div className="card-services-list">
                <span className="services-heading">POPULAR MENU HIGHLIGHTS:</span>
                <div className="service-tags-wrap">
                  {salon.services.slice(0, 4).map((srv) => (
                    <span key={srv.id} className="service-bubble">
                      {srv.name} · ₹{Math.round(srv.pricePaise / 100)} ({srv.durationMinutes}m)
                    </span>
                  ))}
                </div>
              </div>

              <div className="card-bottom-bar">
                <div className="price-tag-wrap">
                  <small>Services from</small>
                  <strong>₹{(salon.startingPricePaise / 100).toLocaleString('en-IN')}</strong>
                  <span className="zero-prepay-badge">Pay at salon</span>
                </div>
                <div className="card-actions">
                  <Link href={`/customer/salons/${salon.id}`} className="secondary btn-sm">
                    View Full Menu
                  </Link>
                  <Link href={`/customer/book?salonId=${salon.id}`} className="primary btn-sm">
                    Book Visit ↗
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
