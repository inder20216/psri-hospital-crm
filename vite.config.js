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
      // Workflow automation PHP API.
      //
      // Pointed at the LIVE API: the local server on :8000 runs an older copy of
      // the code that has no cases endpoints, so the WhatsApp list could not load
      // anything locally. The live host serves the same database, so this is
      // equivalent to local — just with the current code.
      //
      // To run against a local PHP server instead, swap the two blocks: use
      // target 'http://localhost:8000' and add
      //   rewrite: (path) => path.replace(/^\/psri-api/, ''),
      // started with:  php -S localhost:8000 PSRI/Workflows/php/api.php
      '/psri-api': {
        target: 'https://43.204.141.221.nip.io',
        changeOrigin: true,
        secure: true,
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
