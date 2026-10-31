export function needsSessionRefresh(path: string, method: string, cookieNames: readonly string[]) {
  if (method !== 'GET' || !cookieNames.some(name => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) return false;
  if (path === '/' || /^\/(?:salon|customer|platform)\/(?:login|register|access-denied)$/.test(path) || path.startsWith('/auth/')) return false;
  return true;
}
