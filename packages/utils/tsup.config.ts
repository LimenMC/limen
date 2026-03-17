import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cn: 'src/cn.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
