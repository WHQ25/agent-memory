import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@agent-memory/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
});
