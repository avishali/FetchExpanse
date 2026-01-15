import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'desktop/renderer'),
  base: './', // Important for Electron to load relative paths
  build: {
    outDir: path.join(__dirname, 'dist-renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'desktop/renderer/src'),
    },
  },
});
