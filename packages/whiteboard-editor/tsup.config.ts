import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/tool.ts',
    'src/shortcut.ts',
    'src/node.ts',
    'src/toolbox.ts',
    'src/draw.ts',
    'src/types.ts'
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true
})
