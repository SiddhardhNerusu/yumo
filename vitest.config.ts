import { defineConfig } from 'vitest/config';

// Single root config runs every package's tests. Cross-package imports
// (@yumo/shared etc.) resolve through the npm-workspace symlinks in
// node_modules, whose package.json `exports` point straight at src/*.ts.
export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'server/test/**/*.test.ts',
      // app/test/ is for PURE, RN-free app modules only (data/logic). Do NOT add
      // tests here that import React Native components — node-env vitest can't
      // resolve them and would break the whole run.
      'app/test/**/*.test.ts',
    ],
    environment: 'node',
  },
});
