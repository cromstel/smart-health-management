import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import { DEFAULT_APP_NAME } from './src/config/app'
import {
  DEFAULT_DEV_HOST,
  DEFAULT_DEV_PORT,
  DEFAULT_PROD_HOST,
} from './server/src/config/runtime.ts'

/**
 * The hosts the dev/preview server answers to.
 *
 * `VITE_ALLOWED_HOSTS` is a comma-separated list. Left unset, the documented
 * default applies: any host in development, so the app can be reached by
 * machine name, and the production host alone when NODE_ENV=production.
 */
const resolveAllowedHosts = (configured: string | undefined, isProduction: boolean): true | string[] => {
  const hosts = (configured || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  if (hosts.length > 0) return hosts
  return isProduction ? [DEFAULT_PROD_HOST] : true
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // The application name is configuration, never a literal (see
  // `src/config/app.ts`, which is the single source of truth for the
  // frontend). `vite.config.ts` runs before Vite loads `.env` files into
  // `import.meta.env`, so the value is read from the same place Vite reads
  // it from: the loaded environment (`.env`, `.env.local`, and the shell),
  // falling back to the shipped name.
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')
  const appName = (env.VITE_APP_NAME || process.env.VITE_APP_NAME || '').trim() || DEFAULT_APP_NAME
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    // Gives `%VITE_APP_NAME%` in index.html a value even when the variable is
    // unset, so the document title never renders a raw placeholder.
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
    },
    plugins: [
      // Tailwind v4 directives in src/index.css must be compiled before Vite's
      // Lightning CSS minifier sees the stylesheet.
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          id: '/',
          name: appName,
          short_name: appName.replace(/\s+/g, ''),
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
      rolldownOptions: {
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
      // Deployment specifics are configuration, not literals. The bind address
      // comes from VITE_HOST, the port from VITE_PORT, and the host allow-list
      // from VITE_ALLOWED_HOSTS; the documented defaults live in
      // `server/src/config/runtime.ts`, the one place the API, this config and
      // the end-to-end suite share them.
      host: env.VITE_HOST || process.env.VITE_HOST || (isProduction ? DEFAULT_PROD_HOST : DEFAULT_DEV_HOST),
      port: Number(env.VITE_PORT || process.env.VITE_PORT || DEFAULT_DEV_PORT),
      // VITE_PORT, not PORT: PORT already belongs to the API server
      // (server/src/index.ts reads it from the environment). Sharing one
      // variable would move both servers at once.
      // Fail loudly instead of silently moving to the next free port. Without
      // this, a foreign process already holding the port (a WSL relay held 3000
      // here) made Vite bind the next one up while a test run kept talking to
      // the squatter -- the suite reported failures from an entirely different
      // application.
      strictPort: true,
      allowedHosts: resolveAllowedHosts(env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS, isProduction),
    },
    preview: {
      host: env.VITE_HOST || process.env.VITE_HOST || (isProduction ? DEFAULT_PROD_HOST : DEFAULT_DEV_HOST),
      port: Number(env.VITE_PORT || process.env.VITE_PORT || DEFAULT_DEV_PORT),
      strictPort: true,
      allowedHosts: resolveAllowedHosts(env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS, isProduction),
    },
  }
})
