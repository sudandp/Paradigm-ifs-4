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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Paradigm Office',
        short_name: 'Paradigm',
        description: 'Paradigm Integrated Field Services Application',
        theme_color: '#006B3F',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/Paradigm-Logo-3-1024x157.png',
            sizes: '1024x157',
            type: 'image/png'
          },
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8MB standard limit
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,bin,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|bin|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'asset-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              }
            }
          }
        ]
      }
    }),
    {
      name: 'mssql-dev-middleware',
      configureServer(server: any) {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (!req.url || !req.url.startsWith('/api/mssql-')) {
            return next();
          }

          const urlObj = new URL(req.url, 'http://localhost');
          const path = urlObj.pathname;
          const search = urlObj.search;

          const candidateBases = [
            'http://localhost:4000',
            'http://127.0.0.1:4000',
            'https://attendance.paradigmfms.com',
            'https://cctv.paradigmfms.com',
            'https://tassel-estranged-prism.ngrok-free.dev',
            'http://192.168.51.112:4000',
          ];

          try {
            const sbRes = await fetch('https://fmyafuhxlorbafbacywa.supabase.co/rest/v1/cctv_devices?select=ngrok_url,device_secret&order=updated_at.desc&limit=1', {
              headers: {
                apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU',
                Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU'
              },
              signal: AbortSignal.timeout(1800),
            });
            if (sbRes.ok) {
              const data: any = await sbRes.json();
              if (Array.isArray(data) && data[0]) {
                const attLive = data[0].device_secret?.replace(/\/$/, '');
                const cctvLive = data[0].ngrok_url?.replace(/\/$/, '');
                if (attLive && attLive.startsWith('http') && !candidateBases.includes(attLive)) {
                  candidateBases.unshift(attLive);
                }
                if (cctvLive && cctvLive.startsWith('http') && !candidateBases.includes(cctvLive)) {
                  candidateBases.unshift(cctvLive);
                }
              }
            }
          } catch {}

          let subPath = '/attendance';
          if (path === '/api/mssql-devices') subPath = '/devices';
          if (path === '/api/mssql-update-employee') subPath = '/update-employee';

          for (const base of candidateBases) {
            const targetUrl = `${base}${subPath}${search}`;
            try {
              const fetchRes = await fetch(targetUrl, {
                method: req.method || 'GET',
                headers: {
                  'x-api-key': 'paradigm-attendance-secret-2024',
                  'x-api-secret': 'paradigm-attendance-secret-2024',
                  'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': '1',
                  'bypass-tunnel-reminder': 'true',
                  'Bypass-Tunnel-Reminder': '1',
                },
                signal: AbortSignal.timeout(6000),
              });
              if (fetchRes.ok) {
                const data = await fetchRes.text();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(data);
                return;
              }
            } catch {}
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            summary: { date: new Date().toISOString().slice(0, 10), totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
            employees: [],
            trend: [],
            departments: [],
            lastUpdated: new Date().toISOString(),
            connectionStatus: 'error',
            errorMessage: 'Database proxy unreachable on all candidate endpoints',
          }));
        });
      }
    }
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
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['@react-pdf/renderer', 'jspdf', 'jspdf-autotable'],
          'excel-vendor': ['exceljs', 'jszip'],
          'charts-vendor': ['chart.js'],
          'database-vendor': ['@supabase/supabase-js'],
          'animation-vendor': ['framer-motion'],
          'icons-vendor': ['lucide-react'],
          'date-vendor': ['date-fns', 'react-date-range'],
          'capacitor-core': ['@capacitor/core', '@capacitor/preferences', '@capacitor/app', '@capacitor/browser'],
          'capacitor-native': ['@capacitor/geolocation', '@capacitor/camera', '@capacitor/filesystem', '@capacitor/status-bar', '@capacitor/keyboard']
        }
      }
    }
  }
});