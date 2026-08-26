import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Source root for the React app (dev entry lives here as apps/client-portal/index.html)
  root: path.resolve(__dirname, 'apps/client-portal'),

  build: {
    // Write the compiled bundle straight into the repo root so Express's
    // existing `express.static(ROOT)` keeps serving it — no backend changes.
    outDir: path.resolve(__dirname, '.'),
    // Required: outDir sits outside `root` and IS the whole repo. Vite would
    // otherwise wipe everything in it before writing. Never remove this.
    emptyOutDir: false,
    // Flatten output to the repo root (no /assets/ subfolder). The server's
    // catch-all vanity route `/:org/:project` (server/index.js) intercepts
    // any two-segment path before static files are served, so a nested
    // /assets/*.js path 404s. Single-segment root files avoid that route
    // entirely without changing server code.
    assetsDir: '.',
    rollupOptions: {
      output: {
        // Fixed filenames (no content hash) so rebuilds overwrite in place
        // instead of leaving orphaned hashed files at the repo root.
        entryFileNames: 'client-portal.bundle.js',
        chunkFileNames: 'client-portal-[name].js',
        assetFileNames: 'client-portal[extname]',
      },
    },
  },

  server: {
    proxy: {
      // Let `npm run dev:ui` call the real Express API (npm run dev, port 3000)
      // without CORS issues while developing.
      '/api': 'http://localhost:3000',
    },
  },
});
