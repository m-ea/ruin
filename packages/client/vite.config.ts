/**
 * Vite configuration for the Ruin client.
 * Configures dev server port and proxy for backend API requests.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all interfaces (IPv4 and IPv6)
    port: 3009,
    proxy: {
      // Proxy auth requests to backend server (avoids CORS during development)
      '/auth': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
      // Proxy Colyseus WebSocket connections
      '/colyseus': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
  define: {
    // Fallback server URL for Colyseus client
    'import.meta.env.VITE_SERVER_URL': JSON.stringify('ws://localhost:2567'),
  },
});
