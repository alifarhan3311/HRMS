import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:5001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_SOCKET_PROXY || env.VITE_API_PROXY || 'http://localhost:5001',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
