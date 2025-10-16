import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: 'frontend',
  plugins: [vue()],
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      // proxy /api to the backend server running on localhost:3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: '../dist-frontend',
    emptyOutDir: true
  }
})
