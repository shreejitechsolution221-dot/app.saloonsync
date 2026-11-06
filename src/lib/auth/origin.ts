export function isLoopbackHttp(url: URL) {
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password;
}
export function applicationOrigin(value: string | undefined) {
  if (!value) throw new Error('APP_ORIGIN is required.');
  const url = new URL(value);
  if ((url.protocol !== 'https:' && !isLoopbackHttp(url)) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid application origin.');
  return url.origin;
}
