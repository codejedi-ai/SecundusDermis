import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Production bundle: `app/dist` (FastAPI serves this when you run ./run.sh prod).
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // All /api/* calls → FastAPI backend (strips the /api prefix)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Product images served by FastAPI's StaticFiles mount
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})