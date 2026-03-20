import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'geometry/index': 'src/geometry/index.ts',
    'node/index': 'src/node/index.ts',
    'mindmap/index': 'src/mindmap/index.ts',
    'edge/index': 'src/edge/index.ts',
    'schema/index': 'src/schema/index.ts',
    'kernel/index': 'src/kernel/index.ts',
    'runtime/index': 'src/runtime/index.ts',
    'config/index': 'src/config/index.ts',
    'document/index': 'src/document/index.ts',
    'read/index': 'src/read/index.ts',
    'perf/index': 'src/perf/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true
})
