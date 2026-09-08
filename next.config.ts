import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  // Self-hosted on a VPS via Docker — emit a minimal standalone server bundle.
  output: 'standalone',
  // typedRoutes is enabled in Phase 12 once every route exists.
  // Pin the workspace root so Turbopack doesn't walk up to stray lockfiles in $HOME.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
