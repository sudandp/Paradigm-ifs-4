import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1']);
} catch {
  // Ignore DNS override errors in environments that restrict custom resolvers
}

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
            'https://attendance.cctv.rest',
            'http://localhost:4000',
            'http://127.0.0.1:4000',
            'http://localhost:3000',
            'https://attendance.paradigmfms.com',
          ];

          try {
            const sbRes = await fetch('https://fmyafuhxlorbafbacywa.supabase.co/rest/v1/cctv_devices?select=device_secret&order=updated_at.desc&limit=1', {
              headers: {
                apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU',
                Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU'
              },
              signal: AbortSignal.timeout(2000),
            });
            if (sbRes.ok) {
              const data: any = await sbRes.json();
              if (Array.isArray(data) && data[0]?.device_secret) {
                const attLive = data[0].device_secret.replace(/\/$/, '');
                if (attLive.startsWith('http')) {
                  const idx = candidateBases.indexOf(attLive);
                  if (idx !== -1) candidateBases.splice(idx, 1);
                  candidateBases.unshift(attLive);
                }
              }
            }
          } catch {
            // Ignore background endpoint lookup failure and fallback to candidateBases
          }

          let subPath = '/attendance';
          if (path === '/api/mssql-devices') subPath = '/devices';
          if (path === '/api/mssql-update-employee') subPath = '/update-employee';
          if (path === '/api/mssql-attendance-report') subPath = '/attendance-report';

          // ── Dedicated Multi-Day Attendance Report Handler ──
          if (path === '/api/mssql-attendance-report') {
            // 1. First attempt: Direct /attendance-report on candidate bases
            for (const base of candidateBases) {
              const targetUrl = `${base}/attendance-report${search}`;
              try {
                const fetchRes = await fetch(targetUrl, {
                  headers: {
                    'x-api-key': 'paradigm-attendance-secret-2024',
                    'x-api-secret': 'paradigm-attendance-secret-2024',
                    'Bypass-Tunnel-Reminder': '1',
                  },
                  signal: AbortSignal.timeout(10000),
                });
                if (fetchRes.ok) {
                  const data = await fetchRes.text();
                  try {
                    const parsed = JSON.parse(data);
                    const recCount = parsed?.records ? Object.keys(parsed.records).length : (parsed?.totalEmployees || 0);
                    if (recCount > 0) {
                      console.log(`[MSSQL Proxy] ✅ Attendance Report direct via ${targetUrl} (${recCount} employees)`);
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.setHeader('Access-Control-Allow-Origin', '*');
                      res.end(data);
                      return;
                    } else {
                      console.log(`[MSSQL Proxy] ℹ️ Direct endpoint returned 0 records for site (${targetUrl}), engaging live multi-date aggregator fallback...`);
                    }
                  } catch (_) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.end(data);
                    return;
                  }
                }
              } catch {
                // Direct endpoint fetch failure fallback
              }
            }

            // 2. Resilient Fallback: Multi-Date Aggregator via live /attendance?date= endpoint
            const startDate = urlObj.searchParams.get('startDate') || '2026-09-01';
            const endDate = urlObj.searchParams.get('endDate') || new Date().toISOString().slice(0, 10);
            const siteFilter = (urlObj.searchParams.get('site') || urlObj.searchParams.get('siteId') || 'all').toLowerCase().trim();

            const dates: string[] = [];
            const cur = new Date(startDate);
            const endD = new Date(endDate);
            while (cur <= endD) {
              dates.push(cur.toISOString().slice(0, 10));
              cur.setDate(cur.getDate() + 1);
            }

            const liveBase = candidateBases.find(b => !b.includes(':3000')) || 'https://attendance.cctv.rest';
            console.log(`[MSSQL Report Aggregator] Querying remote server across ${dates.length} days (${startDate} to ${endDate}) via ${liveBase}...`);

            const dayResults = await Promise.all(dates.map(async (d) => {
              try {
                const r = await fetch(`${liveBase}/attendance?date=${d}&siteId=all`, {
                  headers: {
                    'x-api-key': 'paradigm-attendance-secret-2024',
                    'x-api-secret': 'paradigm-attendance-secret-2024',
                    'Bypass-Tunnel-Reminder': '1',
                  },
                  signal: AbortSignal.timeout(12000),
                });
                if (r.ok) {
                  const j: any = await r.json();
                  return { date: d, employees: j.employees || [] };
                }
              } catch {
                // Ignore individual day fetch failure and fallback to empty
              }
              return { date: d, employees: [] };
            }));

            const records: Record<string, any> = {};
            dayResults.forEach(({ date, employees }) => {
              employees.forEach((emp: any) => {
                const code = String(emp.empCode || '').trim();
                const site = String(emp.department || '').trim();

                if (siteFilter && siteFilter !== 'all') {
                  const cSite = site.toLowerCase();
                  const matchesSite = cSite.includes(siteFilter) || siteFilter.includes(cSite);
                  const matchesUtopiaPrefix = siteFilter.includes('utopia') && (code.startsWith('31') || code.startsWith('32'));
                  if (!matchesSite && !matchesUtopiaPrefix) {
                    return;
                  }
                }

                if (!records[code]) {
                  records[code] = {
                    empCode: code,
                    empName: emp.empName,
                    department: site,
                    designation: emp.designation,
                    days: {},
                    summary: { presentDays: 0, absentDays: 0, woDays: 0, lateDays: 0, totalNetMins: 0, totalOtMins: 0 },
                  };
                }

                const isPres = emp.status === 'Present' || (emp.inTime && emp.inTime !== '—');
                const isLate = emp.status === 'Late' || (emp.lateMinutes && emp.lateMinutes > 0);

                let statusStr = 'A';
                if (isPres) statusStr = 'P';
                else if (isLate) statusStr = 'L';

                if (isPres || isLate) {
                  records[code].summary.presentDays++;
                  if (isLate) records[code].summary.lateDays++;
                } else {
                  records[code].summary.absentDays++;
                }

                records[code].days[date] = {
                  dateStr: date,
                  inTime: emp.inTime || '—',
                  outTime: emp.outTime || '—',
                  hours: emp.workingHours && emp.workingHours !== '—' ? emp.workingHours : (isPres ? '9h 00m' : '—'),
                  status: statusStr,
                  isWeeklyOff: false,
                  lateMinutes: emp.lateMinutes || 0,
                };
              });
            });

            const empList = Object.values(records);
            console.log(`[MSSQL Report Aggregator] ✅ Aggregated ${empList.length} employees across ${dates.length} days`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              success: true,
              startDate,
              endDate,
              site: siteFilter,
              totalEmployees: empList.length,
              records,
              employees: empList,
              lastUpdated: new Date().toISOString(),
            }));
            return;
          }

          const attemptLogs: string[] = [];

          for (const base of candidateBases) {
            const isLocalServer = base.includes(':3000');
            const targetUrl = isLocalServer ? `${base}${path}${search}` : `${base}${subPath}${search}`;
            try {
              const fetchRes = await fetch(targetUrl, {
                method: req.method || 'GET',
                headers: {
                  'x-api-key': 'paradigm-attendance-secret-2024',
                  'x-api-secret': 'paradigm-attendance-secret-2024',
                  'Content-Type': 'application/json',
                  'Connection': 'close',
                  'bypass-tunnel-reminder': 'true',
                  'Bypass-Tunnel-Reminder': '1',
                  ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
                },
                signal: AbortSignal.timeout(8000),
              });
              if (fetchRes.ok) {
                const data = await fetchRes.text();
                console.log(`[MSSQL Proxy] ✅ Success via ${targetUrl}`);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(data);
                return;
              } else {
                const statusNote = `HTTP ${fetchRes.status}`;
                attemptLogs.push(`${base} (${statusNote})`);
                console.warn(`[MSSQL Proxy] ⚠️ Failed ${targetUrl} -> ${statusNote}`);
              }
            } catch (fetchErr: any) {
              const errNote = fetchErr?.name === 'TimeoutError' ? 'Timeout' : (fetchErr?.message || 'Error');
              attemptLogs.push(`${base} (${errNote})`);
              console.warn(`[MSSQL Proxy] ❌ Error ${targetUrl} -> ${errNote}`);
            }
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
            errorMessage: `Database proxy unreachable. Attempts: ${attemptLogs.join(', ')}`,
            attemptLogs,
          }));
        });
      }
    }
  ],



  define: {
    'global': 'window',
  },
  optimizeDeps: {
    include: [
      '@react-pdf/renderer',
      '@react-pdf/pdfkit',
      'pako',
      'buffer',
    ],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
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
    proxy: {
      // Forward all /api/* requests from Vite (5173) → Express server (3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Digio e-Sign Proxy (Bypasses browser CORS during development)
      '/api-digio': {
        target: process.env.VITE_ESIGN_DIGIO_ENV === 'production' ? 'https://api.digio.in' : 'https://ext.digio.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-digio/, ''),
        secure: true,
      },
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