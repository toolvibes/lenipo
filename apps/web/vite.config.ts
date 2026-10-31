import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app (P-GEN-04, TL-43, E-124): the app shell is cached, data never is.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Tasklore',
        short_name: 'Tasklore',
        description: 'Vorgänge, Boards und Wiki',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1b1c1e',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Meine Aufgaben',
            url: '/issues?q=assignee%20%3D%20currentUser%28%29%20AND%20resolution%20is%20EMPTY%20ORDER%20BY%20priority%2C%20updated%20DESC',
          },
          { name: 'Benachrichtigungen', url: '/notifications' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // Pages are served from the cached shell; everything below the API, MCP, the
        // collaboration server and OAuth metadata always goes to the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/collab/, /^\/\.well-known\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // ws: realtime signals run over Socket.IO below /api (E-58).
      '/api': { target: 'http://localhost:4000', ws: true },
      // MCP lives outside /api (D-MCP-01); the profile shows this origin in the setup command.
      '/mcp': { target: 'http://localhost:4000' },
      // OAuth metadata for MCP clients (E-115).
      '/.well-known/oauth-': { target: 'http://localhost:4000' },
      '/collab': {
        target: 'ws://localhost:4001',
        ws: true,
        rewrite: (path) => path.replace(/^\/collab/, ''),
      },
    },
  },
});
