import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base can be overridden at build time for GitHub Pages project sites:
//   VITE_BASE=/STAR-EDIT/ npm run build
export default defineConfig(() => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
}))
