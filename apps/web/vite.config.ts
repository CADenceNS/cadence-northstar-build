import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '/design-studio': resolve(configDirectory, '../design-studio'),
      react: resolve(configDirectory, 'node_modules/react'),
      'react-dom': resolve(configDirectory, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      input: {
        northstar: resolve(configDirectory, 'index.html'),
        designStudio: resolve(configDirectory, 'design-studio.html'),
      },
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(configDirectory, '..')],
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
        },
      },
    },
  },
});
