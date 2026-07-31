import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // When running `npm run dev`, proxy /api calls to a locally running
      // `wrangler pages dev` instance (see README for the two-terminal setup).
      '/api': 'http://127.0.0.1:8788',
    },
  },
});
