'use client';

export function SortSelect({
  defaultValue = 'recommended',
}: {
  defaultValue?: string;
}) {
  return (
    <select
      id="sortSelect"
      name="sort"
      defaultValue={defaultValue}
      onChange={(e) => e.target.form?.requestSubmit()}
    >
      <option value="recommended">Recommended</option>
      <option value="rating">Highest Rated ★</option>
      <option value="price_low">Lowest Starting Price</option>
    </select>
  );
}
