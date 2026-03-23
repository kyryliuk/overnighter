import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const isVitest = process.env.VITEST === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !isVitest &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons.svg', 'pwa-icon.svg'],
        manifest: {
          name: 'Overnighter',
          short_name: 'Overnighter',
          description: 'Find reliable overnight stops and keep traveling even with spotty connectivity.',
          theme_color: '#0f172a',
          background_color: '#020617',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/[a-z0-9.-]+\.basemaps\.cartocdn\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'carto-tiles',
                expiration: {
                  maxEntries: 256,
                  maxAgeSeconds: 60 * 60 * 24 * 14,
                },
              },
            },
            {
              urlPattern: /^https:\/\/[a-z0-9.-]+\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: 256,
                  maxAgeSeconds: 60 * 60 * 24 * 14,
                },
              },
            },
          ],
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
      '_bmad/**',
      '_bmad-output/**',
      'overnighter/**',
    ],
  },
})
