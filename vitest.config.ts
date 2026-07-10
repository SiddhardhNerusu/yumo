import { defineConfig } from 'vitest/config';

// Single root config runs every package's tests. Cross-package imports
// (@usual/shared etc.) resolve through the npm-workspace symlinks in
// node_modules, whose package.json `exports` point straight at src/*.ts.
export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'server/test/**/*.test.ts',
    ],
    environment: 'node',
  },
});
