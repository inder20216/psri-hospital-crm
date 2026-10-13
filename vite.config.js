import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'node:dns'

// Resolve "localhost" to 127.0.0.1 so the dev server is reachable from
// browsers that don't try IPv6 (::1) for localhost.
dns.setDefaultResultOrder('ipv4first')

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Only the production build needs the GitHub Pages subpath — the dev
  // server serves from root, and MSAL's redirect URI (window.location.origin
  // + BASE_URL) must match what's actually registered in Azure for
  // localhost, which is the plain root, not /psri-hospital-crm/.
  base: command === 'build' ? '/psri-hospital-crm/' : '/',
  build: {
    // Keep classic `(max-width: …)` media queries rather than letting the
    // minifier rewrite them to the modern `(width <= …)` range form. The phone
    // layout for the WhatsApp list is built from media queries, and older phone
    // browsers silently drop range syntax — which would leave a phone showing
    // the desktop layout.
    cssTarget: ['chrome87', 'safari14', 'firefox78', 'edge88'],
  },
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
