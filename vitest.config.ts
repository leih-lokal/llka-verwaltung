import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    // Agent/editor worktrees live under .claude/ and carry their own copies of the tests
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
