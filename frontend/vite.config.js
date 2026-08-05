import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7565',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:7565',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:7565',
        changeOrigin: true,
      }
    }
  }
})
