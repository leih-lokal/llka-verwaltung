import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
