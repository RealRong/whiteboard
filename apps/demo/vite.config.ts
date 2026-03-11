import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const resolveRoot = (relativePath: string) =>
  path.resolve(__dirname, '..', '..', relativePath)

const coreSrc = resolveRoot('packages/whiteboard-core/src')
const engineSrc = resolveRoot('packages/whiteboard-engine/src')
const reactSrc = resolveRoot('packages/whiteboard-react/src')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@whiteboard/react',
        replacement: path.join(reactSrc, 'index.ts')
      },
      {
        find: '@whiteboard/engine',
        replacement: path.join(engineSrc, 'index.ts')
      },
      {
        find: '@engine-types',
        replacement: path.join(engineSrc, 'types', 'index.ts')
      },
      {
        find: /^@engine-types\/(.*)$/,
        replacement: path.join(engineSrc, 'types', '$1')
      },
      {
        find: /^@whiteboard\/core\/(types|utils|geometry|node|mindmap|edge|schema|kernel|perf)$/,
        replacement: `${coreSrc}/$1/index.ts`
      },
      {
        find: /^types(\/.*)?$/,
        replacement: `${reactSrc}/types$1`
      }
    ]
  },
  server: {
    port: 5173
  }
})
