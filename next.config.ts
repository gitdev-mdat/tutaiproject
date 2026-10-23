import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // PDF rendering uses a native N-API binding that cannot be placed in a
  // Turbopack ESM chunk. Keep it as a Node.js runtime dependency instead.
  // pdf.js loads its worker module and wasm decoders from its own package
  // directory at runtime, so it stays external too.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  // Queued textbook jobs run inside this route on Vercel (inline-runner.ts);
  // pdf.js loads its worker module and wasm decoders by path at runtime,
  // which file tracing cannot see.
  outputFileTracingIncludes: {
    '/api/admin/textbooks': [
      './node_modules/pdfjs-dist/wasm/**/*',
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
  },
};

export default nextConfig;
