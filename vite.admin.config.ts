import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // The built page is served at /apps/admin/, not the domain root, so asset
  // URLs in the compiled index.html need this prefix (otherwise Vite emits
  // root-absolute /assets/... paths that 404 under a subpath).
  base: '/apps/admin/',

  // Source root for the admin React app.
  root: path.resolve(__dirname, 'apps/admin-src'),

  build: {
    // Output straight into apps/admin/, which is what the server already
    // serves at /apps/admin/ (and /admin, /admin/ redirect there) — no
    // backend changes needed. This folder only ever holds build output, so
    // it's safe to empty it on every build (cleans up the old app.js too).
    outDir: path.resolve(__dirname, 'apps/admin'),
    emptyOutDir: true,
  },

  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
