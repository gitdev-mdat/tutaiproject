import path from 'node:path';
import { defineConfig } from 'vitest/config';
const R = process.env.APP_DIR ?? path.resolve(__dirname, '../../../..');
export default defineConfig({
  root: R,
  test: { environment: 'node', globals: true, include: [`${__dirname}/*.e2e.ts`], testTimeout: 120_000, fileParallelism: false },
  resolve: { alias: { 'server-only': `${R}/test/__mocks__/server-only.js`, '@': R } },
});
