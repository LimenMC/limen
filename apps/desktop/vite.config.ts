import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5175,
    strictPort: false,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      external: [/\.node$/],
      output: {
        manualChunks: {
          // Three.js and related (large, only used in Skins page)
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          
          // Core React libraries
          'vendor-react': ['react', 'react-dom'],
          
          // UI libraries
          'vendor-ui': ['lucide-react', 'motion', 'gsap'],
          
          // Markdown rendering (only used in mod details)
          'markdown': [
            'react-markdown', 
            'rehype-raw', 
            'rehype-sanitize', 
            'remark-gfm'
          ],
          
          // i18n
          'i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lightningcss', '@tailwindcss/oxide'],
    include: [
      'react',
      'react-dom',
      'i18next',
      'react-i18next',
    ],
    esbuildOptions: {
      loader: {
        '.node': 'empty',
      },
    },
  },
});
