import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
