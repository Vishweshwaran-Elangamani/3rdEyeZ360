import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: {
      // Force ALL imports of react to the exact same single file
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    force: true  // rebuild dep cache every time
  }
})