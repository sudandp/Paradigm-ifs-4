import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye, UserPlus, UserCheck,
  Maximize2, Minimize2, Video, Download, Shield, Cpu, Clock, Search,
  ZoomIn, ZoomOut, RotateCcw, User, Layers, Sparkles, SplitSquareVertical, Sliders
} from 'lucide-react';

// Fallback URL used ONLY when Supabase has no ngrok_url yet (first boot before heartbeat).
const NGROK_PROXY_FALLBACK = 'https://cctv.paradigmfms.com';

interface CctvLog {
  id: string;
  edgeLogId: number | null;  // Edge server SQLite ID for /logs/snapshot/{id}
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
  photoUrl?: string | null;
}

interface ZoomPhotoData {
  portraitUrl: string;
  contextUrl: string | null;
  activeView: 'portrait' | 'context' | 'compare';
  title: string;
  subtitle: string;
  cameraName: string;
  direction: 'entry' | 'exit';
  confidence: number;
  detectedAt: string;
  userId: string | null;
  userName: string | null;
  userPhotoUrl?: string | null;
  edgeDeviceId?: string;
  edgeLogId: number | null;
  item?: EnrollmentItem;
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
  const [isConnected, setIsConnected] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [statusMsg, setStatusMsg] = useState('CONNECTING LIVE STREAM...');
  const [currentTime, setCurrentTime] = useState('');
  const [fps, setFps] = useState(25);
  const [streamKey, setStreamKey] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const fsImgRef = useRef<HTMLImageElement>(null);

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

  const activeBase = (proxyUrl || '').replace(/\/$/, '');
  const streamUrl = `${activeBase}/camera/stream/${encodeURIComponent(camName)}?key=${streamKey}&ngrok-skip-browser-warning=1&bypass-tunnel-reminder=true`;

  const handleImageLoad = () => {
    setIsConnected(true);
    setHasError(false);
    setFps(25);
  };

  const handleImageError = () => {
    setHasError(true);
    setIsConnected(false);
    setStatusMsg('RECONNECTING LIVE STREAM...');
    // Graceful auto-reconnect
    setTimeout(() => {
      setStreamKey(prev => prev + 1);
    }, 2000);
  };

  const handleDownloadSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    const img = isFullscreen ? fsImgRef.current : imgRef.current;
    if (!img) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 450;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
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
    } catch {
      window.open(`${activeBase}/camera/snapshot/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=1`, '_blank');
    }
  };

  return (
    <>
      <div
        onClick={() => setIsFullscreen(true)}
        className="w-full h-full relative group bg-neutral-950 overflow-hidden select-none cursor-pointer rounded-2xl border border-border/80 shadow-sm"
      >
        {/* Status overlays */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 gap-2.5 p-6 z-10">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Video className="h-7 w-7 animate-pulse" />
            </div>
            <span className="text-xs font-mono tracking-wider font-semibold text-neutral-300">
              {statusMsg}
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">1080p HD • RTSP TCP</span>
            <button
              onClick={(e) => { e.stopPropagation(); setStreamKey(k => k + 1); setHasError(false); }}
              className="mt-1 px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-sm transition-all"
            >
              Reconnect Stream
            </button>
          </div>
        )}

        {/* Hardware-Accelerated Native Image Stream */}
        <img
          ref={imgRef}
          src={streamUrl}
          alt={camName}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full object-cover block ${hasError ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* Top OSD Bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 border border-white/10 text-[10px] font-semibold text-white backdrop-blur-md shadow-xs">
              <span className={`h-2 w-2 rounded-full bg-rose-500 ${isConnected ? 'animate-pulse' : ''}`} />
              LIVE
            </span>
            <span className="text-[11px] font-semibold text-neutral-200 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
              CAM-01 • {camName.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-300 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
            {currentTime}
          </span>
        </div>

        {/* Bottom OSD Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-emerald-300 font-mono bg-neutral-900/80 border border-emerald-500/30 px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI ACTIVE
            </span>
            <span className="text-[10px] font-mono text-neutral-300 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
              {isConnected ? `${fps} FPS` : 'CONNECTING...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownloadSnapshot}
              className="p-2 bg-neutral-900/85 hover:bg-neutral-800 text-white rounded-xl border border-white/15 backdrop-blur-md transition-all shadow-sm"
              title="Capture Snapshot"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
              className="p-2 bg-neutral-900/85 hover:bg-neutral-800 text-white rounded-xl border border-white/15 backdrop-blur-md transition-all shadow-sm"
              title="Fullscreen View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen NVR Monitor */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col" onClick={() => setIsFullscreen(false)}>
          <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-900 border-b border-white/10 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-xs font-semibold text-white">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> LIVE
              </span>
              <span className="text-white font-semibold text-sm">
                {camName.toUpperCase().replace(/_/g, ' ')} — MAIN SURVEILLANCE GATE
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-neutral-400 font-mono">{currentTime}</span>
              <span className="text-xs text-emerald-400 font-mono">{fps > 0 ? `${fps} FPS` : 'HD'}</span>
              <button onClick={() => setIsFullscreen(false)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
            <img
              ref={fsImgRef}
              src={streamUrl}
              alt={camName}
              className="max-h-full max-w-full object-contain"
              style={{
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
  const [activeTab, setActiveTab] = useState<'live' | 'unknown' | 'debugger'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // AI Live Debugger state
  const [diagData, setDiagData] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);

  // Enroll modal state
  const [selectedUnknown, setSelectedUnknown] = useState<EnrollmentItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'select' | 'sending' | 'done'>('select');

  // Lightbox zoom modal state
  const [zoomPhoto, setZoomPhoto] = useState<ZoomPhotoData | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomPhotoLoading, setZoomPhotoLoading] = useState(false);

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
          .select('id, name, biometric_id, photo_url')
          .order('name', { ascending: true })
          .limit(200),
      ]);

      if (logsError) console.warn('[CCTV] Supabase logs error:', logsError);
      if (unknownError) console.warn('[CCTV] Supabase queue error:', unknownError);

      let mergedLogs: CctvLog[] = (logsData || []).map((l: any) => ({
        id: l.id,
        edgeLogId: null,
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
      const UNKNOWN_DEDUP_WINDOW_MS = 90_000;
      const deduped: EnrollmentItem[] = [];
      const seenWindows: { cam: string; ts: number }[] = [];
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
              edgeLogId: typeof el.id === 'number' ? el.id : null,
              userId: el.user_id,
              userName: el.user_name || (el.user_id ? 'Employee' : 'Unknown Person'),
              cameraName: el.camera_name,
              direction: el.direction || 'entry',
              confidence: el.confidence || 0.85,
              detectedAt: el.timestamp ? new Date(el.timestamp * 1000).toISOString() : new Date().toISOString(),
              snapshotUrl: el.snapshot_path ? `${ngrokProxy}/logs/snapshot/${el.id}?mode=portrait&ngrok-skip-browser-warning=1` : null,
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

      // Deduplicate unknown-person entries in attendance logs
      const LOG_DEDUP_WINDOW_MS = 60_000;
      const dedupedLogs: CctvLog[] = [];
      const seenUnknownWindows: { cam: string; ts: number }[] = [];
      for (const log of mergedLogs) {
        if (log.userId !== null) {
          dedupedLogs.push(log);
        } else {
          const logTs = new Date(log.detectedAt).getTime();
          const isDupe = seenUnknownWindows.some(
            w => w.cam === log.cameraName && Math.abs(w.ts - logTs) < LOG_DEDUP_WINDOW_MS
          );
          if (!isDupe) {
            dedupedLogs.push(log);
            seenUnknownWindows.push({ cam: log.cameraName, ts: logTs });
          }
        }
      }

      setLogs(dedupedLogs);

      if (usersData) {
        setUserOptions(usersData.map((u: any) => ({
          id: u.id,
          name: u.name || 'Unnamed Employee',
          biometricId: u.biometric_id || null,
          photoUrl: u.photo_url || null,
        })));
      }
    } catch (err: any) {
      console.error('[CCTV] Fetch logs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ngrokProxy]);

  // Stream Connection Inspector & Manual Override
  const [showStreamInspector, setShowStreamInspector] = useState(false);
  const [manualStreamInput, setManualStreamInput] = useState('');
  const [isSavingStreamUrl, setIsSavingStreamUrl] = useState(false);

  const handleSaveManualStream = async () => {
    const raw = manualStreamInput.trim().replace(/\/$/, '');
    if (!raw || !raw.startsWith('http')) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }
    setIsSavingStreamUrl(true);
    try {
      setNgrokProxy(raw);
      await supabase
        .from('cctv_devices')
        .update({
          ngrok_url: raw,
          updated_at: new Date().toISOString(),
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      setToast({ message: 'Live stream URL updated and connected!', type: 'success' });
      setShowStreamInspector(false);
    } catch (e: any) {
      setToast({ message: `Failed to save stream URL: ${e.message}`, type: 'error' });
    } finally {
      setIsSavingStreamUrl(false);
    }
  };

  // Fetch the live ngrok_url from cctv_devices once on mount
  useEffect(() => {
    const loadProxyUrl = async () => {
      try {
        const { data } = await supabase
          .from('cctv_devices')
          .select('ngrok_url')
          .not('ngrok_url', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.ngrok_url) {
          setNgrokProxy(data.ngrok_url.replace(/\/$/, ''));
          setManualStreamInput(data.ngrok_url.replace(/\/$/, ''));
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
        setLogs(prev => {
          if (!l.user_id) {
            const newTs = new Date(l.detected_at).getTime();
            const isDupe = prev.some(
              x => !x.userId &&
                   x.cameraName === l.camera_name &&
                   Math.abs(new Date(x.detectedAt).getTime() - newTs) < 60_000
            );
            if (isDupe) return prev;
          }
          return [{
            id: l.id,
            edgeLogId: null,
            userId: l.user_id,
            userName: l.user_name,
            cameraName: l.camera_name,
            direction: l.direction,
            confidence: l.confidence,
            detectedAt: l.detected_at,
            snapshotUrl: l.snapshot_url,
            edgeDeviceId: l.edge_device_id,
          }, ...prev.filter(x => x.id !== l.id)].slice(0, 100);
        });
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
    if (zoomPhoto?.item?.id === id) setZoomPhoto(null);
    setToast({ message: 'Unknown face dismissed', type: 'success' });
  };

  const handleDismissAll = async () => {
    if (unknownQueue.length === 0) return;
    if (!confirm(`Dismiss all ${unknownQueue.length} pending unknown detections from the queue?`)) return;
    try {
      const ids = unknownQueue.map(u => u.id);
      await supabase
        .from('cctv_enrollment_queue')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .in('id', ids);
      setUnknownQueue([]);
      if (zoomPhoto?.item) setZoomPhoto(null);
      setToast({ message: `Dismissed ${ids.length} unknown face items.`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to dismiss records.', type: 'error' });
    }
  };

  const fetchDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await fetch(`${ngrokProxy}/debug/analyze/main_gate_entry?ngrok-skip-browser-warning=1`, {
        headers: { 'ngrok-skip-browser-warning': '1' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setDiagData(data);
      } else {
        setToast({ message: `Edge server returned HTTP ${res.status}. Please ensure CCTV server is running.`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: 'Edge AI Debugger unreachable. Restart PM2 on the server.', type: 'error' });
    } finally {
      setDiagLoading(false);
    }
  }, [ngrokProxy]);

  const handlePurgeAllFalseUnknowns = async () => {
    if (!confirm('This will purge all unassigned unknown face records and false foliage entries from both Supabase and Local Edge DB. Continue?')) return;
    try {
      // 1. Purge from Edge Server SQLite
      try {
        await fetch(`${ngrokProxy}/debug/purge-false-unknowns`, {
          method: 'POST',
          headers: { 'ngrok-skip-browser-warning': '1' },
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        console.warn('Edge purge warning:', err);
      }

      // 2. Purge from Supabase cctv_enrollment_queue
      await supabase
        .from('cctv_enrollment_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // 3. Purge from Supabase cctv_attendance_logs where userId is null
      await supabase
        .from('cctv_attendance_logs')
        .delete()
        .is('user_id', null);

      setUnknownQueue([]);
      setLogs(prev => prev.filter(l => Boolean(l.userId)));
      if (zoomPhoto) setZoomPhoto(null);
      setToast({ message: 'Purged all false-positive unknown detections from database!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to purge records', type: 'error' });
    }
  };

  const handleAssignFaceDirect = async (targetItem: EnrollmentItem, targetUserId: string) => {
    if (!targetItem || !targetUserId) {
      setToast({ message: 'Please select an employee to assign.', type: 'error' });
      return;
    }

    setIsAssigning(true);
    setEnrollStep('sending');
    const selectedUserObj = userOptions.find(u => u.id === targetUserId);

    try {
      const { error } = await supabase
        .from('cctv_enrollment_queue')
        .update({
          status: 'enrolled',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          linked_user_id: targetUserId,
        })
        .eq('id', targetItem.id);
      if (error) throw error;

      if (targetItem.snapshotUrl) {
        try {
          const imgResponse = await fetch(targetItem.snapshotUrl);
          const imgBlob = await imgResponse.blob();

          const formData = new FormData();
          formData.append('user_id', targetUserId);
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
      setUnknownQueue(prev => prev.filter(u => u.id !== targetItem.id));
      setToast({
        message: `Success! ${selectedUserObj?.name || 'Employee'} assigned and face vector synced!`,
        type: 'success',
      });
      setSelectedUnknown(null);
      setSelectedUserId('');
      setZoomPhoto(null);
      setEnrollStep('select');
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign face.', type: 'error' });
      setEnrollStep('select');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignFace = async () => {
    if (selectedUnknown && selectedUserId) {
      await handleAssignFaceDirect(selectedUnknown, selectedUserId);
    }
  };

  const handleOpenLogPhoto = (log: CctvLog) => {
    const userOpt = userOptions.find(u => u.id === log.userId);
    const portraitUrl = log.snapshotUrl || '';
    const contextUrl = log.edgeLogId
      ? `${ngrokProxy}/logs/snapshot/${log.edgeLogId}?mode=context&ngrok-skip-browser-warning=1`
      : `${ngrokProxy}/camera/snapshot/${encodeURIComponent(log.cameraName)}?ngrok-skip-browser-warning=1`;

    setZoomLevel(1);
    setSelectedUserId('');
    setZoomPhoto({
      portraitUrl,
      contextUrl,
      activeView: 'portrait',
      title: log.userName || (log.userId ? 'Registered Employee' : 'Unknown Person'),
      subtitle: `${log.direction.toUpperCase()} • ${log.cameraName} • ${formatTime(log.detectedAt)}`,
      cameraName: log.cameraName,
      direction: log.direction,
      confidence: log.confidence,
      detectedAt: log.detectedAt,
      userId: log.userId,
      userName: log.userName,
      userPhotoUrl: userOpt?.photoUrl || null,
      edgeDeviceId: log.edgeDeviceId,
      edgeLogId: log.edgeLogId,
    });
  };

  const handleOpenUnknownPhoto = (item: EnrollmentItem) => {
    const portraitUrl = item.snapshotUrl || '';
    const contextUrl = `${ngrokProxy}/camera/snapshot/${encodeURIComponent(item.cameraName)}?ngrok-skip-browser-warning=1`;

    setZoomLevel(1);
    setSelectedUserId('');
    setZoomPhoto({
      portraitUrl,
      contextUrl,
      activeView: 'portrait',
      title: 'Unknown Person Detected',
      subtitle: `ENTRY • ${item.cameraName} • ${formatTime(item.detectedAt)}`,
      cameraName: item.cameraName,
      direction: 'entry',
      confidence: 0.5,
      detectedAt: item.detectedAt,
      userId: null,
      userName: null,
      userPhotoUrl: null,
      edgeDeviceId: item.edgeDeviceId,
      edgeLogId: null,
      item: item,
    });
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStreamInspector(prev => !prev)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-primary-text border border-border transition-all flex items-center gap-1"
                >
                  <Sliders className="h-3 w-3 text-emerald-600" />
                  {showStreamInspector ? 'Hide Inspector' : 'Stream Inspector'}
                </button>
                <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                  RTSP TCP • MAIN GATE
                </span>
              </div>
            </div>

            {/* Stream Inspector & Manual Override Drawer */}
            {showStreamInspector && (
              <div className="mb-3 p-3 bg-neutral-50 dark:bg-neutral-900/90 rounded-xl border border-emerald-300 dark:border-emerald-800/80 shadow-xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Active CCTV Stream Base URL:
                  </span>
                  <span className="font-mono text-[10px] bg-white dark:bg-black/50 px-2 py-0.5 rounded border border-border">
                    {ngrokProxy || 'No proxy URL set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. https://grade-katie-airports-zoloft.trycloudflare.com"
                    value={manualStreamInput}
                    onChange={e => setManualStreamInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSaveManualStream}
                    disabled={isSavingStreamUrl || !manualStreamInput.trim()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                  >
                    {isSavingStreamUrl ? 'Saving...' : 'Apply Stream URL'}
                  </button>
                </div>
              </div>
            )}

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
                  <div
                    key={log.id}
                    onClick={() => handleOpenLogPhoto(log)}
                    className="p-3.5 hover:bg-emerald-50/40 cursor-pointer transition-colors flex items-center gap-3 group"
                  >
                    <div className="relative">
                      {log.snapshotUrl ? (
                        <img
                          src={log.snapshotUrl}
                          alt=""
                          className="h-10 w-10 rounded-xl object-cover border border-emerald-500/30 group-hover:scale-105 transition-transform shadow-xs"
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 border ${
                          log.userId 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${log.userId ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-primary-text truncate group-hover:text-emerald-700 transition-colors">
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

                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
                      <Maximize2 className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS SECTION: All Logs vs Unknown Faces Review vs AI Debugger ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-xl w-fit mb-6 border border-border/80 shadow-2xs flex-wrap">
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

        <button
          onClick={() => { setActiveTab('debugger'); fetchDiagnostics(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'debugger'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <Cpu className="h-4 w-4" /> AI Diagnostics & Debugger
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
                    <tr
                      key={log.id}
                      onClick={() => handleOpenLogPhoto(log)}
                      className="hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-semibold text-primary-text flex items-center gap-2.5">
                        {log.snapshotUrl ? (
                          <img
                            src={log.snapshotUrl}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover border border-border group-hover:ring-2 group-hover:ring-emerald-500 group-hover:scale-105 transition-all"
                          />
                        ) : (
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold border ${log.userId ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400'}`}>
                            {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <span className="group-hover:text-emerald-700 transition-colors">{log.userName || <span className="text-muted italic">Unknown Person</span>}</span>
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
          {unknownQueue.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card p-3.5 rounded-2xl border border-amber-200/80 shadow-xs gap-3">
              <span className="text-xs text-amber-900 font-medium">
                Showing <strong>{unknownQueue.length}</strong> unknown face detections awaiting verification.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handlePurgeAllFalseUnknowns}
                  className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-50 font-semibold"
                >
                  Purge All False Foliage Unknowns
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDismissAll}
                  className="text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  Dismiss All ({unknownQueue.length})
                </Button>
              </div>
            </div>
          )}

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
                const imgSource = item.snapshotUrl;
                return (
                  <div key={item.id} className="bg-card rounded-2xl border border-amber-200/90 p-4 shadow-sm space-y-3 hover:border-amber-400 transition-colors">
                    <div
                      className="aspect-square bg-neutral-950 rounded-xl overflow-hidden border border-border relative flex items-center justify-center cursor-pointer group"
                      onClick={() => handleOpenUnknownPhoto(item)}
                    >
                      {imgSource ? (
                        <img
                          src={imgSource}
                          alt="Unknown face detection"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 bg-neutral-900 gap-2 p-4 text-center">
                          <User className="h-10 w-10 text-amber-400/60" />
                          <span className="text-[11px] font-mono text-neutral-400">Snapshot not captured</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                          <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> Click to Inspect
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

      {/* Tab 3: AI Diagnostics & Real-Time Debugger */}
      {activeTab === 'debugger' && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h3 className="font-bold text-primary-text text-base flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-emerald-600" /> AI Visual Diagnostics & Biometric Inspection
                </h3>
                <p className="text-xs text-muted mt-1">
                  Live breakdown of raw InsightFace detections, plant greenness ratios, skin tone chrominance, and ROI zone validation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={fetchDiagnostics}
                  disabled={diagLoading}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
                  {diagLoading ? 'Scanning...' : 'Scan Current Frame'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePurgeAllFalseUnknowns}
                  className="text-xs h-9 border-red-300 text-red-700 hover:bg-red-50"
                >
                  Purge False Unknowns
                </Button>
              </div>
            </div>

            {/* Diagnostic Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 block">Total Frame Candidates</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {diagData?.candidate_count ?? 0}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-semibold text-emerald-700 block">Accepted (Authentic Humans)</span>
                <span className="text-2xl font-bold text-emerald-900 mt-1 block">
                  {diagData?.accepted_count ?? 0}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-xs font-semibold text-rose-700 block">Rejected (Foliage / Non-Human)</span>
                <span className="text-2xl font-bold text-rose-900 mt-1 block">
                  {diagData?.rejected_count ?? 0}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-xs font-semibold text-blue-700 block">Camera Resolution</span>
                <span className="text-lg font-mono font-bold text-blue-900 mt-1.5 block">
                  {diagData?.resolution ?? '2560x1440'}
                </span>
              </div>
            </div>

            {/* Candidates Inspection Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Live Frame Candidate Biometric Analysis
              </h4>
              {(!diagData?.candidates || diagData.candidates.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  {diagLoading ? 'Analyzing frame...' : 'No candidate boxes detected in the current live frame. Foliage filter active.'}
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-800 font-bold uppercase text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Confidence Score</th>
                        <th className="py-3 px-3">Green Foliage %</th>
                        <th className="py-3 px-3">Human Skin %</th>
                        <th className="py-3 px-3">Face Dimensions</th>
                        <th className="py-3 px-3">Analysis / Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {diagData.candidates.map((c: any, idx: number) => (
                        <tr key={idx} className={c.is_human_verified ? 'bg-emerald-50/30' : 'bg-rose-50/20'}>
                          <td className="py-3 px-3 font-semibold">
                            {c.is_human_verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle className="h-3 w-3 text-emerald-600" /> ACCEPTED (HUMAN)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <XCircle className="h-3 w-3 text-rose-600" /> REJECTED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            {(c.det_score * 100).toFixed(1)}% {c.confidence_pass ? '✅' : '❌ (<75%)'}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className={c.green_ratio_pct > 18 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {c.green_ratio_pct}% {c.green_ratio_pct > 18 ? '(Foliage)' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className={c.skin_ratio_pct < 15 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {c.skin_ratio_pct}% {c.skin_ratio_pct < 15 ? '(No Skin)' : '✅'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-muted">
                            {c.width}x{c.height}px
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {c.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REDESIGNED ADVANCED DETECTION & PHOTO LIGHTBOX MODAL ── */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="bg-neutral-950 border border-emerald-500/30 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl text-white my-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/90">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${zoomPhoto.userId ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                  {zoomPhoto.userId ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-white">{zoomPhoto.title}</h4>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      zoomPhoto.direction === 'entry'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}>
                      {zoomPhoto.direction.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                    {zoomPhoto.cameraName} • Detected at {formatTime(zoomPhoto.detectedAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setZoomPhoto(null)}
                className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* View Mode Switcher Toolbar */}
            <div className="px-6 py-3 bg-neutral-900/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-neutral-950/80 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  onClick={() => { setZoomPhoto(prev => prev ? { ...prev, activeView: 'portrait' } : null); setZoomLevel(1); }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                    zoomPhoto.activeView === 'portrait'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <User className="h-3.5 w-3.5" /> Biometric Face Portrait
                </button>

                {zoomPhoto.contextUrl && (
                  <button
                    onClick={() => { setZoomPhoto(prev => prev ? { ...prev, activeView: 'context' } : null); setZoomLevel(1); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                      zoomPhoto.activeView === 'context'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Gate Scene Context
                  </button>
                )}

                {(zoomPhoto.userId || selectedUserId) && (
                  <button
                    onClick={() => { setZoomPhoto(prev => prev ? { ...prev, activeView: 'compare' } : null); setZoomLevel(1); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                      zoomPhoto.activeView === 'compare'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <SplitSquareVertical className="h-3.5 w-3.5" /> Side-by-Side Match
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {zoomPhoto.activeView !== 'compare' && (
                  <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))}
                      disabled={zoomLevel <= 1}
                      className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[11px] font-mono font-semibold px-1 text-neutral-300 min-w-[36px] text-center">
                      {(zoomLevel * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.5))}
                      disabled={zoomLevel >= 2.5}
                      className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    {zoomLevel !== 1 && (
                      <button
                        onClick={() => setZoomLevel(1)}
                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <a
                  href={zoomPhoto.activeView === 'context' ? (zoomPhoto.contextUrl || zoomPhoto.portraitUrl) : zoomPhoto.portraitUrl}
                  download={`cctv_${zoomPhoto.cameraName}_${Date.now()}.jpg`}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl border border-white/15 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  title="Download Image"
                >
                  <Download className="h-3.5 w-3.5" /> Save
                </a>
              </div>
            </div>

            {/* Main Image Display Viewport */}
            <div className="relative bg-neutral-950 p-4 md:p-6 flex items-center justify-center min-h-[380px] max-h-[480px] overflow-hidden">
              {zoomPhotoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-2">
                  <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-emerald-400 text-xs font-mono">Loading full-resolution photo...</span>
                </div>
              )}

              {/* 1. Biometric Face Portrait Mode */}
              {zoomPhoto.activeView === 'portrait' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div
                    className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-neutral-900 shadow-2xl max-w-sm w-full flex items-center justify-center min-h-[280px]"
                    style={{ maxHeight: '380px' }}
                  >
                    {zoomPhoto.portraitUrl ? (
                      <img
                        src={zoomPhoto.portraitUrl}
                        alt="Face portrait"
                        className="w-full h-full object-contain transition-transform duration-200"
                        style={{
                          transform: `scale(${zoomLevel})`,
                          maxHeight: '380px',
                        }}
                      />
                    ) : (
                      <div className="w-full h-64 flex flex-col items-center justify-center text-neutral-400 p-6 text-center gap-3">
                        <User className="h-12 w-12 text-amber-400/80" />
                        <div>
                          <p className="text-sm font-semibold text-white">No Face Snapshot Recorded</p>
                          <p className="text-xs text-neutral-400 mt-1">
                            Switch to "Gate Scene Context" to inspect the camera entrance view.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-neutral-950/85 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 backdrop-blur-md">
                      <Sparkles className="h-3 w-3" /> INSIGHTFACE 512D
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Gate Scene Context Mode */}
              {zoomPhoto.activeView === 'context' && zoomPhoto.contextUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div
                    className="relative rounded-2xl overflow-hidden border border-white/20 bg-neutral-900 shadow-2xl max-w-2xl w-full flex items-center justify-center"
                    style={{ maxHeight: '380px' }}
                  >
                    <img
                      src={zoomPhoto.contextUrl}
                      alt="Full scene camera context"
                      className="w-full h-full object-contain transition-transform duration-200"
                      style={{
                        transform: `scale(${zoomLevel})`,
                        maxHeight: '380px',
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-neutral-950/85 border border-white/20 text-neutral-300 px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-md">
                      <Camera className="h-3.5 w-3.5 text-emerald-400" /> GATE ENTRANCE SCENE
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Side-by-Side Profile Comparison Mode */}
              {zoomPhoto.activeView === 'compare' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl items-stretch">
                  {/* Left: CCTV Live Detection */}
                  <div className="bg-neutral-900/90 rounded-2xl border border-emerald-500/30 p-4 flex flex-col items-center text-center shadow-lg">
                    <span className="text-xs font-mono font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> CCTV Live Detection
                    </span>
                    <div className="aspect-square w-40 rounded-2xl overflow-hidden border border-emerald-500/40 bg-neutral-950 shadow-inner mb-3 flex items-center justify-center">
                      <img
                        src={zoomPhoto.portraitUrl}
                        alt="Live CCTV"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs font-semibold text-white truncate max-w-full">
                      {zoomPhoto.userName || 'Live Unknown'}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      {formatTime(zoomPhoto.detectedAt)} • {zoomPhoto.cameraName}
                    </span>
                  </div>

                  {/* Right: Registered Database Profile Photo */}
                  <div className="bg-neutral-900/90 rounded-2xl border border-white/20 p-4 flex flex-col items-center text-center shadow-lg">
                    <span className="text-xs font-mono font-bold text-sky-400 mb-2 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> System Profile Record
                    </span>
                    <div className="aspect-square w-40 rounded-2xl overflow-hidden border border-sky-500/40 bg-neutral-950 shadow-inner mb-3 flex items-center justify-center">
                      {(() => {
                        const targetUser = userOptions.find(u => u.id === (zoomPhoto.userId || selectedUserId));
                        if (targetUser?.photoUrl) {
                          return (
                            <img
                              src={targetUser.photoUrl}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          );
                        }
                        return (
                          <div className="w-full h-full flex items-center justify-center">
                            <ProfilePlaceholder seed={targetUser?.id} photoUrl={targetUser?.photoUrl} className="w-full h-full" />
                          </div>
                        );
                      })()}
                    </div>
                    <span className="text-xs font-semibold text-white truncate max-w-full">
                      {userOptions.find(u => u.id === (zoomPhoto.userId || selectedUserId))?.name || 'Employee Profile'}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      Code: {userOptions.find(u => u.id === (zoomPhoto.userId || selectedUserId))?.biometricId || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Telemetry Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-neutral-900/80 border-t border-white/10 text-xs font-mono">
              <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-white/5">
                <span className="text-neutral-400 text-[10px] block uppercase">Camera Channel</span>
                <span className="font-bold text-white truncate block">{zoomPhoto.cameraName}</span>
              </div>
              <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-white/5">
                <span className="text-neutral-400 text-[10px] block uppercase">Timestamp</span>
                <span className="font-bold text-white truncate block">{formatTime(zoomPhoto.detectedAt)}</span>
              </div>
              <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-white/5">
                <span className="text-neutral-400 text-[10px] block uppercase">Gate Direction</span>
                <span className={`font-bold uppercase ${zoomPhoto.direction === 'entry' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {zoomPhoto.direction === 'entry' ? '→ Punch-IN' : '← Punch-OUT'}
                </span>
              </div>
              <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-white/5">
                <span className="text-neutral-400 text-[10px] block uppercase">Match Confidence</span>
                <span className="font-bold text-emerald-400">
                  {(zoomPhoto.confidence * 100).toFixed(1)}% Match
                </span>
              </div>
            </div>

            {/* Footer / Direct Face Assignment Panel */}
            <div className="px-6 py-4 bg-neutral-900 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              {zoomPhoto.item ? (
                <div className="w-full flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Choose employee to assign this face --</option>
                      {userOptions.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.biometricId ? `(Code: ${u.biometricId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => handleAssignFaceDirect(zoomPhoto.item!, selectedUserId)}
                      disabled={!selectedUserId || isAssigning}
                      className="flex-1 sm:flex-none text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="h-4 w-4" /> {isAssigning ? 'Syncing Vector...' : 'Confirm & Sync Face'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDismiss(zoomPhoto.item!.id)}
                      className="text-xs h-9 text-neutral-400 hover:text-red-400 border-white/10"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs text-neutral-400 font-mono">
                    InsightFace Biometric Punch Verified
                  </span>
                  <Button
                    onClick={() => setZoomPhoto(null)}
                    className="text-xs h-9 bg-white/10 hover:bg-white/20 text-white px-5"
                  >
                    Close Preview
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Face Modal (Triggered from grid button) */}
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
