import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 500 },
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://api:3000' },
    },
  },
});
