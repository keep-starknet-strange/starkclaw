import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./lib/signer/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/signer/**/*.ts'],
      exclude: ['lib/signer/**/*.test.ts', 'lib/signer/__tests__/**'],
      all: true,
      lines: 95,
      functions: 95,
      branches: 90,
      statements: 95,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
