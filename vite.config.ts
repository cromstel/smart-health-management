import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'
import { handleMockApi } from './src/server/mockApi.ts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-api-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (handleMockApi(req, res)) {
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (handleMockApi(req, res)) {
            return;
          }
          next();
        });
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        id: '/',
        name: 'Smart Health Manager',
        short_name: 'HealthManager',
        description: 'A modern solution for managing health records and appointments.',
        theme_color: '#001F3F',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // PHI policy (operator-approved 2026-09-10): patient data is never
            // cached by the service worker. NetworkOnly bypasses every cache.
            urlPattern: /\/api\/patients.*/i,
            handler: 'NetworkOnly',
          }
        ],
      },
      devOptions: {
        // Dev-mode SW generation disabled: dev-dist holds no precacheable
        // assets (Vite serves them from memory), so generateSW's globs match
        // zero files and workbox-build logs a spurious glob warning on every
        // dev server start. The production build still generates the real SW
        // (`npm run build` + `npm run preview`), including the NetworkOnly
        // PHI policy for /api/patients. virtual:pwa-register keeps resolving
        // in dev; registerSW() becomes a harmless no-op.
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
})