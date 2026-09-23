import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_TARGET = process.env.LEXIREAD_API || 'http://127.0.0.1:8787';

export default defineConfig({
  root: here,
  // The shared @lexiread/core workspace package lives one directory up.
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    fs: { allow: [path.resolve(here, '..')] },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the socket client and the QR generator out of the main bundle:
        // both are only needed once a student opens a room or a QR code.
        manualChunks(id) {
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket';
          if (id.includes('node_modules/qrcode')) return 'qr';
          if (id.includes('node_modules/react')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
