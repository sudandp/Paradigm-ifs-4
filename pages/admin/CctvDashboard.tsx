import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye, UserPlus, UserCheck,
  Maximize2, Minimize2, Video, Download, Shield, Cpu, Clock, Search
} from 'lucide-react';

// Fallback URL used ONLY when Supabase has no ngrok_url yet (first boot before heartbeat).
const NGROK_PROXY_FALLBACK = 'https://guide-accuracy-literature-fifteen.trycloudflare.com';

interface CctvLog {
  id: string;
  userId: string | null;
  userName: string | null;
  cameraName: string;
  direction: 'entry' | 'exit';
  confidence: number;
  detectedAt: string;
  snapshotUrl: string | null;
  edgeDeviceId: string;
}

interface EnrollmentItem {
  id: string;
  cameraName: string;
  detectedAt: string;
  snapshotUrl: string | null;
  status: string;
  edgeDeviceId: string;
}

interface UserOption {
  id: string;
  name: string;
  biometricId: string | null;
}

// ── Canvas-based MJPEG Stream Reader (Hikvision/CP Plus web client technique) ──
// fetch() opens ONE persistent connection with ngrok headers.
// response.body.getReader() reads binary stream chunks continuously.
// Scans for JPEG start (FFD8) / end (FFD9) markers to extract complete frames.
// Draws each frame to <canvas> — zero polling, zero separate HTTP requests.
const NvrCameraStream: React.FC<{
  camName: string;
  proxyUrl: string;
}> = ({ camName, proxyUrl }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [statusMsg, setStatusMsg] = useState('CONNECTING LIVE STREAM...');
  const [currentTime, setCurrentTime] = useState('');
  const [fps, setFps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsCanvasRef = useRef<HTMLCanvasElement>(null);
  const fpsCounterRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<any>(null);
  // Butter-smooth rendering
  const latestBitmapRef = useRef<ImageBitmap | null>(null);
  const pendingDecodeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // OSD clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => v.toString().padStart(2, '0');
      setCurrentTime(`${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // FPS counter
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsTimeRef.current) / 1000;
      if (elapsed > 0) {
        setFps(Math.round(fpsCounterRef.current / elapsed));
        fpsCounterRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);


  // RAF render loop — 60fps, always draws the LATEST decoded frame, decoupled from network
  useEffect(() => {
    const loop = () => {
      const bmp = latestBitmapRef.current;
      if (bmp) {
        [canvasRef.current, fsCanvasRef.current].forEach(canvas => {
          if (!canvas) return;
          if (canvas.width !== bmp.width) canvas.width = bmp.width;
          if (canvas.height !== bmp.height) canvas.height = bmp.height;
          const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bmp, 0, 0);
          }
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // createImageBitmap: hardware-accelerated, off-main-thread JPEG decode
  const paintFrame = useCallback(async (jpegBytes: Uint8Array) => {
    if (pendingDecodeRef.current >= 4) return;
    pendingDecodeRef.current++;
    try {
      const blob = new Blob([jpegBytes as any], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob, {
        resizeQuality: 'high',
      });
      const oldBmp = latestBitmapRef.current;
      latestBitmapRef.current = bitmap;
      oldBmp?.close();
      fpsCounterRef.current++;
      if (!isConnected) setIsConnected(true);
      if (hasError) setHasError(false);
    } catch { /* skip corrupted frame */ }
    pendingDecodeRef.current--;
  }, [isConnected, hasError]);


  // Core MJPEG reader — opens stream, reads binary, finds JPEG boundaries
  const startStream = useCallback(async () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    setHasError(false);
    setStatusMsg('CONNECTING LIVE STREAM...');

    try {
      const res = await fetch(
        `${proxyUrl}/camera/stream/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=1&bypass-tunnel-reminder=true`,
        {
          signal: controller.signal,
          headers: {
            'ngrok-skip-browser-warning': '1',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
            'Accept': 'multipart/x-mixed-replace, image/jpeg, */*',
          },
        }
      );

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      let buf: any = new Uint8Array(0);
      const MAX_BUF = 2 * 1024 * 1024; // 2MB safety cap

      const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
        const c = new Uint8Array(a.length + b.length);
        c.set(a); c.set(b, a.length);
        return c;
      };

      const findSeq = (haystack: Uint8Array, b0: number, b1: number, from = 0): number => {
        for (let i = from; i < haystack.length - 1; i++) {
          if (haystack[i] === b0 && haystack[i + 1] === b1) return i;
        }
        return -1;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done || controller.signal.aborted) break;
        if (!value?.length) continue;

        buf = concat(buf, value);

        // Extract all complete JPEG frames from buffer
        let offset = 0;
        while (true) {
          const start = findSeq(buf, 0xFF, 0xD8, offset);
          if (start === -1) break;
          const end = findSeq(buf, 0xFF, 0xD9, start + 2);
          if (end === -1) break;
          const frameEnd = end + 2;
          if (frameEnd - start > 500) { // skip garbage tiny blobs
            paintFrame(buf.slice(start, frameEnd) as any);
          }
          offset = frameEnd;
        }

        // Trim processed bytes; cap buffer to prevent memory growth
        buf = offset > 0 ? buf.slice(offset) : buf;
        if (buf.length > MAX_BUF) buf = new Uint8Array(0);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setHasError(true);
      setIsConnected(false);
      setStatusMsg('STREAM RECONNECTING...');
      // Auto-retry every 4 seconds
      retryTimerRef.current = setTimeout(() => startStream(), 4000);
    }
  }, [camName, proxyUrl]);

  useEffect(() => {
    startStream();
    return () => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [startStream]);

  const handleDownloadSnapshot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Grab current canvas frame as PNG
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CCTV_${camName}_${Date.now()}.jpg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/jpeg', 0.92);
      }
    } catch {}
  };

  return (
    <>
      <div
        onClick={() => setIsFullscreen(true)}
        className="w-full h-full relative group bg-black overflow-hidden select-none cursor-pointer rounded-2xl border border-border shadow-md"
      >
        {/* Status overlays */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2 p-6 z-10">
            <Video className={`h-8 w-8 ${hasError ? 'text-amber-400' : 'text-emerald-400'} animate-pulse`} />
            <span className={`text-xs font-mono tracking-wider font-semibold ${hasError ? 'text-amber-300' : 'text-emerald-300'}`}>
              {statusMsg}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{camName} • RTSP TCP</span>
            {hasError && (
              <button
                onClick={(e) => { e.stopPropagation(); startStream(); }}
                className="mt-2 px-3 py-1 text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white rounded font-mono"
              >
                RETRY NOW
              </button>
            )}
          </div>
        )}

        {/* Canvas — MJPEG frames painted here */}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover block"
          style={{
            display: isConnected ? 'block' : 'none',
            filter: 'contrast(1.05) brightness(1.02) saturate(1.04)',
            imageRendering: 'auto',
          }}
        />

        {/* OSD Header */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none font-mono z-20">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600/90 text-[10px] font-bold text-white uppercase tracking-widest shadow-sm">
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${isConnected ? 'animate-ping' : ''}`} /> REC
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider drop-shadow-md bg-black/50 px-2 py-0.5 rounded">
              CAM-01 • {camName.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="text-[11px] font-bold text-white bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs">
            {currentTime}
          </span>
        </div>

        {/* OSD Bottom Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI ACTIVE
            </span>
            <span className="text-[10px] text-slate-300 font-mono bg-black/60 px-2 py-0.5 rounded">
              MJPEG CANVAS • {fps > 0 ? `${fps} FPS` : '---'}
            </span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleDownloadSnapshot} className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg border border-white/20" title="Download Snapshot">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }} className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg border border-white/20" title="Fullscreen">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen NVR Monitor */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setIsFullscreen(false)}>
          <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-b border-white/10 flex-shrink-0 font-mono" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 px-3 py-1 rounded bg-red-600 text-xs font-bold uppercase tracking-widest text-white">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" /> LIVE
              </span>
              <span className="text-emerald-400 font-bold tracking-wider text-sm">
                {camName.toUpperCase().replace(/_/g, ' ')} — MAIN ENTRANCE GATE
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">MJPEG CANVAS</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white font-bold">{currentTime}</span>
              <span className="text-xs text-emerald-300 font-mono">{fps > 0 ? `${fps} FPS` : '---'}</span>
              <button onClick={() => setIsFullscreen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl">
                <Minimize2 className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
            <canvas
              ref={fsCanvasRef}
              className="max-h-full max-w-full object-contain"
              style={{
                filter: 'contrast(1.05) brightness(1.02) saturate(1.04)',
                imageRendering: 'auto',
              }}
            />
            <div className="absolute top-4 left-4 text-emerald-400 text-xs font-mono bg-black/70 px-3 py-2 rounded-xl border border-emerald-500/20 pointer-events-none flex items-center gap-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              AI FACE RECOGNITION ACTIVE • INSIGHTFACE 512D
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-t border-white/10 text-xs text-slate-400 font-mono flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span>Paradigm IFS • Real-Time CCTV AI Attendance • RTSP TCP</span>
            <div className="flex gap-3">
              <button onClick={handleDownloadSnapshot} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" /> Save Snapshot
              </button>
              <button onClick={() => setIsFullscreen(false)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2">
                <Minimize2 className="h-4 w-4" /> Exit Monitor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


const CctvDashboard: React.FC = () => {

  const { user } = useAuthStore();
  // Resolved live ngrok proxy URL — fetched from Supabase on mount
  const [ngrokProxy, setNgrokProxy] = useState(NGROK_PROXY_FALLBACK);
  const [logs, setLogs] = useState<CctvLog[]>([]);
  const [unknownQueue, setUnknownQueue] = useState<EnrollmentItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'unknown' | 'history'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Enroll modal state
  const [selectedUnknown, setSelectedUnknown] = useState<EnrollmentItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'select' | 'sending' | 'done'>('select');

  // Lightbox zoom modal state
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string; subtitle: string; item?: EnrollmentItem } | null>(null);

  const stats = {
    entries: logs.filter(l => (l.direction || '').toLowerCase() === 'entry' && l.userId).length,
    exits: logs.filter(l => (l.direction || '').toLowerCase() === 'exit' && l.userId).length,
    unknown: unknownQueue.length + logs.filter(l => !l.userId).length,
    totalToday: logs.length,
  };

  const exportToCsv = () => {
    if (logs.length === 0) {
      setToast({ message: 'No logs available to export.', type: 'error' });
      return;
    }
    const headers = ['ID', 'Employee Name', 'Direction', 'Camera Channel', 'Confidence (%)', 'Timestamp', 'Device ID'];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${l.userName || 'Unknown Person'}"`,
      `"${l.direction.toUpperCase()}"`,
      `"${l.cameraName}"`,
      `"${(l.confidence * 100).toFixed(1)}"`,
      `"${new Date(l.detectedAt).toLocaleString()}"`,
      `"${l.edgeDeviceId || 'edge-server-main'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cctv_attendance_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Exported ${logs.length} attendance logs to CSV`, type: 'success' });
  };


  const fetchLogs = useCallback(async () => {
    try {
      // 1. Fetch from Supabase (Cloud)
      const [
        { data: logsData, error: logsError },
        { data: unknownData, error: unknownError },
        { data: usersData }
      ] = await Promise.all([
        supabase
          .from('cctv_attendance_logs')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(100),
        supabase
          .from('cctv_enrollment_queue')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(50),
        supabase
          .from('users')
          .select('id, name, biometric_id')
          .order('name', { ascending: true })
          .limit(200),
      ]);

      if (logsError) console.warn('[CCTV] Supabase logs error:', logsError);
      if (unknownError) console.warn('[CCTV] Supabase queue error:', unknownError);

      let mergedLogs: CctvLog[] = (logsData || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: l.user_name || (l.user_id ? 'Employee' : 'Unknown Person'),
        cameraName: l.camera_name,
        direction: l.direction || 'entry',
        confidence: l.confidence || 0.85,
        detectedAt: l.detected_at,
        snapshotUrl: l.snapshot_url,
        edgeDeviceId: l.edge_device_id,
      }));

      let mergedUnknown: EnrollmentItem[] = (unknownData || [])
        .filter((u: any) => u.status === 'pending' || !u.status)
        .map((u: any) => ({
          id: u.id,
          cameraName: u.camera_name,
          detectedAt: u.detected_at,
          snapshotUrl: u.snapshot_url,
          status: u.status || 'pending',
          edgeDeviceId: u.edge_device_id,
        }));

      // Deduplicate unknown queue: group same-camera detections within a 90s window.
      // When the Python cooldown was not active (old records), multiple rows for the
      // same person can exist — collapse them to the most recent one per group.
      const UNKNOWN_DEDUP_WINDOW_MS = 90_000;
      const deduped: EnrollmentItem[] = [];
      const seenWindows: { cam: string; ts: number }[] = [];
      // Sort most recent first so the latest snapshot is shown
      mergedUnknown.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
      for (const item of mergedUnknown) {
        const itemTs = new Date(item.detectedAt).getTime();
        const isDupe = seenWindows.some(
          w => w.cam === item.cameraName && Math.abs(w.ts - itemTs) < UNKNOWN_DEDUP_WINDOW_MS
        );
        if (!isDupe) {
          deduped.push(item);
          seenWindows.push({ cam: item.cameraName, ts: itemTs });
        }
      }
      mergedUnknown = deduped;

      setUnknownQueue(mergedUnknown);

      // 2. Also fetch from Edge Server local DB (if online) for instant local zero-delay sync
      try {
        const edgeRes = await fetch(`${ngrokProxy}/logs/today?ngrok-skip-browser-warning=1`, {
          headers: { 'ngrok-skip-browser-warning': '1' },
          signal: AbortSignal.timeout(3000),
        });
        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (Array.isArray(edgeData?.logs)) {
            const edgeLogs = edgeData.logs.map((el: any) => ({
              id: `edge-${el.id || el.timestamp}`,
              userId: el.user_id,
              userName: el.user_name || (el.user_id ? 'Employee' : 'Unknown Person'),
              cameraName: el.camera_name,
              direction: el.direction || 'entry',
              confidence: el.confidence || 0.85,
              detectedAt: el.timestamp ? new Date(el.timestamp * 1000).toISOString() : new Date().toISOString(),
              snapshotUrl: el.snapshot_path ? `${ngrokProxy}/camera/snapshot/${encodeURIComponent(el.camera_name)}` : undefined,
              edgeDeviceId: 'edge-server-main',
            }));

            // Merge avoiding duplicates by timestamp / name proximity
            const existingTimes = new Set(mergedLogs.map(l => l.detectedAt.slice(0, 19)));
            for (const el of edgeLogs) {
              if (!existingTimes.has(el.detectedAt.slice(0, 19))) {
                mergedLogs.push(el);
              }
            }
            mergedLogs.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
          }
        }
      } catch {
        // Edge direct fetch offline/skipped — Supabase data is used
      }


      setLogs(mergedLogs);
      // Note: setUnknownQueue(mergedUnknown) is called above after deduplication step


      if (usersData) {
        setUserOptions(usersData.map((u: any) => ({
          id: u.id,
          name: u.name || 'Unnamed Employee',
          biometricId: u.biometric_id || null,
        })));
      }
    } catch (err: any) {
      console.error('[CCTV] Fetch logs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch the live ngrok_url from cctv_devices once on mount
  useEffect(() => {
    const loadProxyUrl = async () => {
      try {
        const { data } = await supabase
          .from('cctv_devices')
          .select('ngrok_url')
          .not('ngrok_url', 'is', null)
          .order('last_seen', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.ngrok_url) {
          setNgrokProxy(data.ngrok_url.replace(/\/$/, ''));
        }
      } catch {
        // Supabase unavailable — keep fallback
      }
    };
    loadProxyUrl();
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchLogs();
    const pollId = setInterval(fetchLogs, 4000);

    const channel = supabase
      .channel('cctv-live-dash')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_attendance_logs' }, payload => {
        const l = payload.new as any;
        setLogs(prev => [{
          id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          cameraName: l.camera_name,
          direction: l.direction,
          confidence: l.confidence,
          detectedAt: l.detected_at,
          snapshotUrl: l.snapshot_url,
          edgeDeviceId: l.edge_device_id,
        }, ...prev.filter(x => x.id !== l.id)].slice(0, 100));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_enrollment_queue' }, payload => {
        const u = payload.new as any;
        const newItem: EnrollmentItem = {
          id: u.id,
          cameraName: u.camera_name,
          detectedAt: u.detected_at,
          snapshotUrl: u.snapshot_url,
          status: 'pending',
          edgeDeviceId: u.edge_device_id,
        };
        setUnknownQueue(prev => {
          const newTs = new Date(newItem.detectedAt).getTime();
          const isTooClose = prev.some(
            x => x.cameraName === newItem.cameraName &&
                 Math.abs(new Date(x.detectedAt).getTime() - newTs) < 90_000
          );
          if (isTooClose) return prev;
          return [newItem, ...prev.filter(x => x.id !== u.id)];
        });
      })
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const handleDismiss = async (id: string) => {
    await supabase
      .from('cctv_enrollment_queue')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq('id', id);
    setUnknownQueue(prev => prev.filter(u => u.id !== id));
    setToast({ message: 'Unknown face dismissed', type: 'success' });
  };

  const handleAssignFace = async () => {
    if (!selectedUnknown || !selectedUserId) {
      setToast({ message: 'Please select an employee to assign.', type: 'error' });
      return;
    }

    setIsAssigning(true);
    setEnrollStep('sending');
    const selectedUserObj = userOptions.find(u => u.id === selectedUserId);

    try {
      const { error } = await supabase
        .from('cctv_enrollment_queue')
        .update({
          status: 'enrolled',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', selectedUnknown.id);
      if (error) throw error;

      if (selectedUnknown.snapshotUrl) {
        try {
          const imgResponse = await fetch(selectedUnknown.snapshotUrl);
          const imgBlob = await imgResponse.blob();

          const formData = new FormData();
          formData.append('user_id', selectedUserId);
          formData.append('user_name', selectedUserObj?.name || 'Employee');
          formData.append('biometric_id', selectedUserObj?.biometricId || '');
          formData.append('department', 'CCTV_ENROLLED');
          formData.append('organization_id', user?.organizationId || '');
          formData.append('photo', new File([imgBlob], 'face.jpg', { type: 'image/jpeg' }));

          await fetch(`${ngrokProxy}/camera/enroll`, {
            method: 'POST',
            headers: { 'ngrok-skip-browser-warning': '1', 'x-api-key': 'paradigm-attendance-secret-2024' },
            body: formData,
            signal: AbortSignal.timeout(15000),
          });
        } catch (edgeErr) {
          console.warn('[CCTV Enroll] Edge enrollment warning:', edgeErr);
        }
      }

      setEnrollStep('done');
      setUnknownQueue(prev => prev.filter(u => u.id !== selectedUnknown.id));
      setToast({
        message: `Success! ${selectedUserObj?.name || 'Employee'} assigned and face embedding synced!`,
        type: 'success',
      });
      setSelectedUnknown(null);
      setSelectedUserId('');
      setEnrollStep('select');
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign face.', type: 'error' });
      setEnrollStep('select');
    } finally {
      setIsAssigning(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const filteredLogs = logs.filter(
    l =>
      searchTerm === '' ||
      l.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cameraName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingScreen message="Loading CCTV surveillance telemetry..." />;

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── Page Header ── */}
      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <AdminPageHeader title="CCTV Live Surveillance & Attendance" />
            <p className="text-muted -mt-4 mb-2">
              Real-time video monitor with automated InsightFace biometric punch logging.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchLogs} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh Logs
            </Button>
            <a
              href="#/admin/cctv-devices"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Camera className="h-4 w-4" /> Manage CCTV Devices
            </a>
          </div>
        </div>
      </div>

      {/* ── Metrics Summary Strip (Green & White Theme) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
            <ArrowRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Today's Entries</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.entries}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600">
            <ArrowLeft className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Today's Exits</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.exits}</h4>
          </div>
        </div>

        <div className={`bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4 ${stats.unknown > 0 ? 'border-amber-300' : 'border-border'}`}>
          <div className={`p-3 rounded-lg ${stats.unknown > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Unknown Faces</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.unknown}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Face Punches</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.totalToday}</h4>
          </div>
        </div>
      </div>

      {/* ── CENTRAL NVR SURVEILLANCE & REALTIME PUNCH STATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
        {/* Left Column: Live NVR Camera Window (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold text-primary-text text-sm uppercase tracking-wider">
                  Live CCTV Surveillance Stream
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                RTSP TCP • MAIN GATE
              </span>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden shadow-inner">
              <NvrCameraStream camName="main_gate_entry" proxyUrl={ngrokProxy} />
            </div>

            <div className="flex items-center justify-between text-xs text-muted mt-3 px-1 pt-2 border-t border-border/70">
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-emerald-600" /> InsightFace 512D AI Engine: Active
              </span>
              <span className="font-mono text-emerald-700 font-semibold">
                MSSQL eTimeTrackLite Sync: ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Attendance Ticker (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-card rounded-2xl border border-border shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-emerald-950 text-sm">Real-Time Face Detections</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {logs.length} Today
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-border/60">
              {logs.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center p-6">
                  <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                    <Camera className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-primary-text">Waiting for Gate Activity...</p>
                  <p className="text-xs text-muted mt-1">Camera is scanning for faces in real-time.</p>
                </div>
              ) : (
                logs.slice(0, 15).map(log => (
                  <div key={log.id} className="p-3.5 hover:bg-emerald-50/30 transition-colors flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 border ${
                      log.userId 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-primary-text truncate">
                          {log.userName || 'Unknown Person'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                          log.direction === 'entry'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.direction === 'entry' ? 'IN' : 'OUT'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-muted" /> {formatTime(log.detectedAt)} • {log.cameraName}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS SECTION: All Logs vs Unknown Faces Review ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-xl w-fit mb-6 border border-border/80 shadow-2xs">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'live'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <Activity className="h-4 w-4" /> All Gate Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('unknown')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'unknown'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <AlertTriangle className="h-4 w-4" /> Unknown Faces Review ({unknownQueue.length})
        </button>
      </div>

      {/* Tab 1: All Logs Table */}
      {activeTab === 'live' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search logs by employee or camera..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted font-medium">Showing {filteredLogs.length} events today</span>
              <Button
                variant="outline"
                onClick={exportToCsv}
                className="text-xs h-8 px-3 border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-emerald-50/60 border-b border-emerald-100 text-emerald-950 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Camera Channel</th>
                  <th className="py-3.5 px-4">AI Confidence</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted font-medium">
                      No attendance events found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-primary-text flex items-center gap-2">
                        {log.snapshotUrl && (
                          <img
                            src={log.snapshotUrl}
                            alt=""
                            className="h-7 w-7 rounded-lg object-cover border border-border cursor-pointer hover:scale-110 transition-transform"
                            style={{ filter: 'contrast(1.05) brightness(1.02)' }}
                            onClick={() => setZoomPhoto({
                              url: log.snapshotUrl!,
                              title: log.userName || 'Unknown Person',
                              subtitle: `${log.direction.toUpperCase()} • ${log.cameraName} • ${formatTime(log.detectedAt)}`
                            })}
                          />
                        )}
                        <span>{log.userName || <span className="text-muted italic">Unknown Person</span>}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          log.direction === 'entry'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {log.direction === 'entry' ? '→ Punch-IN' : '← Punch-OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted font-mono">{log.cameraName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {(log.confidence * 100).toFixed(0)}% Match
                      </td>
                      <td className="py-3 px-4 text-muted">{formatTime(log.detectedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Unknown Faces Review Queue */}
      {activeTab === 'unknown' && (
        <div className="space-y-4">
          {unknownQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center bg-card rounded-2xl border border-dashed border-border shadow-sm">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="font-bold text-primary-text text-base">All Clear!</h3>
              <p className="text-xs text-muted mt-1">No unknown faces pending assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unknownQueue.map(item => {
                const imgSource = item.snapshotUrl || `${ngrokProxy}/camera/snapshot/${encodeURIComponent(item.cameraName)}?ngrok-skip-browser-warning=1`;
                return (
                  <div key={item.id} className="bg-card rounded-2xl border border-amber-200/90 p-4 shadow-sm space-y-3 hover:border-amber-400 transition-colors">
                    <div
                      className="aspect-square bg-neutral-950 rounded-xl overflow-hidden border border-border relative flex items-center justify-center cursor-pointer group"
                      onClick={() => setZoomPhoto({
                        url: imgSource,
                        title: `Unknown Face • ${item.cameraName}`,
                        subtitle: `Detected at ${formatTime(item.detectedAt)}`,
                        item: item,
                      })}
                    >
                      <img
                        src={imgSource}
                        alt="Unknown face detection"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        style={{ filter: 'contrast(1.06) brightness(1.02) saturate(1.05)' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = `${ngrokProxy}/camera/snapshot/${encodeURIComponent(item.cameraName)}?ngrok-skip-browser-warning=1`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="bg-black/70 text-white text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" /> Click to Enlarge
                        </span>
                      </div>
                      <div className="face-fallback-icon hidden w-full h-full items-center justify-center text-muted">
                        <Eye className="h-8 w-8 text-amber-500" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {item.cameraName}
                      </span>
                      <span className="text-muted">{formatTime(item.detectedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button
                        onClick={() => { setSelectedUnknown(item); setSelectedUserId(''); }}
                        className="flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign Face
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDismiss(item.id)}
                        className="text-xs h-9 text-muted hover:text-red-500"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Zoom Photo Modal */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="bg-neutral-900 border border-white/20 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white border-b border-white/10 pb-3">
              <div>
                <h4 className="font-bold text-sm text-emerald-400">{zoomPhoto.title}</h4>
                <p className="text-xs text-neutral-400">{zoomPhoto.subtitle}</p>
              </div>
              <button
                onClick={() => setZoomPhoto(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="aspect-square bg-black rounded-xl overflow-hidden flex items-center justify-center">
              <img
                src={zoomPhoto.url}
                alt="High-res portrait"
                className="max-h-full max-w-full object-contain"
                style={{ filter: 'contrast(1.05) brightness(1.02)' }}
              />
            </div>
            {zoomPhoto.item && (
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  onClick={() => {
                    const it = zoomPhoto.item!;
                    setZoomPhoto(null);
                    setSelectedUnknown(it);
                    setSelectedUserId('');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" /> Assign This Face to Employee
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Face Modal */}
      <Modal
        isOpen={!!selectedUnknown}
        onClose={() => setSelectedUnknown(null)}

        onConfirm={handleAssignFace}
        title="Assign Face to Employee Profile"
        confirmButtonText={isAssigning ? 'Syncing...' : 'Confirm & Sync Face Vector'}
        confirmButtonVariant="primary"
        isLoading={isAssigning}
      >
        <div className="space-y-4 py-2">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            Select the employee who matches this face photo. The edge server will extract their 512D biometric vector for future automated attendance punches.
          </div>
          <div>
            <label className="block text-xs font-bold text-primary-text mb-2 uppercase">Select Employee *</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose employee --</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.biometricId ? `(Code: ${u.biometricId})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CctvDashboard;
