import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// `vite.config.ts` exporte une fonction (accès au mode) : on la résout pour le mode « test ».
const resolvedViteConfig =
  typeof viteConfig === 'function'
    ? viteConfig({ mode: 'test', command: 'serve', isSsrBuild: false, isPreview: false })
    : viteConfig;

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
      testTimeout: 15_000,
    },
  }),
);
