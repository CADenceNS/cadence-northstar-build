import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
