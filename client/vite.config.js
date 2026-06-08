import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    cssMinify: 'lightningcss',
    outDir: path.resolve(__dirname, '..', 'dist'),
    emptyOutDir: true,
  },
});
