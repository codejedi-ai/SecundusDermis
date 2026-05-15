import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const BACKEND_TARGET = 'http://localhost:8000'

/** Shared proxy for dev server and `vite preview` — same paths as FastAPI / run.sh prod. */
const backendProxy = {
  '/api': {
    target: BACKEND_TARGET,
    changeOrigin: true,
  },
  '/socket.io': {
    target: BACKEND_TARGET,
    changeOrigin: true,
    ws: true,
  },
  '/images': {
    target: BACKEND_TARGET,
    changeOrigin: true,
  },
  '/uploads': {
    target: BACKEND_TARGET,
    changeOrigin: true,
  },
}

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
    proxy: backendProxy,
  },
  preview: {
    proxy: backendProxy,
  },
})
