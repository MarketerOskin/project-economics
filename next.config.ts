import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  // Self-hosted on a VPS via Docker — emit a minimal standalone server bundle.
  output: 'standalone',
  // typedRoutes intentionally off: nav/filter/tab hrefs are built dynamically from
  // config and query strings, and every route is covered by an integration test.
  // Pin the workspace root so Turbopack doesn't walk up to stray lockfiles in $HOME.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
  async headers() {
    // The app is embedded as an iframe in Bitrix24 — allow only Bitrix ancestors,
    // and no one else (defends against clickjacking / rogue embedding, ТЗ §44).
    const frameAncestors =
      "frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com https://*.bitrix24.de https://*.bitrix24.eu https://*.bitrix24.pl 'self'";
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: frameAncestors },
          { key: 'X-Frame-Options', value: 'ALLOW-FROM https://bitrix24.ru' },
        ],
      },
    ];
  },
};

export default nextConfig;
