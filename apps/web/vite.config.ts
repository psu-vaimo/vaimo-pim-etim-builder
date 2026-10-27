import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { etimFiles } from './vite/etimFiles.js';

export default defineConfig({
  plugins: [react(), etimFiles(fileURLToPath(new URL('./etim-files', import.meta.url)))],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
