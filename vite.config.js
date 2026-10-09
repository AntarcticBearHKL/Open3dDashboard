import { defineConfig } from 'vite';

// Local-first static app: relative base so `dist/` can be served from any subpath.
export default defineConfig({
  base: './',
  server: {
    port: 5199,
    strictPort: false,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
