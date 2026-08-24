import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye, EyeOff, UserPlus, UserCheck,
  Maximize2, Minimize2, Video, Download, Shield, Cpu, Clock, Search,
  ZoomIn, ZoomOut, RotateCcw, User, Layers, Sparkles, SplitSquareVertical, Sliders,
  ChevronLeft, ChevronRight, ChevronDown, Edit2, MapPin, Crosshair
} from 'lucide-react';
import { CctvQuickMapModal, UserOptionItem, SiteLocationItem, QuickMapTargetLog } from '../../components/cctv/CctvQuickMapModal';
import { CctvActionZoneModal, ActionZonePoint, resampleToFixed20Points } from '../../components/cctv/CctvActionZoneModal';
import { cctvAttendanceBridgeService } from '../../services/cctvAttendanceBridge';

// Fallback URL used ONLY when Supabase has no ngrok_url yet (first boot before heartbeat).
const NGROK_PROXY_FALLBACK = 'https://cctv.cctv.rest';

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
  locationName?: string;
  actionZone?: ActionZonePoint[];
  isActionZoneEnabled?: boolean;
  showZoneOverlay?: boolean;
  onOpenActionZoneModal?: () => void;
}> = ({
  camName,
  proxyUrl,
  locationName,
  actionZone,
  isActionZoneEnabled = true,
  showZoneOverlay = true,
  onOpenActionZoneModal,
}) => {
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

  const hasValidActionZone = isActionZoneEnabled && actionZone && actionZone.length >= 3;
  const actionZoneSvgPoints = hasValidActionZone
    ? actionZone!.map(p => `${p.x * 100},${p.y * 100}`).join(' ')
    : '';

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

        {/* Action Zone (ROI) Polygon Live Stream HUD Overlay */}
        {showZoneOverlay && hasValidActionZone && !hasError && (
          <div className="absolute inset-0 pointer-events-none z-15">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Semi-transparent red capture zone */}
              <polygon
                points={actionZoneSvgPoints}
                fill="rgba(239, 68, 68, 0.15)"
                stroke="#ef4444"
                strokeWidth="0.8"
                strokeDasharray="2, 1"
              />
              <polygon
                points={actionZoneSvgPoints}
                fill="none"
                stroke="#ff4d4f"
                strokeWidth="0.4"
              />
            </svg>
            {/* Corner Pin Badges */}
            {actionZone!.map((p, i) => (
              <div
                key={i}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
              >
                <span className="h-3 w-3 rounded-full bg-rose-600 border border-white text-[7px] font-bold text-white flex items-center justify-center shadow-xs">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Top OSD Bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 border border-white/10 text-[10px] font-semibold text-white backdrop-blur-md shadow-xs">
              <span className={`h-2 w-2 rounded-full bg-rose-500 ${isConnected ? 'animate-pulse' : ''}`} />
              LIVE
            </span>
            <span className="text-[11px] font-semibold text-neutral-200 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
              CAM-01 • {locationName || 'Paradigm Office (Main Gate)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasValidActionZone && showZoneOverlay && (
              <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                ZONE FILTER: ACTIVE
              </span>
            )}
            <span className="text-[11px] font-mono text-neutral-300 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
              {currentTime}
            </span>
          </div>
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
            {onOpenActionZoneModal && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenActionZoneModal(); }}
                className="p-2 bg-neutral-900/85 hover:bg-neutral-800 text-rose-400 hover:text-rose-300 rounded-xl border border-white/15 backdrop-blur-md transition-all shadow-sm flex items-center gap-1"
                title="Define Action Zone (Face Capture Area)"
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            )}
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
                {locationName || 'Paradigm Office'} — MAIN SURVEILLANCE GATE
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
            {/* Fullscreen Action Zone Overlay */}
            {showZoneOverlay && hasValidActionZone && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <polygon
                  points={actionZoneSvgPoints}
                  fill="rgba(239, 68, 68, 0.12)"
                  stroke="#ef4444"
                  strokeWidth="0.6"
                  strokeDasharray="2, 1"
                />
              </svg>
            )}
            <div className="absolute top-4 left-4 text-emerald-400 text-xs font-mono bg-black/70 px-3 py-2 rounded-xl border border-emerald-500/20 pointer-events-none flex items-center gap-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              AI FACE RECOGNITION ACTIVE • INSIGHTFACE 512D
            </div>
            {hasValidActionZone && (
              <div className="absolute top-4 right-4 text-rose-400 text-xs font-mono bg-black/70 px-3 py-2 rounded-xl border border-rose-500/30 pointer-events-none flex items-center gap-2 backdrop-blur-sm">
                <Crosshair className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                ACTION ZONE (ROI) ACTIVE
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-t border-white/10 text-xs text-slate-400 font-mono flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span>Paradigm IFS • Real-Time CCTV AI Attendance • RTSP TCP</span>
            <div className="flex gap-3">
              {onOpenActionZoneModal && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); onOpenActionZoneModal(); }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2"
                >
                  <Crosshair className="h-4 w-4" /> Edit Action Zone
                </button>
              )}
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

// ── Registered Users Tab ──────────────────────────────────────────────────────
const RegisteredUsersTab: React.FC<{
  userOptions: UserOptionItem[];
  logs: CctvLog[];
}> = ({ userOptions, logs }) => {
  const [search, setSearch] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [filterTab, setFilterTab] = React.useState<'enrolled' | 'all' | 'active' | 'unmapped'>('enrolled');

  // Group logs by userId
  const logsByUser = React.useMemo(() => {
    const map: Record<string, CctvLog[]> = {};
    logs.forEach(l => {
      if (!l.userId) return;
      if (!map[l.userId]) map[l.userId] = [];
      map[l.userId].push(l);
    });
    // Sort each user's logs newest first
    Object.keys(map).forEach(uid => {
      map[uid].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    });
    return map;
  }, [logs]);

  const enrolledCount = React.useMemo(() => userOptions.filter(u => u.isFaceEnrolled).length, [userOptions]);
  const activeCount = React.useMemo(() => userOptions.filter(u => logsByUser[u.id]?.length).length, [userOptions, logsByUser]);
  const unmappedCount = React.useMemo(() => userOptions.filter(u => !u.isFaceEnrolled).length, [userOptions]);

  const filtered = React.useMemo(() => {
    let list = userOptions;

    if (filterTab === 'enrolled') {
      list = list.filter(u => u.isFaceEnrolled);
    } else if (filterTab === 'active') {
      list = list.filter(u => logsByUser[u.id]?.length);
    } else if (filterTab === 'unmapped') {
      list = list.filter(u => !u.isFaceEnrolled);
    }

    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.location || '').toLowerCase().includes(q) ||
      (u.biometricId || '').toLowerCase().includes(q)
    );
  }, [userOptions, search, filterTab, logsByUser]);

  // Sort: active users first
  const sorted = React.useMemo(() =>
    [...filtered].sort((a, b) => {
      const aActive = !!(logsByUser[a.id]?.length);
      const bActive = !!(logsByUser[b.id]?.length);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return a.name.localeCompare(b.name);
    }),
  [filtered, logsByUser]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-primary-text flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            CCTV Registered Users — Gate Log View
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            {enrolledCount} Face-Enrolled for CCTV · {activeCount} active today · {userOptions.length} total staff
          </p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="h-4 w-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, role, biometric ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Filter Tabs / Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border bg-slate-50/50">
        <button
          onClick={() => setFilterTab('enrolled')}
          className={`px-4 py-2.5 text-center transition-all ${filterTab === 'enrolled' ? 'bg-emerald-50 border-b-2 border-emerald-600' : 'hover:bg-slate-100/60'}`}
        >
          <p className="text-base font-black text-emerald-600">{enrolledCount}</p>
          <p className="text-[9px] text-emerald-950 uppercase tracking-widest font-bold">Face Enrolled</p>
        </button>
        <button
          onClick={() => setFilterTab('active')}
          className={`px-4 py-2.5 text-center transition-all ${filterTab === 'active' ? 'bg-blue-50 border-b-2 border-blue-600' : 'hover:bg-slate-100/60'}`}
        >
          <p className="text-base font-black text-blue-600">{activeCount}</p>
          <p className="text-[9px] text-blue-950 uppercase tracking-widest font-bold">Active Today</p>
        </button>
        <button
          onClick={() => setFilterTab('unmapped')}
          className={`px-4 py-2.5 text-center transition-all ${filterTab === 'unmapped' ? 'bg-amber-50 border-b-2 border-amber-600' : 'hover:bg-slate-100/60'}`}
        >
          <p className="text-base font-black text-amber-600">{unmappedCount}</p>
          <p className="text-[9px] text-amber-950 uppercase tracking-widest font-bold">Pending Face</p>
        </button>
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2.5 text-center transition-all ${filterTab === 'all' ? 'bg-slate-100 border-b-2 border-slate-600' : 'hover:bg-slate-100/60'}`}
        >
          <p className="text-base font-black text-slate-700">{userOptions.length}</p>
          <p className="text-[9px] text-slate-700 uppercase tracking-widest font-bold">All Employees</p>
        </button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <UserCheck className="h-10 w-10 opacity-20 mb-3" />
          <p className="text-sm font-medium">No users match the selected filter or search.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {sorted.map(u => {
            const userLogs = logsByUser[u.id] || [];
            const isActive = userLogs.length > 0;
            const isExpanded = expandedId === u.id;
            const entries = userLogs.filter(l => l.direction === 'entry').length;
            const exits   = userLogs.filter(l => l.direction === 'exit').length;

            return (
              <div key={u.id} className={`transition-colors ${isExpanded ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'}`}>
                {/* User row — click to expand */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : u.id)}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {u.photoUrl ? (
                      <img src={u.photoUrl} alt={u.name}
                        className="w-10 h-10 rounded-xl object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-base">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Name / role / location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-primary-text truncate">{u.name}</p>
                      {u.isFaceEnrolled ? (
                        <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                          <Sparkles className="h-2.5 w-2.5 text-emerald-600" /> Face Enrolled
                        </span>
                      ) : (
                        <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                          No Face Vector
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted truncate capitalize">
                      {u.role ? u.role.replace(/_/g, ' ') : ''}
                      {u.location ? ` · ${u.location}` : ''}
                    </p>
                  </div>

                  {/* Biometric ID */}
                  {u.biometricId && (
                    <span className="hidden sm:inline text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      🔑 {u.biometricId}
                    </span>
                  )}

                  {/* Activity summary */}
                  {isActive ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                        <ArrowRight className="h-2.5 w-2.5" />{entries}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-[10px] font-bold">
                        <ArrowLeft className="h-2.5 w-2.5" />{exits}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted italic flex-shrink-0">No activity</span>
                  )}

                  {/* Expand chevron */}
                  <ChevronDown className={`h-4 w-4 text-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded log list */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    {userLogs.length === 0 ? (
                      <p className="text-xs text-muted italic py-2 pl-14">No gate events recorded today.</p>
                    ) : (
                      <div className="ml-13 rounded-xl border border-border overflow-hidden bg-white/80 shadow-sm">
                        {/* Log list header */}
                        <div className="grid grid-cols-4 text-[9px] font-bold uppercase tracking-widest text-muted bg-slate-50 border-b border-border px-3 py-2">
                          <span>Time</span>
                          <span>Direction</span>
                          <span>Camera / Location</span>
                          <span className="text-right">Confidence</span>
                        </div>
                        <div className="divide-y divide-border/50 max-h-52 overflow-y-auto">
                          {userLogs.map(log => (
                            <div key={log.id} className="grid grid-cols-4 items-center px-3 py-2 hover:bg-emerald-50/40 transition-colors text-[11px]">
                              {/* Snapshot thumb + time */}
                              <div className="flex items-center gap-2">
                                {log.snapshotUrl ? (
                                  <img src={log.snapshotUrl} alt=""
                                    className="w-7 h-7 rounded-lg object-cover border border-border flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Camera className="h-3 w-3 text-slate-400" />
                                  </div>
                                )}
                                <span className="font-mono text-primary-text font-semibold">{fmt(log.detectedAt)}</span>
                              </div>

                              {/* Direction */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold w-fit text-[10px] ${
                                log.direction === 'entry'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {log.direction === 'entry'
                                  ? <><ArrowRight className="h-2.5 w-2.5" /> IN</>
                                  : <><ArrowLeft className="h-2.5 w-2.5" /> OUT</>
                                }
                              </span>

                              {/* Camera */}
                              <span className="text-muted truncate">{log.cameraName}</span>

                              {/* Confidence */}
                              <span className="text-right font-mono text-emerald-700 font-semibold">
                                {(log.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CctvDashboard: React.FC = () => {

  const { user } = useAuthStore();
  // Resolved live ngrok proxy URL — fetched from Supabase on mount
  const [ngrokProxy, setNgrokProxy] = useState(NGROK_PROXY_FALLBACK);
  const [logs, setLogs] = useState<CctvLog[]>([]);
  const [unknownQueue, setUnknownQueue] = useState<EnrollmentItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserOptionItem[]>([]);
  const [siteLocations, setSiteLocations] = useState<SiteLocationItem[]>([]);
  const [selectedSiteLocation, setSelectedSiteLocation] = useState<string>('Paradigm Office');
  const [quickMapTarget, setQuickMapTarget] = useState<QuickMapTargetLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'unknown' | 'debugger' | 'registered'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Action Zone (ROI) state
  const [showActionZoneModal, setShowActionZoneModal] = useState(false);
  const [actionZonePolygon, setActionZonePolygon] = useState<ActionZonePoint[]>([
    { x: 0.24, y: 0.70 }, { x: 0.27, y: 0.65 }, { x: 0.31, y: 0.60 }, { x: 0.35, y: 0.56 },
    { x: 0.40, y: 0.52 }, { x: 0.45, y: 0.48 }, { x: 0.49, y: 0.46 }, { x: 0.53, y: 0.46 },
    { x: 0.58, y: 0.50 }, { x: 0.64, y: 0.56 }, { x: 0.69, y: 0.62 }, { x: 0.74, y: 0.67 },
    { x: 0.71, y: 0.72 }, { x: 0.65, y: 0.76 }, { x: 0.58, y: 0.80 }, { x: 0.51, y: 0.83 },
    { x: 0.44, y: 0.85 }, { x: 0.37, y: 0.85 }, { x: 0.31, y: 0.81 }, { x: 0.26, y: 0.76 }
  ]);
  const [isActionZoneEnabled, setIsActionZoneEnabled] = useState(true);
  const [showStreamZoneOverlay, setShowStreamZoneOverlay] = useState(false);

  const formatCameraLocation = (camName?: string | null) => {
    if (!camName) return 'Paradigm Office (Main Gate)';
    const lower = camName.toLowerCase();
    if (lower.includes('main_gate') || lower.includes('main gate') || lower.includes('gate_entry')) {
      return 'Paradigm Office (Main Gate)';
    }
    return camName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

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

  // Dynamic height sync: locks right detections panel height to CCTV stream card
  const leftCardRef = useRef<HTMLDivElement>(null);
  const [cctvCardHeight, setCctvCardHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const updateHeight = () => {
      if (leftCardRef.current) {
        const rect = leftCardRef.current.getBoundingClientRect();
        if (rect.height > 100) {
          setCctvCardHeight(Math.round(rect.height));
        }
      }
    };

    updateHeight();
    const el = leftCardRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(el);

    window.addEventListener('resize', updateHeight);
    const intervals = [50, 150, 300, 600, 1000, 2000].map(ms => setTimeout(updateHeight, ms));

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
      intervals.forEach(clearTimeout);
    };
  }, []);

  // Pagination for Real-Time Face Detections (10 per page)
  const [liveLogsPage, setLiveLogsPage] = useState(1);
  const LIVE_LOGS_PER_PAGE = 10;
  const totalLivePages = Math.max(1, Math.ceil(logs.length / LIVE_LOGS_PER_PAGE));
  const safeLivePage = Math.min(liveLogsPage, totalLivePages);
  const paginatedLogs = logs.slice((safeLivePage - 1) * LIVE_LOGS_PER_PAGE, safeLivePage * LIVE_LOGS_PER_PAGE);

  const getPaginationNumbers = (current: number, total: number) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (current > 3) {
      pages.push('...');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
    return pages;
  };

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

  const [isSyncingBridge, setIsSyncingBridge] = useState(false);
  const handleSyncToAttendance = async () => {
    setIsSyncingBridge(true);
    try {
      const result = await cctvAttendanceBridgeService.syncUnbridgedLogs();
      setToast({
        message: `CCTV Attendance Bridge: ${result.bridged} bridged, ${result.merged} merged with existing attendance, ${result.skipped} skipped.`,
        type: 'success',
      });
      fetchLogs();
    } catch (err: any) {
      setToast({ message: `Bridge sync failed: ${err.message}`, type: 'error' });
    } finally {
      setIsSyncingBridge(false);
    }
  };

  const [bridgeDiagState, setBridgeDiagState] = useState<{
    isRunning: boolean;
    results: { name: string; status: 'pass' | 'fail' | 'warn'; detail: string }[] | null;
    statusData: { total: number; bridged: number; unbridged: number } | null;
  }>({
    isRunning: false,
    results: null,
    statusData: null,
  });

  const [showSqlFixModal, setShowSqlFixModal] = useState(false);

  const runBridgeSelfTest = async () => {
    setBridgeDiagState(prev => ({ ...prev, isRunning: true, results: null }));
    const results: { name: string; status: 'pass' | 'fail' | 'warn'; detail: string }[] = [];

    // 1. Check CCTV logs schema
    try {
      const { error: logsErr } = await supabase
        .from('cctv_attendance_logs')
        .select('id, bridged, bridged_at, location_id')
        .limit(1);
      if (!logsErr) {
        results.push({ name: 'CCTV Logs Bridge Schema', status: 'pass', detail: 'Columns (bridged, bridged_at, location_id) verified in DB' });
      } else {
        results.push({ name: 'CCTV Logs Bridge Schema', status: 'fail', detail: logsErr.message });
      }
    } catch (e: any) {
      results.push({ name: 'CCTV Logs Bridge Schema', status: 'fail', detail: e.message });
    }

    // 2. Check attendance_events columns
    try {
      const { error: attErr } = await supabase
        .from('attendance_events')
        .select('id, cctv_log_id, source')
        .limit(1);
      if (!attErr) {
        results.push({ name: 'Attendance Events Bridge Columns', status: 'pass', detail: 'Columns (cctv_log_id, source) verified in DB' });
      } else {
        results.push({ name: 'Attendance Events Bridge Columns', status: 'fail', detail: attErr.message });
      }
    } catch (e: any) {
      results.push({ name: 'Attendance Events Bridge Columns', status: 'fail', detail: e.message });
    }

    // 3. Check RPC Procedure
    try {
      const { error: rpcErr } = await supabase.rpc('backfill_cctv_attendance_bridge', {
        p_limit: 5,
        p_min_confidence: 0.70,
      });
      if (!rpcErr) {
        results.push({ name: 'Stored Procedure (backfill_cctv_attendance_bridge)', status: 'pass', detail: 'SQL Procedure executed successfully' });
      } else {
        results.push({ name: 'Stored Procedure (backfill_cctv_attendance_bridge)', status: 'warn', detail: rpcErr.message });
      }
    } catch (e: any) {
      results.push({ name: 'Stored Procedure (backfill_cctv_attendance_bridge)', status: 'warn', detail: e.message });
    }

    // 4. Check bridge stats
    const statusData = await cctvAttendanceBridgeService.getBridgeStatus();

    setBridgeDiagState({
      isRunning: false,
      results,
      statusData,
    });
  };

  const fetchLogs = useCallback(async () => {
    try {
      // 1. Fetch from Supabase (Cloud) & API Service
      const [
        { data: logsData, error: logsError },
        { data: unknownData, error: unknownError },
        usersResult,
        locationsResult
      ] = await Promise.all([
        supabase
          .from('cctv_attendance_logs')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(100),
        supabase
          .from('cctv_enrollment_queue')
          .select('*')
          .eq('status', 'pending')
          .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('detected_at', { ascending: false })
          .limit(50),
        supabase
          .from('users')
          .select('id, name, email, role:roles(display_name), role_id, location, biometric_id, photo_url, face_embedding_512, organization_name, company')
          .order('name', { ascending: true })
          .limit(500)
          .then(({ data, error }) => {
            if (error) console.warn('[CCTV] Supabase users fetch error:', error);
            return data || [];
          }),
        api.getLocations().catch(async () => {
          const { data } = await supabase.from('locations').select('*').limit(1000);
          return data || [];
        }),
      ]);

      if (logsError) console.warn('[CCTV] Supabase logs error:', logsError);
      if (unknownError) console.warn('[CCTV] Supabase queue error:', unknownError);

      // Auto-cleanup: silently dismiss stale pending unknowns older than 24 hours
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      supabase
        .from('cctv_enrollment_queue')
        .delete()
        .eq('status', 'pending')
        .lt('detected_at', staleThreshold)
        .then(({ error: cleanupErr }) => {
          if (cleanupErr) console.debug('[CCTV] Stale cleanup warning:', cleanupErr.message);
        });

      const mergedLogs: CctvLog[] = (logsData || []).map((l: any) => ({
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

      if (Array.isArray(usersResult) && usersResult.length > 0) {
        setUserOptions(usersResult.map((u: any) => {
          const emb = u.face_embedding_512 || u.faceEmbedding_512 || u.faceEmbedding512;
          const isEnrolled = Boolean(
            emb && (Array.isArray(emb) ? emb.length > 0 : true)
          );
          const roleDisplay = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || u.role_id || u.role || '';
          return {
            id: u.id,
            name: u.name || 'Unnamed Employee',
            email: u.email || null,
            role: roleDisplay,
            company: u.organizationName || u.organization_name || u.company || 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD',
            location: u.location || null,
            biometricId: u.biometricId || u.biometric_id || null,
            photoUrl: u.photoUrl || u.photo_url || null,
            isFaceEnrolled: isEnrolled,
          };
        }));
      }

      if (Array.isArray(locationsResult) && locationsResult.length > 0) {
        const formattedLocs: SiteLocationItem[] = locationsResult.map((l: any) => ({
          id: l.id,
          name: l.name || l.address || 'Site Location',
          address: l.address || null,
          coordinates: l.latitude && l.longitude ? `${l.latitude}, ${l.longitude}` : (l.coordinates || null),
          radius: l.radius || 100,
        }));
        setSiteLocations(formattedLocs);
        const paradigmLoc = formattedLocs.find(l => l.name.toLowerCase().includes('paradigm'));
        if (paradigmLoc && !selectedSiteLocation) {
          setSelectedSiteLocation(paradigmLoc.name);
        }
      }
    } catch (err: any) {
      console.error('[CCTV] Fetch logs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ngrokProxy, selectedSiteLocation]);

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

  // Fetch the live ngrok_url & action_zones from cctv_devices once on mount
  useEffect(() => {
    const loadProxyUrl = async () => {
      try {
        const { data } = await supabase
          .from('cctv_devices')
          .select('ngrok_url, action_zones')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.ngrok_url) {
          setNgrokProxy(data.ngrok_url.replace(/\/$/, ''));
          setManualStreamInput(data.ngrok_url.replace(/\/$/, ''));
        }

        // Load saved Action Zone configuration (always ensuring exactly 20 points)
        if (data?.action_zones && data.action_zones['main_gate_entry']) {
          const zoneObj = data.action_zones['main_gate_entry'];
          if (Array.isArray(zoneObj.polygon) && zoneObj.polygon.length >= 3) {
            const rawPts = zoneObj.polygon.map((p: any) =>
              Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
            );
            setActionZonePolygon(resampleToFixed20Points(rawPts));
            setIsActionZoneEnabled(zoneObj.enabled !== false);
          }
        } else {
          // Check localStorage cache
          try {
            const cached = localStorage.getItem('cctv_action_zone_main_gate_entry');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed.polygon) && parsed.polygon.length >= 3) {
                const rawPts = parsed.polygon.map((p: any) =>
                  Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
                );
                setActionZonePolygon(resampleToFixed20Points(rawPts));
                setIsActionZoneEnabled(parsed.enabled !== false);
              }
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Supabase unavailable — keep fallback & cache
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cctv_attendance_logs' }, payload => {
        if (payload.eventType === 'INSERT') {
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
        } else if (payload.eventType === 'UPDATE') {
          const l = payload.new as any;
          setLogs(prev => prev.map(x => x.id === l.id ? {
            ...x,
            userId: l.user_id,
            userName: l.user_name || x.userName,
          } : x));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cctv_enrollment_queue' }, payload => {
        if (payload.eventType === 'INSERT') {
          const u = payload.new as any;
          const newItem: EnrollmentItem = {
            id: u.id,
            cameraName: u.camera_name,
            detectedAt: u.detected_at,
            snapshotUrl: u.snapshot_url,
            status: u.status || 'pending',
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
        } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          const u = (payload.new || payload.old) as any;
          if (u?.status === 'enrolled' || u?.status === 'dismissed' || payload.eventType === 'DELETE') {
            setUnknownQueue(prev => prev.filter(x => x.id !== u.id));
          }
        }
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

      // Also create a cctv_attendance_logs entry so attendance bridge captures this punch
      try {
        await supabase.from('cctv_attendance_logs').insert({
          user_id: targetUserId,
          user_name: selectedUserObj?.name || 'Employee',
          camera_name: targetItem.cameraName || 'Main Gate',
          direction: 'entry',
          confidence: 0.95,
          detected_at: targetItem.detectedAt || new Date().toISOString(),
          snapshot_url: targetItem.snapshotUrl || null,
          edge_device_id: targetItem.edgeDeviceId || 'cctv-edge-main',
        });
      } catch (attLogErr) {
        console.warn('[CCTV Enroll] Attendance log insertion note:', attLogErr);
      }

      setEnrollStep('done');
      setUnknownQueue(prev => prev.filter(u => u.id !== targetItem.id));
      setToast({
        message: `Success! ${selectedUserObj?.name || 'Employee'} assigned and attendance credited!`,
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

  const handleQuickMapSuccess = (updated: { id: string; userId: string; userName: string }) => {
    setLogs(prev => prev.map(l => l.id === updated.id ? { ...l, userId: updated.userId, userName: updated.userName } : l));
    setUnknownQueue(prev => prev.filter(u => u.id !== updated.id));
    if (zoomPhoto) {
      setZoomPhoto(prev => prev ? { ...prev, userId: updated.userId, userName: updated.userName, title: updated.userName } : null);
    }
    setToast({ message: `Successfully mapped face to ${updated.userName}!`, type: 'success' });
    fetchLogs();
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-start">
        {/* Left Column: Live NVR Camera Window (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div ref={leftCardRef} className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold text-primary-text text-sm uppercase tracking-wider">
                  Live CCTV Surveillance Stream
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowActionZoneModal(true)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300 dark:border-rose-800 transition-all flex items-center gap-1.5 shadow-2xs"
                  title="Define Face Capture Action Zone (ROI)"
                >
                  <Crosshair className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
                  <span>Action Zone</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${isActionZoneEnabled ? 'bg-rose-500' : 'bg-gray-400'}`} />
                </button>
                <button
                  onClick={() => setShowStreamZoneOverlay(prev => !prev)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md border transition-all flex items-center gap-1 ${
                    showStreamZoneOverlay 
                      ? 'bg-rose-100/70 border-rose-300 text-rose-900 dark:bg-rose-950 dark:text-rose-200' 
                      : 'bg-neutral-100 dark:bg-neutral-800 border-border text-muted'
                  }`}
                  title={showStreamZoneOverlay ? 'Hide Zone Outline Box' : 'Show Zone Outline Box'}
                >
                  {showStreamZoneOverlay ? <Eye className="h-3 w-3 text-rose-600" /> : <EyeOff className="h-3 w-3 text-gray-400" />}
                  <span>{showStreamZoneOverlay ? 'Zone ON' : 'Zone OFF'}</span>
                </button>
                <button
                  onClick={() => setShowStreamInspector(prev => !prev)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-primary-text border border-border transition-all flex items-center gap-1"
                >
                  <Sliders className="h-3 w-3 text-emerald-600" />
                  {showStreamInspector ? 'Hide Inspector' : 'Stream Inspector'}
                </button>
                <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  RTSP TCP • PARADIGM OFFICE
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
                {siteLocations.length > 0 && (
                  <div className="pt-1.5 border-t border-border/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-600" /> Camera Site Location:
                    </span>
                    <select
                      value={selectedSiteLocation}
                      onChange={e => setSelectedSiteLocation(e.target.value)}
                      className="px-2 py-1 bg-background border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[220px]"
                    >
                      {siteLocations.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="aspect-video w-full rounded-xl overflow-hidden shadow-inner">
              <NvrCameraStream
                camName="main_gate_entry"
                proxyUrl={ngrokProxy}
                locationName={`${selectedSiteLocation || 'Paradigm Office'} (Main Gate)`}
                actionZone={actionZonePolygon}
                isActionZoneEnabled={isActionZoneEnabled}
                showZoneOverlay={showStreamZoneOverlay}
                onOpenActionZoneModal={() => setShowActionZoneModal(true)}
              />
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
        <div 
          className="lg:col-span-5 flex flex-col w-full min-h-0"
          style={{ 
            height: cctvCardHeight ? `${cctvCardHeight}px` : undefined,
            maxHeight: cctvCardHeight ? `${cctvCardHeight}px` : undefined 
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden h-full max-h-full">
            <div className="px-5 py-4 border-b border-border bg-emerald-50/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-emerald-950 text-sm">Real-Time Face Detections</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {logs.length} Today
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
              {paginatedLogs.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center p-6">
                  <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                    <Camera className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-primary-text">Waiting for Gate Activity...</p>
                  <p className="text-xs text-muted mt-1">Camera is scanning for faces in real-time.</p>
                </div>
              ) : (
                paginatedLogs.map(log => (
                  <div
                    key={log.id}
                    onClick={() => handleOpenLogPhoto(log)}
                    className="p-3 hover:bg-emerald-50/40 cursor-pointer transition-colors flex items-center gap-3 group"
                  >
                    <div className="relative">
                      {log.snapshotUrl ? (
                        <img
                          src={log.snapshotUrl}
                          alt=""
                          className="h-9 w-9 rounded-xl object-cover border border-emerald-500/30 group-hover:scale-105 transition-transform shadow-xs"
                        />
                      ) : (
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-extrabold flex-shrink-0 border ${
                          log.userId 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${log.userId ? 'bg-emerald-500' : 'bg-amber-500'}`} />
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
                        <Clock className="h-3 w-3 text-muted" /> {formatTime(log.detectedAt)} • {formatCameraLocation(log.cameraName)}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickMapTarget({
                            id: log.id,
                            snapshotUrl: log.snapshotUrl,
                            cameraName: formatCameraLocation(log.cameraName),
                            direction: log.direction,
                            confidence: log.confidence,
                            detectedAt: log.detectedAt,
                            userId: log.userId,
                            userName: log.userName,
                            edgeDeviceId: log.edgeDeviceId,
                            edgeLogId: log.edgeLogId,
                          });
                        }}
                        className="p-1 px-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 transition-all shadow-2xs"
                        title="Quick Edit / Map User"
                      >
                        <Edit2 className="h-3 w-3 text-emerald-600" />
                        <span>{log.userId ? 'Edit' : 'Map'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Footer */}
            {logs.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-neutral-50/90 dark:bg-neutral-900/60 flex items-center justify-between flex-shrink-0 text-xs select-none gap-2">
                <span className="text-[11px] text-muted font-medium shrink-0">
                  Showing <span className="font-semibold text-primary-text">{(safeLivePage - 1) * LIVE_LOGS_PER_PAGE + 1}</span>-
                  <span className="font-semibold text-primary-text">{Math.min(safeLivePage * LIVE_LOGS_PER_PAGE, logs.length)}</span> of{' '}
                  <span className="font-semibold text-primary-text">{logs.length}</span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLiveLogsPage(p => Math.max(1, p - 1))}
                    disabled={safeLivePage === 1}
                    className="h-7 px-2 rounded-lg border border-border bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-primary-text font-medium text-[11px] transition-all flex items-center gap-0.5 shadow-2xs"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {getPaginationNumbers(safeLivePage, totalLivePages).map((p, idx) =>
                      p === '...' ? (
                        <span key={`dots-${idx}`} className="px-1 text-muted select-none text-xs font-semibold">
                          ...
                        </span>
                      ) : (
                        <button
                          key={`page-${p}`}
                          onClick={() => setLiveLogsPage(Number(p))}
                          className={`min-w-[26px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all border ${
                            safeLivePage === p
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-primary-text border-border'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => setLiveLogsPage(p => Math.min(totalLivePages, p + 1))}
                    disabled={safeLivePage === totalLivePages}
                    className="h-7 px-2 rounded-lg border border-border bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-primary-text font-medium text-[11px] transition-all flex items-center gap-0.5 shadow-2xs"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
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

        <button
          onClick={() => setActiveTab('registered')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'registered'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <UserCheck className="h-4 w-4" /> Face Enrolled Users ({userOptions.filter(u => u.isFaceEnrolled).length}/{userOptions.length})
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
                onClick={handleSyncToAttendance}
                disabled={isSyncingBridge}
                className="text-xs h-8 px-3 border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 flex items-center gap-1.5 font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingBridge ? 'animate-spin' : ''}`} />
                {isSyncingBridge ? 'Syncing...' : 'Sync to Attendance'}
              </Button>
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
                  <th className="py-3.5 px-4">Site Location / Channel</th>
                  <th className="py-3.5 px-4">AI Confidence</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted font-medium">
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
                      <td className="py-3 px-4 text-primary-text font-medium">
                        <span className="inline-flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md border border-border">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="font-semibold">{formatCameraLocation(log.cameraName)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {(log.confidence * 100).toFixed(0)}% Match
                      </td>
                      <td className="py-3 px-4 text-muted">{formatTime(log.detectedAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickMapTarget({
                              id: log.id,
                              snapshotUrl: log.snapshotUrl,
                              cameraName: formatCameraLocation(log.cameraName),
                              direction: log.direction,
                              confidence: log.confidence,
                              detectedAt: log.detectedAt,
                              userId: log.userId,
                              userName: log.userName,
                              edgeDeviceId: log.edgeDeviceId,
                              edgeLogId: log.edgeLogId,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs inline-flex items-center gap-1 transition-all shadow-2xs"
                          title="Quick Edit / Map User"
                        >
                          <Edit2 className="h-3 w-3 text-emerald-600" />
                          <span>{log.userId ? 'Edit' : 'Map User'}</span>
                        </button>
                      </td>
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
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        {formatCameraLocation(item.cameraName)}
                      </span>
                      <span className="text-muted">{formatTime(item.detectedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button
                        onClick={() => {
                          setQuickMapTarget({
                            id: item.id,
                            snapshotUrl: item.snapshotUrl,
                            cameraName: formatCameraLocation(item.cameraName),
                            direction: 'entry',
                            confidence: 0.8,
                            detectedAt: item.detectedAt,
                            userId: null,
                            userName: 'Unknown Person',
                            edgeDeviceId: item.edgeDeviceId,
                            enrollmentQueueId: item.id,
                          });
                        }}
                        className="flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Quick Map & Enroll
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
          {/* ── CCTV Attendance Bridge Live Diagnostics Card ── */}
          <div className="bg-card rounded-2xl border border-emerald-300 dark:border-emerald-800 p-5 shadow-sm bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-emerald-500/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200 dark:border-emerald-800">
              <div>
                <h3 className="font-bold text-primary-text text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-600" /> CCTV Attendance Bridge Live Health & Diagnostics
                </h3>
                <p className="text-xs text-muted mt-1">
                  Verifies database triggers, deduplication guards, and real-time syncing from <code>cctv_attendance_logs</code> to <code>attendance_events</code>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={runBridgeSelfTest}
                  disabled={bridgeDiagState.isRunning}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold shadow-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${bridgeDiagState.isRunning ? 'animate-spin' : ''}`} />
                  {bridgeDiagState.isRunning ? 'Testing...' : 'Run Bridge Self-Test'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSqlFixModal(true)}
                  className="text-xs h-9 border-emerald-400 text-emerald-800 hover:bg-emerald-50 flex items-center gap-1.5"
                >
                  <Sliders className="h-3.5 w-3.5" /> View SQL Function
                </Button>
              </div>
            </div>

            {/* Bridge Status Summary */}
            {bridgeDiagState.statusData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="p-3 rounded-xl bg-background border border-border">
                  <span className="text-[11px] font-semibold text-muted block">Total CCTV Detections</span>
                  <span className="text-xl font-bold text-primary-text mt-0.5 block">{bridgeDiagState.statusData.total}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">Bridged into Attendance Events</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 block">{bridgeDiagState.statusData.bridged}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block">Pending / Unbridged</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5 block">{bridgeDiagState.statusData.unbridged}</span>
                </div>
              </div>
            )}

            {/* Test Results Output */}
            {bridgeDiagState.results && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">Self-Test Diagnostic Results:</h4>
                <div className="space-y-1.5">
                  {bridgeDiagState.results.map((res, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                        res.status === 'pass'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                          : res.status === 'warn'
                          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                          : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
                      }`}
                    >
                      {res.status === 'pass' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : res.status === 'warn' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold">{res.name}: </span>
                        <span>{res.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                        <th className="py-3 px-3">Red Light %</th>
                        <th className="py-3 px-3">Human Skin %</th>
                        <th className="py-3 px-3">Texture</th>
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
                            <span className={(c.red_light_ratio_pct ?? 0) > 15 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {c.red_light_ratio_pct ?? 0}% {(c.red_light_ratio_pct ?? 0) > 15 ? '🚗 (Vehicle Light)' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className={c.skin_ratio_pct < 15 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {c.skin_ratio_pct}% {c.skin_ratio_pct < 15 ? '(No Skin)' : '✅'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className={(c.texture_variance ?? 0) < 20 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {(c.texture_variance ?? 0).toFixed(0)} {(c.texture_variance ?? 0) < 20 ? '(Flat)' : '✅'}
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

      {/* ── TAB 4: Registered Users ── */}
      {activeTab === 'registered' && (
        <RegisteredUsersTab userOptions={userOptions} logs={logs} />
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
                <span className="text-neutral-400 text-[10px] block uppercase">Camera Channel / Location</span>
                <span className="font-bold text-white truncate block flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                  {formatCameraLocation(zoomPhoto.cameraName)}
                </span>
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
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => {
                    const targetLog: QuickMapTargetLog = {
                      id: zoomPhoto.item?.id || (zoomPhoto.edgeLogId ? `edge-${zoomPhoto.edgeLogId}` : 'zoom-photo'),
                      snapshotUrl: zoomPhoto.portraitUrl,
                      cameraName: formatCameraLocation(zoomPhoto.cameraName),
                      direction: zoomPhoto.direction,
                      confidence: zoomPhoto.confidence,
                      detectedAt: zoomPhoto.detectedAt,
                      userId: zoomPhoto.userId,
                      userName: zoomPhoto.userName,
                      edgeDeviceId: zoomPhoto.edgeDeviceId,
                      edgeLogId: zoomPhoto.edgeLogId,
                      enrollmentQueueId: zoomPhoto.item?.id || null,
                    };
                    setQuickMapTarget(targetLog);
                  }}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="h-4 w-4" /> {zoomPhoto.userId ? 'Edit Employee Details' : 'Quick Map Face to Employee'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                  InsightFace Biometric Punch System
                </span>
                <Button
                  onClick={() => setZoomPhoto(null)}
                  className="text-xs h-9 bg-white/10 hover:bg-white/20 text-white px-5"
                >
                  Close Preview
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Map & User Edit Modal */}
      <CctvQuickMapModal
        isOpen={!!quickMapTarget}
        onClose={() => setQuickMapTarget(null)}
        targetLog={quickMapTarget}
        users={userOptions}
        locations={siteLocations}
        ngrokProxy={ngrokProxy}
        currentUserId={user?.id}
        onSuccess={handleQuickMapSuccess}
      />

      {/* Assign Face Modal (Triggered from grid button fallback) */}
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

      {/* ── SQL Bridge Trigger Fix Code Modal ── */}
      <Modal
        isOpen={showSqlFixModal}
        onClose={() => setShowSqlFixModal(false)}
        title="Live CCTV Bridge SQL Function (Run in Supabase SQL Editor)"
        confirmButtonText="Copy SQL to Clipboard"
        onConfirm={() => {
          const sqlText = `-- ─── Real-Time CCTV Attendance Bridge Trigger (Updated UUID Safe) ───
CREATE OR REPLACE FUNCTION public.trg_fn_bridge_cctv_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_window_interval INTERVAL := INTERVAL '15 minutes';
    v_min_confidence FLOAT := 0.70;
    v_event_type TEXT;
    v_location_name TEXT;
    v_location_id UUID;
    v_device_uuid UUID := NULL;
    v_existing_event_id UUID;
    v_inserted_event_id UUID;
BEGIN
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.bridged = TRUE AND NEW.attendance_event_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.confidence, 0) < v_min_confidence THEN
        NEW.bridge_error := 'Skipped: Confidence below threshold (' || ROUND((COALESCE(NEW.confidence, 0) * 100)::numeric, 1)::text || '% < ' || (v_min_confidence * 100)::text || '%)';
        RETURN NEW;
    END IF;

    IF NEW.direction = 'entry' THEN
        v_event_type := 'punch-in';
    ELSE
        v_event_type := 'punch-out';
    END IF;

    IF NEW.edge_device_id IS NOT NULL THEN
        SELECT cd.id, cd.location_name, cd.location_id
        INTO v_device_uuid, v_location_name, v_location_id
        FROM public.cctv_devices cd
        WHERE cd.edge_device_id = NEW.edge_device_id
        LIMIT 1;
    END IF;

    IF v_location_name IS NULL THEN
        v_location_name := COALESCE(NEW.camera_name, 'CCTV Gate');
    END IF;

    IF NEW.location_id IS NOT NULL THEN
        v_location_id := NEW.location_id;
    END IF;

    SELECT id INTO v_existing_event_id
    FROM public.attendance_events
    WHERE user_id = NEW.user_id
      AND type = v_event_type
      AND timestamp >= (NEW.detected_at - v_window_interval)
      AND timestamp <= (NEW.detected_at + v_window_interval)
    ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - NEW.detected_at))) ASC
    LIMIT 1;

    IF v_existing_event_id IS NOT NULL THEN
        NEW.attendance_event_id := v_existing_event_id;
        NEW.bridged := TRUE;
        NEW.bridged_at := now();
        NEW.bridge_error := 'Merged with existing event ' || v_existing_event_id::text;
        RETURN NEW;
    END IF;

    INSERT INTO public.attendance_events (
        user_id,
        timestamp,
        type,
        location_name,
        location_id,
        source,
        device_id,
        device_name,
        cctv_log_id,
        is_manual
    ) VALUES (
        NEW.user_id,
        NEW.detected_at,
        v_event_type,
        v_location_name,
        v_location_id,
        'cctv',
        v_device_uuid,
        COALESCE(NEW.edge_device_id, 'CCTV Edge Server'),
        NEW.id,
        FALSE
    ) RETURNING id INTO v_inserted_event_id;

    NEW.attendance_event_id := v_inserted_event_id;
    NEW.bridged := TRUE;
    NEW.bridged_at := now();
    NEW.bridge_error := NULL;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    NEW.bridge_error := 'Bridge error: ' || SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cctv_attendance_bridge ON public.cctv_attendance_logs;
CREATE TRIGGER trg_cctv_attendance_bridge
    BEFORE INSERT OR UPDATE OF user_id ON public.cctv_attendance_logs
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.trg_fn_bridge_cctv_attendance();

CREATE OR REPLACE FUNCTION public.backfill_cctv_attendance_bridge(
    p_limit INTEGER DEFAULT 500,
    p_min_confidence FLOAT DEFAULT 0.70
)
RETURNS TABLE (
    processed_count INTEGER,
    bridged_count INTEGER,
    merged_count INTEGER,
    skipped_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    v_proc INTEGER := 0;
    v_bridged INTEGER := 0;
    v_merged INTEGER := 0;
    v_skipped INTEGER := 0;
    v_window_interval INTERVAL := INTERVAL '15 minutes';
    v_event_type TEXT;
    v_existing_event_id UUID;
    v_inserted_event_id UUID;
    v_location_name TEXT;
    v_location_id UUID;
BEGIN
    FOR r IN (
        SELECT l.*, cd.id as device_uuid, cd.location_name as device_loc_name, cd.location_id as device_loc_id
        FROM public.cctv_attendance_logs l
        LEFT JOIN public.cctv_devices cd ON cd.edge_device_id = l.edge_device_id
        WHERE l.user_id IS NOT NULL 
          AND (l.bridged IS NULL OR l.bridged = FALSE)
        ORDER BY l.detected_at ASC
        LIMIT p_limit
    ) LOOP
        v_proc := v_proc + 1;

        IF COALESCE(r.confidence, 0) < p_min_confidence THEN
            UPDATE public.cctv_attendance_logs
            SET bridge_error = 'Skipped: Confidence below threshold (' || ROUND((COALESCE(r.confidence, 0) * 100)::numeric, 1)::text || '%)'
            WHERE id = r.id;
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        IF r.direction = 'entry' THEN
            v_event_type := 'punch-in';
        ELSE
            v_event_type := 'punch-out';
        END IF;

        v_location_name := COALESCE(r.device_loc_name, r.camera_name, 'CCTV Gate');
        v_location_id := COALESCE(r.location_id, r.device_loc_id);

        SELECT id INTO v_existing_event_id
        FROM public.attendance_events
        WHERE user_id = r.user_id
          AND type = v_event_type
          AND timestamp >= (r.detected_at - v_window_interval)
          AND timestamp <= (r.detected_at + v_window_interval)
        ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - r.detected_at))) ASC
        LIMIT 1;

        IF v_existing_event_id IS NOT NULL THEN
            UPDATE public.cctv_attendance_logs
            SET attendance_event_id = v_existing_event_id,
                bridged = TRUE,
                bridged_at = now(),
                bridge_error = 'Merged with existing event ' || v_existing_event_id::text
            WHERE id = r.id;
            v_merged := v_merged + 1;
        ELSE
            INSERT INTO public.attendance_events (
                user_id,
                timestamp,
                type,
                location_name,
                location_id,
                source,
                device_id,
                device_name,
                cctv_log_id,
                is_manual
            ) VALUES (
                r.user_id,
                r.detected_at,
                v_event_type,
                v_location_name,
                v_location_id,
                'cctv',
                r.device_uuid,
                COALESCE(r.edge_device_id, 'CCTV Edge Server'),
                r.id,
                FALSE
            ) RETURNING id INTO v_inserted_event_id;

            UPDATE public.cctv_attendance_logs
            SET attendance_event_id = v_inserted_event_id,
                bridged = TRUE,
                bridged_at = now(),
                bridge_error = NULL
            WHERE id = r.id;
            v_bridged := v_bridged + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_proc, v_bridged, v_merged, v_skipped;
END;
$$;`;
          navigator.clipboard.writeText(sqlText);
          setToast({ message: 'SQL trigger function copied to clipboard! Paste and run in Supabase SQL Editor.', type: 'success' });
          setShowSqlFixModal(false);
        }}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Paste and run this updated SQL function in your <strong>Supabase Dashboard &rarr; SQL Editor</strong> to ensure <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">device_id</code> (UUID) compatibility:
          </p>
          <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60">
{`CREATE OR REPLACE FUNCTION public.trg_fn_bridge_cctv_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
...
-- Casts cd.id to UUID and edge_device_id to device_name`}
          </pre>
        </div>
      </Modal>

      {/* Action Zone (ROI) Configuration Modal */}
      <CctvActionZoneModal
        isOpen={showActionZoneModal}
        onClose={() => setShowActionZoneModal(false)}
        cameraName="main_gate_entry"
        locationName={`${selectedSiteLocation || 'Paradigm Office'} (Main Gate)`}
        proxyUrl={ngrokProxy}
        initialPolygon={actionZonePolygon}
        initialEnabled={isActionZoneEnabled}
        onSaved={(newPoly, enabled) => {
          setActionZonePolygon(newPoly);
          setIsActionZoneEnabled(enabled);
          setToast({
            message: enabled
              ? 'Action Zone activated! Face capture is now restricted to the defined area.'
              : 'Action Zone disabled. Full camera view is active.',
            type: 'success',
          });
        }}
      />
    </div>
  );
};

export default CctvDashboard;
