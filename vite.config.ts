import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import Sitemap from 'vite-plugin-sitemap'
import path from 'path'

const isVitest = process.env.VITEST === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !isVitest &&
      Sitemap({
        hostname: 'https://overnighter.net',
        dynamicRoutes: ['/saved', '/account'],
        exclude: ['/admin', '/onboarding', '/rig-edit', '/premium-welcome'],
        changefreq: 'weekly',
        priority: 0.8,
      }),
    !isVitest &&
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
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
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...(isVitest ? { 'virtual:pwa-register/react': path.resolve(__dirname, './src/test/__mocks__/pwa-register-react.ts') } : {}),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    },
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'scripts/**/*.test.ts'],
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
