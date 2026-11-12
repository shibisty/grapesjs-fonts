import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'grapesjsFonts',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'grapesjs-fonts.js' : 'grapesjs-fonts.umd.cjs'),
    },
    sourcemap: true,
    rollupOptions: {
      external: ['grapesjs'],
      output: { exports: 'named', globals: { grapesjs: 'grapesjs' } },
    },
  },
});
