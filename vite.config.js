import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'production' ? VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sercosys',
        short_name: 'Sercosys',
        description: 'ERP Sercoinfal C.A.',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }) : null
  ].filter(Boolean),
  server: {
    host: true,   // escucha en 0.0.0.0 → accesible desde la red local
    port: 5173,
    watch: {
      usePolling: true, // Crucial para Windows: asegura que Vite detecte cambios
    }
  },
}))
