import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 9094,
    proxy: {
      '/api': {
        target: 'http://localhost:9093',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:9093',
        ws: true
      }
    }
  }
})
