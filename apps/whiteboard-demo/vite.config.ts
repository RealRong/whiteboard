import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@whiteboard/react': path.resolve(__dirname, '../../packages/whiteboard-react/src/index.ts'),
      '@whiteboard/core': path.resolve(__dirname, '../../packages/whiteboard-core/src/index.ts')
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')]
    }
  }
})
