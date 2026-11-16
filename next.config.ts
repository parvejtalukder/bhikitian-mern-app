import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /**
   * ISR pages send `Cache-Control: s-maxage=<revalidate>, stale-while-revalidate=<expire - revalidate>`.
   * The framework default `expire` is one year, which would let a CDN serve a
   * deleted or outdated article for a year if the origin is unreachable. 24h
   * matches the MEDIAWIKI_*_STALE_MS defaults and keeps stale-if-error bounded.
   */
  expireTime: 86_400,
  async redirects() {
    return [{ source: '/wiki/Main_Page', destination: '/', permanent: true }];
  },
};

export default nextConfig;
