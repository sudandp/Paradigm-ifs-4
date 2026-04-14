import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //   manifest: {
    //     name: 'Paradigm Office',
    //     short_name: 'Paradigm',
    //     description: 'Paradigm Integrated Field Services Application',
    //     theme_color: '#006B3F',
    //     background_color: '#ffffff',
    //     display: 'standalone',
    //     orientation: 'portrait',
    //     start_url: '/',
    //     icons: [
    //       {
    //         src: '/Paradigm-Logo-3-1024x157.png',
    //         sizes: '1024x157',
    //         type: 'image/png'
    //       }
    //     ]
    //   }
    // })
  ],



  optimizeDeps: {
    include: [
      '@react-pdf/renderer',
      '@react-pdf/pdfkit',
      'pako',
    ],
  },
  resolve: {
    alias: {
      '@/services': path.resolve(__dirname, './services'),
      '@/components': path.resolve(__dirname, './components'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/store': path.resolve(__dirname, './store'),
      '@/utils': path.resolve(__dirname, './utils'),
      '@/types': path.resolve(__dirname, './types'),
    },
  },
  server: {
    // Proxy /api requests to the Node.js server running on port 3000
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        // Rewrite the path to remove /api if the backend doesn't expect it
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    // Configure the file watcher.  Without an ignore list Vite watches the entire
    // project directory, so events such as downloading or opening files in external
    // directories can trigger an unnecessary full reload.  Ignoring these patterns
    // prevents unwanted reloads when you download PDFs or other files during
    // development.
    host: true,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/tmp/**',
        '**/Downloads/**',
        '**/.DS_Store/**',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['@react-pdf/renderer', 'jspdf', 'jspdf-autotable'],
          'excel-vendor': ['exceljs', 'jszip'],
          'charts-vendor': ['chart.js'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-shared': ['lucide-react', 'react-date-range', 'framer-motion'],
          'utils-shared': ['date-fns', 'file-saver', 'zustand', 'pako'],
          'capacitor-vendor': [
            '@capacitor/core', 
            '@capacitor/preferences', 
            '@capacitor/geolocation', 
            '@capacitor/camera', 
            '@capacitor/filesystem',
            '@capacitor/app',
            '@capacitor/browser'
          ]
        }
      }
    }
  }
});