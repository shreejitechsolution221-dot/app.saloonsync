export function platformSearch(query: Record<string, string | string[] | undefined>) {
  const value = (key: string) => typeof query[key] === 'string' ? query[key].slice(0, 120) : undefined;
  return { q: value('q'), status: value('status'), page: value('page') };
}
