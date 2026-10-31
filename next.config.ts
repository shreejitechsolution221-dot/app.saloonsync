import type { NextConfig } from 'next';
const config: NextConfig = {
  // Production builds must not share webpack artifacts with a running dev app.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV==='production'?'.next-production':'.next'),
  poweredByHeader: false,
  experimental: {serverActions: {bodySizeLimit: '6mb'}},
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ] },
      { source: '/platform/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      { source: '/feedback/:path*', headers: [{key:'Cache-Control',value:'private, no-store'},{key:'Referrer-Policy',value:'no-referrer'}] },
      { source: '/auth/:path*', headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ] },
    ];
  },
};
export default config;
