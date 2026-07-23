import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-state': ['@reduxjs/toolkit', 'react-redux', 'axios'],
            'vendor-ui': ['framer-motion', 'lucide-react'],
            'vendor-charts': ['recharts'],
            'vendor-realtime': ['socket.io-client'],
          },
        },
      },
    },
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
