import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/pipeline/**/*.test.ts',
      'lib/mapping/**/*.test.ts',
      'lib/knowledge-graph/**/*.test.ts',
      'lib/knowledge-tree/**/*.test.ts',
      'lib/navigation/**/*.test.ts',
      'lib/onboarding/**/*.test.ts',
      'lib/exam-sets/**/*.test.ts',
      'lib/exams/**/*.test.ts',
      'lib/question-bank/**/*.test.ts',
      'lib/content-import/**/*.test.ts',
      'lib/admin/**/*.test.ts',
      'features/progress/**/*.test.ts',
      'features/student-experience/**/*.test.ts',
    ],
    testTimeout: 30_000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'test/__mocks__/server-only.js'),
      '^server-only$': path.resolve(__dirname, 'test/__mocks__/server-only.js'),
      '@': path.resolve(__dirname),
    },
  },
});
