/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: 4, // more parallel jsdom workers than this slows every test enough to trip timeouts
    testTimeout: 15_000, // form tests type into many fields; the 5 s default is tight on a busy machine
    clearMocks: true, // call counts must not leak between tests ("not called" assertions)
    setupFiles: './src/test/setup.ts',
    // 64 hex chars; the real key is set per environment in .env.* files.
    env: { VITE_API_ENCRYPTION_KEY: 'a'.repeat(64) },
  },
  // 5184/3011 keep SmellMe clear of Pattas360's 5173/5174/3001 on the same machine.
  server: { port: 5184, proxy: { '/api': { target: 'http://localhost:3011', changeOrigin: true } } },
  // Built into the API's public/ folder, which the API serves (storefront at /, admin at /admin).
  build: {
    outDir: '../public/web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'react-vendor';
          if (id.includes('node_modules/@tanstack')) return 'query-vendor';
        },
      },
    },
  },
});
