import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Only the production build needs the GitHub Pages subpath — the dev
  // server serves from root, and MSAL's redirect URI (window.location.origin
  // + BASE_URL) must match what's actually registered in Azure for
  // localhost, which is the plain root, not /psri-hospital-crm/.
  base: command === 'build' ? '/psri-hospital-crm/' : '/',
  server: {
    proxy: {
      // Workflow automation PHP API — run it locally with:
      //   php -S localhost:8000 PSRI/Workflows/php/api.php
      '/psri-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/psri-api/, ''),
      },
      '/psri-webhook': {
        target: 'https://automation.openmindhelpline.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/psri-webhook/, '/webhook'),
      },
    },
  },
}))
