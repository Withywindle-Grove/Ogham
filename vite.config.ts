/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { BRAND } from './src/brand.ts';

// Page colour from src/ui/tokens.css (light theme).
const PAGE_LIGHT = '#FAFAF7';

// Set by Vercel and GitHub Actions. (Declared here so the project needn't add Node's type definitions.)
declare const process: { env: Record<string, string | undefined> };
// The version the ⋯ menu shows (F55, au-1): the commit's short id and the day it was built; "dev" for a build made on a
// computer. The gallery and the layout harness show a fixed stand-in instead, so their pictures don't change each build.
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
const APP_BUILD = COMMIT ? { id: COMMIT.slice(0, 7), date: new Date().toISOString().slice(0, 10) } : { id: 'dev', date: null };

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(APP_BUILD) },
  plugins: [
    react(),
    // The page title comes from src/brand.ts, like every other place the app's name shows.
    { name: 'brand-title', transformIndexHtml: (html: string) => html.replace('%APP_NAME%', BRAND.appName).replaceAll('%APP_TAGLINE%', BRAND.tagline) },
    VitePWA({
      // The app decides when to switch to a new version (src/app/appUpdates.ts), so nothing typed is lost.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon-48.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: BRAND.appName,
        short_name: BRAND.shortName,
        description: BRAND.tagline,
        theme_color: PAGE_LIGHT,
        background_color: PAGE_LIGHT,
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app and its bundled fonts so it opens offline.
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        // The component gallery is a developer page: not cached, and never answered with the app.
        globIgnores: ['**/gallery*.html'],
        navigateFallbackDenylist: [/^\/gallery/],
      },
    }),
  ],
  build: {
    // The app, plus the hidden component gallery (docs/06 "Gallery and screenshot tests").
    rollupOptions: { input: { main: 'index.html', gallery: 'gallery.html' } },
  },
  test: {
    // App tests, plus the tests of the repo's own scripts. Database tests run separately with `npm run test:db`.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // Each test starts with nothing kept on the device from an earlier one (src/testing/setup.ts), and with the
    // signed-in screens (lazy in the app) already loaded (src/testing/setupLazyScreens.ts).
    setupFiles: ['src/testing/setup.ts', 'src/testing/setupLazyScreens.ts'],
    // 15 s, not the default 5 s: on the PC that runs CI (and on a busy laptop at commit time) the long screen walks
    // (a whole character creation, the damage pad) ran out at 5 s while the browser jobs shared the machine. A slow
    // machine, not a fault; a test that truly hangs still fails.
    testTimeout: 15_000,
  },
});
