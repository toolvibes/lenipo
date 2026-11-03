import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Excalidraw's fonts from our own origin (the CSP allows no font CDN): served in development,
 * copied into the build. The 12 MB Chinese font stays out; text falls back to a system font.
 */
function excalidrawFonts(): Plugin {
  const source = fileURLToPath(
    new URL('./node_modules/@excalidraw/excalidraw/dist/prod/fonts', import.meta.url),
  );
  const wanted = (path: string) => !path.includes('Xiaolai');
  return {
    name: 'lenipo-excalidraw-fonts',
    configureServer(server) {
      server.middlewares.use('/excalidraw/fonts', (request, response, next) => {
        const file = normalize(
          join(source, decodeURIComponent((request.url ?? '').split('?')[0] ?? '')),
        );
        if (
          !file.startsWith(source) ||
          !wanted(file) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          next();
          return;
        }
        response.setHeader('Content-Type', 'font/woff2');
        createReadStream(file).pipe(response);
      });
    },
    writeBundle(options) {
      if (!options.dir || !existsSync(source)) return;
      cpSync(source, join(options.dir, 'excalidraw/fonts'), { recursive: true, filter: wanted });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    excalidrawFonts(),
    tailwindcss(),
    // Installable app (P-GEN-04, TL-43, E-124): the app shell is cached, data never is.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Lenipo',
        short_name: 'Lenipo',
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
      // The Jira-compatible API (TL-48).
      '/rest/api/2/': { target: 'http://localhost:4000' },
      // SCIM for identity providers (TL-52).
      '/scim/v2/': { target: 'http://localhost:4000' },
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
