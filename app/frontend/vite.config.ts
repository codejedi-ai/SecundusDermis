import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    // Production bundle: `app/dist` (FastAPI serves this when you run ./run.sh prod).
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    // Contract: paths (/api/..., /socket.io, /images) stay the same; only ``target`` host/port
    // changes per machine (e.g. another dev box IP). Do not rewrite paths here.
    proxy: {
      // Forward ``/api`` unchanged (same path on FastAPI: ``/api/...``).
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Socket.IO when VITE_API_URL is unset (socket-context uses page origin + /socket.io)
      '/socket.io': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      // Product images served by FastAPI's StaticFiles mount
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})