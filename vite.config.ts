import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import { handleMockApi } from './src/server/mockApi.ts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Tailwind v4 directives in src/index.css must be compiled before Vite's
    // Lightning CSS minifier sees the stylesheet.
    tailwindcss(),
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
  build: {
    target: 'es2020',
    // Vendor chunking: keep heavy, stable third-party libs out of the entry
    // bundle so the bootstrap network payload stays small and repeat visits
    // hit long-term browser/page cache instead of re-downloading them.
    // (motion/react used to be inlined into the entry chunk ~90 kB.)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('motion-dom') ||
            id.includes('/motion/') ||
            id.includes('/motion-')
          ) {
            return 'vendor-motion';
          }
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('/d3-') || id.includes('node_modules/d3/')) return 'vendor-d3';
          if (id.includes('zod')) return 'vendor-zod';
          if (id.includes('sonner')) return 'vendor-sonner';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('@emotion')) return 'vendor-emotion';
          if (id.includes('react-hook-form') || id.includes('@hookform')) return 'vendor-forms';
          if (id.includes('input-otp')) return 'vendor-otp';
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-calendar';
          if (id.includes('qrcode')) return 'vendor-qrcode';
          if (id.includes('jspdf')) return 'vendor-pdf';
          if (id.includes('@simplewebauthn')) return 'vendor-webauthn';
          if (id.includes('@google/genai')) return 'vendor-ai';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: process.env.NODE_ENV === 'production' ? 'medicare.cromstelit.com' : '0.0.0.0',
    port: 3000,
    allowedHosts: process.env.NODE_ENV === 'production' ? ['medicare.cromstelit.com'] : true,
  },
  preview: {
    host: process.env.NODE_ENV === 'production' ? 'medicare.cromstelit.com' : '0.0.0.0',
    port: 3000,
    allowedHosts: process.env.NODE_ENV === 'production' ? ['medicare.cromstelit.com'] : true,
  },
})
