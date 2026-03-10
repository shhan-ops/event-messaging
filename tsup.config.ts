import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'core/index': 'core/index.ts',
    'adapters/redis/index': 'adapters/redis/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  target: 'node22',
})
