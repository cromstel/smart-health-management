import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite resolves the aliases declared in tsconfig without the deprecated plugin.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    // The application name is required configuration and is not written into
    // the source. The test environment supplies one, so the module under test
    // resolves it the same way it does in a deployment.
    env: {
      APP_NAME: 'Test Application',
    },
    include: ['src/tests/**/*.test.ts'],
  },
});
