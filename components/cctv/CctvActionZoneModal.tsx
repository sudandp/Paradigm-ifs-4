import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
  Check, RotateCcw, AlertTriangle, CheckCircle2, Crosshair,
  Sliders, Move, Undo2, ChevronDown, ChevronLeft, ChevronRight,
  Target, Sparkles
} from 'lucide-react';

export interface ActionZonePoint {
  x: number;
  y: number;
}

export interface CctvActionZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraName: string;
  locationName?: string;
  proxyUrl?: string;
  initialPolygon?: ActionZonePoint[];
  initialEnabled?: boolean;
  onSaved?: (polygon: ActionZonePoint[], enabled: boolean) => void;
}

export const FIXED_POINTS_COUNT = 20;

export function resampleToFixed20Points(poly?: ActionZonePoint[]): ActionZonePoint[] {
  if (!poly || poly.length === 0) return PRESET_STAIRS_CORRIDOR_20P;
  if (poly.length === FIXED_POINTS_COUNT) return poly;
  if (poly.length < 3) return PRESET_STAIRS_CORRIDOR_20P;
  const n = poly.length;
  const edgeLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % n];
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    edgeLengths.push(d); total += d;
  }
  if (total === 0) return PRESET_STAIRS_CORRIDOR_20P;
  const result: ActionZonePoint[] = [];
  const step = total / FIXED_POINTS_COUNT;
  for (let k = 0; k < FIXED_POINTS_COUNT; k++) {
    const target = k * step;
    let acc = 0, found = false;
    for (let i = 0; i < n; i++) {
      const len = edgeLengths[i];
      if (acc + len >= target || i === n - 1) {
        const ratio = len > 0 ? Math.max(0, Math.min(1, (target - acc) / len)) : 0;
        const p1 = poly[i], p2 = poly[(i + 1) % n];
        result.push({ x: Math.round((p1.x + (p2.x - p1.x) * ratio) * 1000) / 1000, y: Math.round((p1.y + (p2.y - p1.y) * ratio) * 1000) / 1000 });
        found = true; break;
      }
      acc += len;
    }
    if (!found) result.push(poly[poly.length - 1]);
  }
  return result;
}

export const PRESET_STAIRS_CORRIDOR_20P: ActionZonePoint[] = [
  { x: 0.24, y: 0.70 }, { x: 0.27, y: 0.65 }, { x: 0.31, y: 0.60 }, { x: 0.35, y: 0.56 },
  { x: 0.40, y: 0.52 }, { x: 0.45, y: 0.48 }, { x: 0.49, y: 0.46 }, { x: 0.53, y: 0.46 },
  { x: 0.58, y: 0.50 }, { x: 0.64, y: 0.56 }, { x: 0.69, y: 0.62 }, { x: 0.74, y: 0.67 },
  { x: 0.71, y: 0.72 }, { x: 0.65, y: 0.76 }, { x: 0.58, y: 0.80 }, { x: 0.51, y: 0.83 },
  { x: 0.44, y: 0.85 }, { x: 0.37, y: 0.85 }, { x: 0.31, y: 0.81 }, { x: 0.26, y: 0.76 },
];
export const PRESET_DIAMOND_20P = resampleToFixed20Points([
  { x: 0.31, y: 0.66 }, { x: 0.48, y: 0.47 }, { x: 0.71, y: 0.65 }, { x: 0.39, y: 0.84 },
]);
export const PRESET_CENTER_GATE_20P = resampleToFixed20Points([
  { x: 0.22, y: 0.35 }, { x: 0.78, y: 0.35 }, { x: 0.85, y: 0.88 }, { x: 0.15, y: 0.88 },
]);
export const PRESET_OVAL_20P: ActionZonePoint[] = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2;
  return { x: Math.round((0.50 + 0.24 * Math.cos(a)) * 1000) / 1000, y: Math.round((0.65 + 0.19 * Math.sin(a)) * 1000) / 1000 };
});
export const PRESET_FULL_FRAME_20P = resampleToFixed20Points([
  { x: 0.05, y: 0.05 }, { x: 0.95, y: 0.05 }, { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 },
]);

const PRESETS = [
  { label: 'Stairs Contour', pts: PRESET_STAIRS_CORRIDOR_20P, recommended: true },
  { label: 'Diamond Corridor', pts: PRESET_DIAMOND_20P, recommended: false },
  { label: 'Center Gate', pts: PRESET_CENTER_GATE_20P, recommended: false },
  { label: 'Oval Area', pts: PRESET_OVAL_20P, recommended: false },
  { label: 'Full Frame', pts: PRESET_FULL_FRAME_20P, recommended: false },
];

function PresetMiniMap({ pts }: { pts: ActionZonePoint[] }) {
  const svgPts = pts.map(p => `${p.x * 44},${p.y * 28}`).join(' ');
  return (
    <svg viewBox="0 0 44 28" className="w-11 h-7 rounded flex-shrink-0" style={{ background: '#1a1a1a' }}>
      <polygon points={svgPts} fill="rgba(239,68,68,0.35)" stroke="#ef4444" strokeWidth="1" />
    </svg>
  );
}

export const CctvActionZoneModal: React.FC<CctvActionZoneModalProps> = ({
  isOpen, onClose, cameraName, proxyUrl,
  initialPolygon, initialEnabled = true, onSaved,
}) => {
  const [points, setPoints] = useState<ActionZonePoint[]>(PRESET_STAIRS_CORRIDOR_20P);
  const [prevPoints, setPrevPoints] = useState<ActionZonePoint[] | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [recentlyDroppedIdx, setRecentlyDroppedIdx] = useState<number | null>(null);
  const [activePinIdx, setActivePinIdx] = useState(0);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const hintDismissed = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setSaveSuccess(false); setErrorMessage(null); setDraggingIdx(null);
    setPrevPoints(null); setActivePinIdx(0); setShowPresetsDropdown(false);
    hintDismissed.current = false;
    if (!localStorage.getItem('cctv_zone_hint_seen')) setShowHint(true);

    if (initialPolygon && initialPolygon.length >= 3) {
      const pts = resampleToFixed20Points(initialPolygon);
      setPoints(pts); setIsEnabled(initialEnabled); return;
    }
    try {
      const cached = localStorage.getItem(`cctv_action_zone_${cameraName}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.polygon) && parsed.polygon.length >= 3) {
          setPoints(resampleToFixed20Points(parsed.polygon.map((p: any) => Array.isArray(p) ? { x: p[0], y: p[1] } : p)));
          setIsEnabled(parsed.enabled !== false); return;
        }
      }
    } catch { /* silent */ }
    setPoints(PRESET_STAIRS_CORRIDOR_20P); setIsEnabled(true);
  }, [isOpen, cameraName, initialPolygon, initialEnabled]);

  useEffect(() => {
    if (!showPresetsDropdown) return;
    const h = (e: MouseEvent) => { if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) setShowPresetsDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPresetsDropdown]);

  const dismissHint = () => {
    if (hintDismissed.current) return;
    hintDismissed.current = true; setShowHint(false);
    localStorage.setItem('cctv_zone_hint_seen', '1');
  };

  const getCoords = (e: React.PointerEvent): ActionZonePoint | null => {
    if (!containerRef.current) return null;
    const r = containerRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: Math.round(Math.max(0.01, Math.min(0.99, (e.clientX - r.left) / r.width)) * 1000) / 1000, y: Math.round(Math.max(0.01, Math.min(0.99, (e.clientY - r.top) / r.height)) * 1000) / 1000 };
  };

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dismissHint(); setPrevPoints([...points]); setDraggingIdx(idx); setActivePinIdx(idx); setRecentlyDroppedIdx(null);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    const c = getCoords(e);
    if (!c) return;
    setPoints(prev => { const n = [...prev]; n[draggingIdx] = c; return n; });
  }, [draggingIdx]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    const dropped = draggingIdx; setDraggingIdx(null); setRecentlyDroppedIdx(dropped);
    if (dropCheckRef.current) clearTimeout(dropCheckRef.current);
    dropCheckRef.current = setTimeout(() => setRecentlyDroppedIdx(null), 1800);
  }, [draggingIdx]);

  const handleUndo = useCallback(() => { if (prevPoints) { setPoints(prevPoints); setPrevPoints(null); } }, [prevPoints]);

  const applyPreset = (pts: ActionZonePoint[]) => {
    setPrevPoints([...points]); setPoints(pts); setShowPresetsDropdown(false); setActivePinIdx(0); setRecentlyDroppedIdx(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); return; }
      const step = e.shiftKey ? 0.02 : 0.005;
      const maps: Record<string, [keyof ActionZonePoint, number]> = { ArrowLeft: ['x', -step], ArrowRight: ['x', step], ArrowUp: ['y', -step], ArrowDown: ['y', step] };
      if (maps[e.key]) {
        e.preventDefault();
        const [ax, delta] = maps[e.key];
        setPoints(prev => prev.map((p, i) => i === activePinIdx ? { ...p, [ax]: Math.max(0.01, Math.min(0.99, p[ax] + delta)) } : p));
      } else if (e.key === 'Tab') { e.preventDefault(); setActivePinIdx(prev => (prev + (e.shiftKey ? -1 : 1) + FIXED_POINTS_COUNT) % FIXED_POINTS_COUNT); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, activePinIdx, handleUndo]);

  const handleSave = async () => {
    setIsSaving(true); setErrorMessage(null);
    try {
      const arr = points.map(p => [p.x, p.y]);
      localStorage.setItem(`cctv_action_zone_${cameraName}`, JSON.stringify({ cameraName, polygon: arr, enabled: isEnabled, updatedAt: new Date().toISOString() }));
      const base = (proxyUrl || '').replace(/\/$/, '');
      if (base) { try { await fetch(`${base}/camera/action-zone/${encodeURIComponent(cameraName)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ polygon: isEnabled ? arr : [], enabled: isEnabled }) }); } catch { /* ok */ } }
      try {
        const { data: dev } = await supabase.from('cctv_devices').select('id, action_zones').limit(1).maybeSingle();
        if (dev) { await supabase.from('cctv_devices').update({ action_zones: { ...(dev.action_zones || {}), [cameraName]: { polygon: isEnabled ? arr : [], enabled: isEnabled, updated_at: new Date().toISOString() } }, updated_at: new Date().toISOString() }).eq('id', dev.id); }
      } catch { /* ok */ }
      setSaveSuccess(true); if (onSaved) onSaved(points, isEnabled); setTimeout(onClose, 900);
    } catch (err: any) { setErrorMessage(err.message || 'Failed to save'); } finally { setIsSaving(false); }
  };

  const polygonSvgPoints = points.map(p => `${p.x * 100},${p.y * 100}`).join(' ');
  const base = (proxyUrl || 'https://cctv.cctv.rest').replace(/\/$/, '');
  const streamUrl = `${base}/camera/stream/${encodeURIComponent(cameraName)}?key=az&ngrok-skip-browser-warning=1`;
  const isDragging = draggingIdx !== null;
  const activePt = points[activePinIdx];

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-5xl">
      <div className="flex flex-col gap-0 -mt-2">

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 shadow-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary-text leading-none">Face Capture Action Zone</h2>
              <p className="text-[11px] text-muted mt-0.5">Drag any numbered pin to define where faces are detected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zone ON/OFF pill */}
            <button type="button" onClick={() => setIsEnabled(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isEnabled ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-muted border-border'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-white animate-pulse' : 'bg-neutral-400'}`} />
              {isEnabled ? 'Zone ON' : 'Zone OFF'}
            </button>
            {/* Undo */}
            <button type="button" onClick={handleUndo} disabled={!prevPoints} title="Undo last drag (Ctrl+Z)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-border bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Undo2 className="h-3.5 w-3.5 text-amber-500" />Undo
            </button>
            {/* Presets dropdown */}
            <div className="relative" ref={presetsRef}>
              <button type="button" onClick={() => setShowPresetsDropdown(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-border bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all">
                <Sliders className="h-3.5 w-3.5 text-emerald-500" />Presets
                <ChevronDown className={`h-3 w-3 transition-transform ${showPresetsDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showPresetsDropdown && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border bg-white dark:bg-neutral-900 shadow-xl p-1.5 space-y-0.5">
                  {PRESETS.map(p => (
                    <button key={p.label} type="button" onClick={() => applyPreset(p.pts)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left">
                      <PresetMiniMap pts={p.pts} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary-text leading-none">{p.label}</p>
                        {p.recommended && <span className="text-[9.5px] font-bold text-rose-500 flex items-center gap-0.5 mt-0.5"><Sparkles className="h-2.5 w-2.5" /> Recommended</span>}
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-border pt-1 mt-1">
                    <button type="button" onClick={() => { setPrevPoints([...points]); setPoints(PRESET_STAIRS_CORRIDOR_20P); setShowPresetsDropdown(false); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left">
                      <RotateCcw className="h-3.5 w-3.5 text-rose-500" />
                      <span className="text-xs font-semibold text-primary-text">Reset All Pins</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Canvas */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-neutral-800 bg-black shadow-xl select-none" style={{ aspectRatio: '16/9' }}>
          <div ref={containerRef} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            className={`w-full h-full relative ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}>
            <img src={streamUrl} alt="Camera" draggable={false} className="w-full h-full object-cover pointer-events-none block" />

            {/* CSS animations */}
            <style>{`
              @keyframes az-dash { to { stroke-dashoffset: -40; } }
              @keyframes az-ping { 0%,100%{opacity:.8;transform:translate(-50%,-50%) scale(1)} 50%{opacity:.3;transform:translate(-50%,-50%) scale(1.6)} }
              @keyframes az-check { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 70%{opacity:1;transform:translate(-50%,-50%) scale(1.05)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.7)} }
            `}</style>

            {/* SVG polygon overlay */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <defs>
                <mask id="az-excl">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <polygon points={polygonSvgPoints} fill="black" />
                </mask>
              </defs>
              {isEnabled && (
                <>
                  <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.50)" mask="url(#az-excl)" />
                  <polygon points={polygonSvgPoints} fill="rgba(16,185,129,0.10)" />
                  <polygon points={polygonSvgPoints} fill="none" stroke="#ef4444" strokeWidth="0.7" strokeDasharray="2.5,1.5" style={{ animation: 'az-dash 8s linear infinite' }} />
                </>
              )}
            </svg>

            {/* Draggable Pins */}
            {isEnabled && points.map((p, idx) => {
              const isAct = draggingIdx === idx;
              const isHov = hoveredIdx === idx && !isDragging;
              const isDrop = recentlyDroppedIdx === idx;
              const isNav = activePinIdx === idx && !isDragging && !isAct;
              const size = isAct ? 28 : isHov ? 26 : isNav ? 24 : 20;

              return (
                <div key={idx}
                  onPointerDown={e => handlePointerDown(idx, e)}
                  onPointerEnter={() => { if (!isDragging) setHoveredIdx(idx); }}
                  onPointerLeave={() => { if (!isDragging) setHoveredIdx(null); }}
                  style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%,-50%)', zIndex: isAct ? 50 : isHov ? 40 : 30, cursor: isAct ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
                >
                  {/* Pulse ring */}
                  {(isHov || isAct) && (
                    <span style={{ position: 'absolute', top: '50%', left: '50%', width: 36, height: 36, borderRadius: '50%', background: isAct ? 'rgba(251,191,36,0.28)' : 'rgba(239,68,68,0.22)', animation: 'az-ping 1.2s ease-in-out infinite', pointerEvents: 'none' }} />
                  )}
                  {/* Pin */}
                  <div style={{
                    width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isAct ? 10 : 9, fontWeight: 800, fontFamily: 'monospace',
                    border: isAct ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.85)',
                    background: isAct ? '#fbbf24' : isHov ? '#f87171' : isNav ? '#fb923c' : '#ef4444',
                    color: isAct ? '#000' : '#fff',
                    boxShadow: isAct ? '0 0 0 3px rgba(251,191,36,0.55), 0 4px 14px rgba(0,0,0,0.6)' : isHov ? '0 0 0 2px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.5)',
                    transition: 'all 0.14s cubic-bezier(.34,1.56,.64,1)',
                    transform: isAct ? 'scale(1.1)' : 'scale(1)',
                  }}>
                    {idx + 1}
                  </div>
                  {/* Coordinate tooltip while dragging */}
                  {isAct && (
                    <div style={{ position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.92)', color: '#fbbf24', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(251,191,36,0.3)', pointerEvents: 'none' }}>
                      P{idx + 1} · {Math.round(p.x * 100)}%, {Math.round(p.y * 100)}%
                    </div>
                  )}
                  {/* Drop green check */}
                  {isDrop && !isAct && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', animation: 'az-check 1.8s ease forwards', pointerEvents: 'none', zIndex: 60 }}>
                      <div style={{ background: '#10b981', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 0 0 2px rgba(16,185,129,0.45)' }}>
                        <Check style={{ width: 12, height: 12, color: 'white', strokeWidth: 3 }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* First-open onboarding hint */}
            {showHint && (
              <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.58)' }}>
                <div className="flex flex-col items-center gap-3">
                  <div style={{ fontSize: 40, animation: 'bounce 1s infinite' }}>☝️</div>
                  <div className="text-center px-7 py-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                    <p className="text-white font-bold text-base">Drag any numbered pin</p>
                    <p className="text-white/80 text-sm mt-0.5">to shape your face detection zone</p>
                  </div>
                  <button onClick={dismissHint} className="text-white/60 text-xs underline mt-1">Got it, dismiss</button>
                </div>
              </div>
            )}

            {/* Top status bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-rose-400 animate-pulse' : 'bg-neutral-500'}`} />
                  {isEnabled ? 'ZONE ACTIVE' : 'ZONE OFF'}
                </span>
                {isDragging && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-amber-300" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <Move className="h-3 w-3" />Dragging P{draggingIdx! + 1}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-neutral-300 px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.6)' }}>20 PINS</span>
            </div>

            {/* Bottom instruction hint */}
            {!isDragging && !showHint && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-white" style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <Move className="h-3 w-3 text-amber-400" />
                  Drag any pin to adjust · Arrow keys to nudge · Ctrl+Z to undo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Active Pin Navigator */}
        <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border border-border bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-extrabold font-mono shadow-sm flex-shrink-0"
              style={{ background: isDragging && draggingIdx === activePinIdx ? '#fbbf24' : '#ef4444', color: isDragging && draggingIdx === activePinIdx ? '#000' : '#fff' }}>
              {activePinIdx + 1}
            </div>
            <span className="text-xs font-bold text-primary-text whitespace-nowrap">Pin P{activePinIdx + 1}</span>
          </div>
          <div className="flex-1 font-mono text-xs text-muted">
            X: <span className="text-primary-text font-bold">{Math.round(activePt.x * 100)}%</span>
            &nbsp;&nbsp;Y: <span className="text-primary-text font-bold">{Math.round(activePt.y * 100)}%</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-white dark:bg-neutral-800 text-[10px] font-mono">Tab</kbd>
            <span>step</span>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-white dark:bg-neutral-800 text-[10px] font-mono">↑↓←→</kbd>
            <span>nudge</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setActivePinIdx(prev => (prev - 1 + FIXED_POINTS_COUNT) % FIXED_POINTS_COUNT)} title="Previous pin" className="p-1 rounded-lg border border-border hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-muted" />
            </button>
            <button type="button" onClick={() => setActivePinIdx(prev => (prev + 1) % FIXED_POINTS_COUNT)} title="Next pin" className="p-1 rounded-lg border border-border hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-muted" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-2 p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />{errorMessage}
          </div>
        )}
        {saveSuccess && (
          <div className="mt-2 p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />Action Zone saved and activated!
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">Zone polygon is hidden on live stream — only active inside the AI detection engine</p>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 flex items-center gap-2 shadow-sm">
              {isSaving ? 'Saving…' : saveSuccess ? <><Check className="h-4 w-4" />Saved!</> : <><Crosshair className="h-4 w-4" />Save Zone</>}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CctvActionZoneModal;
