import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    button: 'src/button.tsx',
    card: 'src/card.tsx',
    dropdown: 'src/dropdown.tsx',
    slider: 'src/slider.tsx',
    tooltip: 'src/tooltip.tsx',
    'context-menu': 'src/context-menu.tsx',
    'rainbow-button': 'src/rainbow-button.tsx',
    'brand-icons': 'src/brand-icons.tsx',
    'gradient-button': 'src/gradient-button.tsx',
    'hold-button': 'src/hold-button.tsx',
  },
  format: ['esm'],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@limen/utils', 'react-i18next'],
});
