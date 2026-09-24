import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PDF rendering uses a native N-API binding that cannot be placed in a
  // Turbopack ESM chunk. Keep it as a Node.js runtime dependency instead.
  serverExternalPackages: ['@napi-rs/canvas'],
};

export default nextConfig;
