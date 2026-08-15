import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 60', 'android >= 7', 'safari >= 12', 'ios >= 12', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: true
    })
  ],
  build: {
    target: ['es2015', 'chrome60', 'safari11'],
    cssTarget: ['chrome60', 'safari11']
  },
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
