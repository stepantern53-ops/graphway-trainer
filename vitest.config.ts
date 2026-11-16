import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const sourceAliases = Object.fromEntries(
  ['math-core', 'contracts', 'curriculum'].map((name) => [
    `@graphway/${name}`,
    fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))
  ])
);

export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    projects: [
      { test: { name: 'math-core', include: ['packages/math-core/tests/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'contracts', include: ['packages/contracts/tests/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'curriculum', include: ['packages/curriculum/tests/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'web', include: ['apps/web/src/**/*.test.{ts,tsx}'], environment: 'jsdom' } },
      { test: { name: 'server', include: ['apps/server/tests/**/*.test.ts'], environment: 'node', sequence: { concurrent: false } } }
    ],
    watch: false
  }
});
