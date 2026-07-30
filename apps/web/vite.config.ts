import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        northstar: resolve(__dirname, 'index.html'),
        designStudio: resolve(__dirname, '../design-studio/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            const publicHost = request.headers.host;
            if (publicHost) proxyRequest.setHeader('x-forwarded-host', publicHost);
            proxyRequest.setHeader('x-forwarded-proto', 'http');
          });
        }
      }
    }
  }
});
