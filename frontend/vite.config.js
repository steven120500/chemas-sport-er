// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Archivos estáticos que quieras incluir tal cual
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'ChemaSport ER',
        short_name: 'ChemaSport',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        runtimeCaching: [
          // Cache agresivo para Cloudinary (reduce ancho de banda)
          {
            urlPattern: ({ url }) => url.origin.includes('res.cloudinary.com'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cloudinary-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              }
            }
          },
          // Imágenes locales del sitio
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // API de productos: red primero y caché de respaldo
          {
            urlPattern: ({ url }) =>
              url.origin.includes('chemas-sport-er-backend.onrender.com') &&
              url.pathname.startsWith('/api/products'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-products',
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } // 5 min
            }
          },
          // JS/CSS/Fonts del build: Cache First
          {
            urlPattern: ({ request }) =>
              ['script', 'style', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-static',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
});