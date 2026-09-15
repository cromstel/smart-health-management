import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite resolves the aliases declared in tsconfig without the deprecated plugin.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
