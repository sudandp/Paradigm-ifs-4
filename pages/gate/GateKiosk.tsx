/**
 * GateKiosk.tsx — Full-screen kiosk-style attendance gate
 * Supports Face Recognition, QR Scan, and Manual check-in.
 * Designed for a single mounted phone/tablet running in browser.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useGateStore } from '../../store/gateStore';
import {
  fetchGateUsers, markGateAttendance, lookupByQrToken, uploadGatePhoto, reportKioskHeartbeat, fetchKioskLocations, fetchKioskDevices,
} from '../../services/gateApi';
import { useKioskTelemetry } from '../../hooks/useKioskTelemetry';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { KioskPlugin } from '../../plugins/KioskPlugin';
import { useNavigate } from 'react-router-dom';
import type { GateUser, GateScanResult, GateMode } from '../../types/gate';
import type { AttendanceEventType, Location } from '../../types/attendance';
import { ScanLine, User, QrCode, Camera, Shield, Lock, Unlock, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Loader2, Search, Settings, LogIn, LogOut, Coffee, MapPin, ArrowLeft, Copy } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const FACE_MATCH_THRESHOLD = 0.45; // Euclidean distance — lower = stricter
const SCAN_INTERVAL_MS = 1500; // Throttle face inference to ~0.67 fps
const RESULT_DISPLAY_MS = 3000; // Show result overlay for 3 seconds
const QR_SCAN_INTERVAL_MS = 500;
const FACE_SYNC_INTERVAL_MS = 5 * 60 * 1000; // Re-sync face descriptors every 5 min

// ─── Euclidean distance between two descriptor vectors ──────────────
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ─── Time formatting helper ─────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

const GateKiosk: React.FC = () => {
  const {
    activeMode, setActiveMode,
    registeredFaces, setRegisteredFaces,
    isDuplicate, addRecentScan, clearExpiredScans,
    currentResult, setCurrentResult,
    isProcessing, setProcessing,
    todayLogs, addLog,
    isKioskLocked, setKioskLocked, kioskPin,
    assignedLocationId, assignedLocationName, setAssignedLocation,
    deviceId, locationName, setDeviceId, setLocationName,
    isKioskMode, setKioskMode
  } = useGateStore();

  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [manualSearch, setManualSearch] = useState('');
  const [manualSelected, setManualSelected] = useState<GateUser | null>(null);
  const [qrScanner, setQrScanner] = useState<any>(null);

  // Settings & Action state
  const [showSettings, setShowSettings] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [kioskDevices, setKioskDevices] = useState<any[]>([]);
  const [selectedAction, setSelectedAction] = useState<AttendanceEventType | null>(null);

  const telemetry = useKioskTelemetry();

  // Background Hardware Telemetry Heartbeat (reporting every 2 minutes)
  useEffect(() => {
    if (!deviceId) return;

    const sendHeartbeat = () => {
      reportKioskHeartbeat(deviceId, {
        batteryPercentage: telemetry.batteryPercentage,
        ipAddress: telemetry.ipAddress,
        signalStrength: telemetry.signalStrength,
      });
    };

    // Send immediately on assignment/load
    sendHeartbeat();

    const t = setInterval(sendHeartbeat, 120_000);
    return () => clearInterval(t);
  }, [deviceId, telemetry.batteryPercentage, telemetry.ipAddress, telemetry.signalStrength]);

  // Realtime Device & Location Sync
  useEffect(() => {
    let channel: any = null;

    const initDeviceSync = async () => {
      const { deviceId: nativeId } = await KioskPlugin.getDeviceId();
      setDeviceId(nativeId);

      // Load offline location fallback first
      const cachedLocName = localStorage.getItem('kiosk_last_location_name');
      const cachedLocId = localStorage.getItem('kiosk_last_location_id');
      if (cachedLocName && cachedLocId && !locationName) {
        setLocationName(cachedLocName);
        setAssignedLocation(cachedLocId, cachedLocName);
      }

      // Upsert to DB to register device and update heartbeat
      await supabase.from('kiosk_devices').upsert({
        device_id: nativeId,
        is_active: true,
        last_heartbeat: new Date().toISOString()
      }, { onConflict: 'device_id' });

      // Subscribe to Realtime for location updates from Admin
      channel = supabase
        .channel('kiosk-device')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'kiosk_devices',
          filter: `device_id=eq.${nativeId}`
        }, (payload: any) => {
          if (payload.new && payload.new.location_name) {
            console.log('[KioskSync] Remote location update received:', payload.new.location_name);
            setLocationName(payload.new.location_name);
            setAssignedLocation(payload.new.location_id, payload.new.location_name);
            
            // Persist for offline resilience
            localStorage.setItem('kiosk_last_location_name', payload.new.location_name);
            localStorage.setItem('kiosk_last_location_id', payload.new.location_id);
          }
        })
        .subscribe();
    };

    initDeviceSync();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [setDeviceId, setLocationName, setAssignedLocation]);

  useEffect(() => {
    fetchKioskDevices()
      .then((devices) => {
        setKioskDevices(devices);
      })
      .catch((err) => {
        console.error('[GateKiosk] Failed to load kiosk devices:', err);
      });
  }, []);

  // Keep clock ticking
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Clean expired duplicate entries periodically
  useEffect(() => {
    const t = setInterval(clearExpiredScans, 30_000);
    return () => clearInterval(t);
  }, [clearExpiredScans]);

  // ─── Load face-api.js models ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const faceapi = await import('face-api.js');
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (!cancelled) setFaceApiLoaded(true);
        console.log('[GateKiosk] face-api.js models loaded');
      } catch (err) {
        console.error('[GateKiosk] Failed to load face-api models:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Sync registered faces from Supabase ──────────────────────────
  const syncFaces = useCallback(async () => {
    try {
      const users = await fetchGateUsers();
      setRegisteredFaces(users);
      console.log(`[GateKiosk] Synced ${users.length} registered faces`);
    } catch (err) {
      console.error('[GateKiosk] Failed to sync faces:', err);
    }
  }, [setRegisteredFaces]);

  useEffect(() => {
    syncFaces();
    syncTimerRef.current = setInterval(syncFaces, FACE_SYNC_INTERVAL_MS);
    return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
  }, [syncFaces]);

  // ─── Camera Start / Stop ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('[GateKiosk] Camera error:', err);
      setCameraError(err.message || 'Camera access denied');
    }
  }, []);

  const stopCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (e) {}
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch (e) {}
      }
    } catch (err) {
      console.warn('[GateKiosk] Error in stopCamera:', err);
    }
  }, []);

  useEffect(() => {
    if (!isKioskLocked && selectedAction && activeMode === 'face') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isKioskLocked, selectedAction, activeMode, startCamera, stopCamera]);

  // ─── Show result overlay, then auto-clear ─────────────────────────
  const showResult = useCallback((result: GateScanResult) => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setCurrentResult(result);
    resultTimerRef.current = setTimeout(() => setCurrentResult(null), RESULT_DISPLAY_MS);
  }, [setCurrentResult]);

  // ─── Handle successful match ──────────────────────────────────────
  const handleMatch = useCallback(async (user: GateUser, method: GateMode, confidence?: number) => {
    if (!selectedAction) return;

    if (isDuplicate(user.userId)) {
      showResult({
        success: false, method,
        userId: user.userId, userName: user.userName,
        userPhotoUrl: user.userPhotoUrl,
        message: 'Already marked within the last 5 minutes',
        alreadyMarked: true,
      });
      return;
    }

    setProcessing(true);
    try {
      const log = await markGateAttendance({
        userId: user.userId,
        gateUserId: user.id,
        method,
        confidence,
      });
      addRecentScan({
        userId: user.userId,
        userName: user.userName || 'Unknown',
        userPhotoUrl: user.userPhotoUrl,
        method,
        timestamp: Date.now(),
      });
      addLog({ ...log, userName: user.userName, userPhotoUrl: user.userPhotoUrl, department: user.department });

      // Dual Logging: Send to main attendance module
      try {
        const matchingDevice = kioskDevices.find(d => d.locationId === assignedLocationId);
        await api.addAttendanceEvent({
          userId: user.userId,
          type: selectedAction,
          timestamp: new Date().toISOString(),
          locationId: assignedLocationId,
          locationName: assignedLocationName,
          deviceId: matchingDevice ? matchingDevice.id : undefined,
          deviceName: matchingDevice ? (matchingDevice.deviceModel || matchingDevice.deviceName) : undefined,
          source: 'gate-kiosk',
          isManual: false,
        });
      } catch (err) {
        console.warn('[GateKiosk] Failed to add main attendance event', err);
      }

      showResult({
        success: true, method,
        userId: user.userId, userName: user.userName,
        userPhotoUrl: user.userPhotoUrl,
        department: user.department,
        confidence,
        message: `Welcome, ${user.userName}!`,
      });
      setSelectedAction(null); // Reset for the next person
    } catch (err: any) {
      showResult({ success: false, method, message: err.message || 'Failed to mark attendance' });
    } finally {
      setProcessing(false);
    }
  }, [isDuplicate, showResult, addRecentScan, addLog, setProcessing, selectedAction, assignedLocationId, assignedLocationName]);

  // ─── Face scanning loop ───────────────────────────────────────────
  useEffect(() => {
    if (activeMode !== 'face' || !faceApiLoaded || isKioskLocked || !selectedAction) return;

    const runFaceScan = async () => {
      if (!videoRef.current || videoRef.current.paused || isProcessing || currentResult) return;
      try {
        const faceapi = await import('face-api.js');
        const detections = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!detections) return;
        const queryDescriptor = Array.from(detections.descriptor);

        // Find best match from registered faces
        let bestMatch: GateUser | null = null;
        let bestDistance = Infinity;
        for (const user of registeredFaces) {
          if (!user.faceDescriptor || user.faceDescriptor.length !== 128) continue;
          const distance = euclideanDistance(queryDescriptor, user.faceDescriptor);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = user;
          }
        }

        if (bestMatch && bestDistance < FACE_MATCH_THRESHOLD) {
          const confidence = Math.max(0, 1 - bestDistance);
          await handleMatch(bestMatch, 'face', confidence);
        }
      } catch (err) {
        // Silently ignore per-frame errors to keep scanning
      }
    };

    scanTimerRef.current = setInterval(runFaceScan, SCAN_INTERVAL_MS);
    return () => { if (scanTimerRef.current) clearInterval(scanTimerRef.current); };
  }, [activeMode, faceApiLoaded, isKioskLocked, registeredFaces, isProcessing, currentResult, handleMatch, selectedAction]);

  // ─── QR scanning loop ────────────────────────────────────────────
  useEffect(() => {
    if (activeMode !== 'qr' || isKioskLocked || !selectedAction) return;
    let html5QrCode: any = null;
    let mounted = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('gate-qr-reader');
        setQrScanner(html5QrCode);

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 2, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            if (!mounted || isProcessing || currentResult) return;
            // Lookup QR token
            const user = await lookupByQrToken(decodedText.trim());
            if (user) {
              await handleMatch(user, 'qr');
            } else {
              showResult({ success: false, method: 'qr', message: 'Unknown QR code — user not registered' });
            }
          },
          () => {} // ignore scan failures
        );
      } catch (err) {
        console.error('[GateKiosk] QR scanner error:', err);
      }
    })();

    return () => {
      mounted = false;
      if (html5QrCode) {
        html5QrCode.stop()
          .then(() => {
            try { html5QrCode.clear(); } catch (e) {}
          })
          .catch((err: any) => {
            console.warn('[GateKiosk] QR stop error:', err);
            try { html5QrCode.clear(); } catch (e) {}
          });
      }
    };
  }, [activeMode, isKioskLocked, isProcessing, currentResult, handleMatch, showResult, selectedAction]);

  // ─── Manual check-in handler ──────────────────────────────────────
  const handleManualCheckIn = useCallback(async () => {
    if (!manualSelected || !selectedAction) return;
    await handleMatch(manualSelected, 'manual');
    setManualSelected(null);
    setManualSearch('');
  }, [manualSelected, selectedAction, handleMatch]);

  // Resolve active PIN: if a location is assigned and has a kioskPin, use it; otherwise fallback to local store's kioskPin
  const activePin = useMemo(() => {
    if (assignedLocationId) {
      const activeLoc = locations.find(l => l.id === assignedLocationId);
      if (activeLoc?.kioskPin) return activeLoc.kioskPin;
    }
    return kioskPin || '1234';
  }, [assignedLocationId, locations, kioskPin]);

  // ─── PIN unlock ───────────────────────────────────────────────────
  const handlePinSubmit = () => {
    if (pinInput === activePin) {
      setKioskLocked(false);
      setPinInput('');
    } else {
      setPinInput('');
    }
  };

  // ─── Filtered users for manual mode (token-based smart search) ────
  const filteredUsers = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    if (query.length < 2) return [];

    const queryTokens = query.split(/\s+/).filter(Boolean);

    return registeredFaces.filter((u) => {
      const name = (u.userName || '').toLowerCase();
      const email = (u.userEmail || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();

      // Every word typed must be present in either name, email, or department
      return queryTokens.every((token) =>
        name.includes(token) || email.includes(token) || dept.includes(token)
      );
    }).slice(0, 8);
  }, [manualSearch, registeredFaces]);

  // ═══════════════════ RENDER ═══════════════════════════════════════

  // Lock screen
  if (isKioskLocked) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #041b0f 0%, #0a3d1f 50%, #041b0f 100%)' }}>
        <div className="flex flex-col items-center gap-6 max-w-xs w-full px-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
            <Lock className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center">Gate Attendance</h1>
          <p className="text-emerald-300/60 text-sm text-center">Enter PIN to unlock kiosk mode</p>
          <input
            type="password"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.5em] py-4 rounded-2xl bg-white/5 border border-emerald-500/20 text-white placeholder-emerald-500/30 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
          <button onClick={handlePinSubmit}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
            <Unlock className="w-5 h-5" /> Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: '#041b0f' }}>
      {/* ─── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(180deg, rgba(4,27,15,0.95) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span className="text-white font-bold text-base">Gate Attendance</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-300/70 text-xs font-mono">{formatTime(currentTime)}</span>
          <span className="text-emerald-400/40 text-xs">{registeredFaces.length} users synced</span>
          {!isKioskLocked && (
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
              <Settings className="w-4 h-4 text-emerald-400/60" />
            </button>
          )}
          <button onClick={() => setKioskLocked(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            <Lock className="w-4 h-4 text-emerald-400/60" />
          </button>
        </div>
      </div>

      {/* ─── Mode Tabs ───────────────────────────────────────────── */}
      {selectedAction && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 relative">
          <button onClick={() => setSelectedAction(null)} className="absolute left-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-emerald-400/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {(['face', 'qr', 'manual'] as GateMode[]).map((mode) => {
          const icons = { face: User, qr: QrCode, manual: Camera };
          const labels = { face: 'Face ID', qr: 'QR Scan', manual: 'Manual' };
          const Icon = icons[mode];
          const isActive = activeMode === mode;
          return (
            <button key={mode}
              onClick={() => setActiveMode(mode)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-emerald-300/60 hover:bg-white/10'
              }`}>
              <Icon className="w-4 h-4" />
              {labels[mode]}
            </button>
          );
        })}
        </div>
      )}

      {/* ─── Main Area ───────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!selectedAction ? (
          <div className="w-full max-w-2xl px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <h2 className="col-span-full text-center text-white text-2xl font-bold mb-4">Select Action</h2>
            {([
              { id: 'punch-in', icon: LogIn, label: 'Punch In', color: 'bg-emerald-500' },
              { id: 'punch-out', icon: LogOut, label: 'Punch Out', color: 'bg-emerald-600' },
              { id: 'break-in', icon: Coffee, label: 'Break In', color: 'bg-amber-500' },
              { id: 'break-out', icon: Coffee, label: 'Break Out', color: 'bg-amber-600' },
              { id: 'site-in', icon: MapPin, label: 'Site In', color: 'bg-blue-500' },
              { id: 'site-out', icon: MapPin, label: 'Site Out', color: 'bg-blue-600' },
              { id: 'site-ot-in', icon: MapPin, label: 'Site OT In', color: 'bg-purple-500' },
              { id: 'site-ot-out', icon: MapPin, label: 'Site OT Out', color: 'bg-purple-600' },
            ] as const).map(action => {
              const Icon = action.icon;
              return (
                <button key={action.id} onClick={() => setSelectedAction(action.id as AttendanceEventType)}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl transition-all hover:scale-105 shadow-lg ${action.color} text-white`}>
                  <Icon className="w-8 h-8" />
                  <span className="font-bold text-base">{action.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Camera feed — always mounted for face mode */}
            {activeMode === 'face' && (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay
              style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} className="hidden" />
            {/* Face scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-80 border-2 border-emerald-400/40 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-emerald-400 rounded-tl-3xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-emerald-400 rounded-tr-3xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-emerald-400 rounded-bl-3xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-emerald-400 rounded-br-3xl" />
                {/* Animated scan line */}
                <div className="absolute left-2 right-2 h-0.5 bg-emerald-400/60 rounded-full"
                  style={{ animation: 'scanLine 2s ease-in-out infinite', top: '30%' }} />
              </div>
            </div>
            {!faceApiLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                <p className="text-white font-semibold">Loading Face Recognition...</p>
              </div>
            )}
          </>
        )}

        {activeMode === 'qr' && (
          <div className="w-full h-full flex items-center justify-center">
            <div id="gate-qr-reader" className="w-full max-w-sm" />
          </div>
        )}

        {activeMode === 'manual' && (
          <div className="w-full max-w-md mx-auto px-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <User className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-emerald-300/60 text-sm">Search and select an employee</p>
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500/30 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="text" value={manualSearch}
                onChange={(e) => { setManualSearch(e.target.value); setManualSelected(null); }}
                placeholder="Type name or email..."
                className="w-full h-12 bg-white/5 border border-emerald-500/20 rounded-2xl pl-12 pr-4 text-base text-white placeholder-emerald-500/30 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all"
              />
            </div>
            {filteredUsers.length > 0 && !manualSelected && (
              <div className="w-full max-h-60 overflow-y-auto rounded-2xl bg-white/5 border border-emerald-500/10 divide-y divide-emerald-500/10">
                {filteredUsers.map((u) => (
                  <button key={u.id} onClick={() => { setManualSelected(u); setManualSearch(u.userName || ''); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left">
                    {u.userPhotoUrl
                      ? <img src={u.userPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/20" />
                      : <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><User className="w-5 h-5 text-emerald-400" /></div>
                    }
                    <div>
                      <p className="text-white text-sm font-semibold">{u.userName}</p>
                      <p className="text-emerald-300/50 text-xs">{u.department || u.userEmail}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {manualSelected && (
              <button onClick={handleManualCheckIn}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 mt-2">
                <CheckCircle2 className="w-5 h-5" /> Mark Attendance for {manualSelected.userName}
              </button>
            )}
          </div>
        )}

        {/* Camera error */}
        {cameraError && activeMode === 'face' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <XCircle className="w-12 h-12 text-red-400 mb-3" />
            <p className="text-white font-semibold mb-1">Camera Unavailable</p>
            <p className="text-red-300/60 text-sm text-center max-w-xs">{cameraError}</p>
            <button onClick={startCamera} className="mt-4 px-6 py-2 rounded-xl bg-emerald-500 text-white font-semibold">Retry</button>
          </div>
        )}
          </>
        )}
      </div>

      {/* ─── Result Overlay ──────────────────────────────────────── */}
      {currentResult && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center transition-all ${
          currentResult.success ? 'bg-emerald-900/90' : currentResult.alreadyMarked ? 'bg-amber-900/90' : 'bg-red-900/90'
        }`} style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="flex flex-col items-center gap-4 max-w-sm px-6 text-center">
            {currentResult.success ? (
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
              </div>
            ) : currentResult.alreadyMarked ? (
              <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-14 h-14 text-amber-400" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-14 h-14 text-red-400" />
              </div>
            )}
            {currentResult.userPhotoUrl && (
              <img src={currentResult.userPhotoUrl} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-white/20" />
            )}
            <h2 className="text-white text-2xl font-bold">{currentResult.message}</h2>
            {currentResult.department && <p className="text-white/60 text-sm">{currentResult.department}</p>}
            {currentResult.confidence !== undefined && (
              <p className="text-emerald-300/50 text-xs">Confidence: {(currentResult.confidence * 100).toFixed(1)}%</p>
            )}
            <p className="text-white/40 text-xs">{formatTime(new Date())} • via {currentResult.method.toUpperCase()}</p>
          </div>
        </div>
      )}

      {/* ─── Bottom: Recent Entries ──────────────────────────────── */}
      <div className="px-4 py-3 border-t border-emerald-500/10" style={{ background: 'rgba(4,27,15,0.95)', maxHeight: '140px', overflowY: 'auto' }}>
        <p className="text-emerald-300/40 text-xs font-semibold uppercase mb-2">Recent Entries</p>
        {todayLogs.length === 0 ? (
          <p className="text-emerald-300/20 text-xs">No entries yet today</p>
        ) : (
          <div className="flex flex-col gap-1">
            {todayLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-1.5">
                {log.userPhotoUrl
                  ? <img src={log.userPhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                  : <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center"><User className="w-3.5 h-3.5 text-emerald-400" /></div>
                }
                <span className="text-white text-xs font-medium flex-1 truncate">{log.userName || 'Unknown'}</span>
                <span className="text-emerald-300/40 text-xs uppercase">{log.method}</span>
                <span className="text-emerald-300/30 text-xs font-mono">{formatTime(new Date(log.markedAt))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Settings Modal ──────────────────────────────────────── */}
      {showSettings && (
        <div className="absolute inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-emerald-950 border border-emerald-500/20 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-emerald-400" /> Kiosk Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full text-emerald-300/50 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="bg-black/20 rounded-2xl p-4 border border-emerald-500/10">
                <label className="text-emerald-300/60 text-xs font-semibold uppercase mb-2 block tracking-wider">Device ID</label>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white font-mono text-sm break-all">{deviceId || 'Unknown'}</span>
                  <button 
                    onClick={() => {
                      if (deviceId) {
                        navigator.clipboard.writeText(deviceId);
                        alert('Device ID copied to clipboard');
                      }
                    }}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors shrink-0"
                    title="Copy Device ID"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-emerald-300/40 text-[10px] mt-2 leading-relaxed">Share this ID with an Administrator to link this device to a gate location.</p>
              </div>

              <div className="bg-black/20 rounded-2xl p-4 border border-emerald-500/10">
                <label className="text-emerald-300/60 text-xs font-semibold uppercase mb-1 block tracking-wider">Current Location</label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-semibold">{locationName || 'Unassigned'}</span>
                </div>
                <p className="text-emerald-300/40 text-[10px] mt-2 leading-relaxed">Location is managed remotely via the Admin Dashboard. Real-time updates active.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <button 
                onClick={async () => {
                  const pin = window.prompt('Enter Admin PIN to exit Kiosk Mode:');
                  if (!pin) return;
                  
                  // Verify against app_config (or default 1234)
                  const { data } = await supabase.from('app_config').select('config_value').eq('config_key', 'kiosk_admin_pin').maybeSingle();
                  const validPin = data?.config_value || '1234';
                  
                  if (pin === validPin) {
                    await KioskPlugin.stopLockTask();
                    setKioskMode(false);
                    setShowSettings(false);
                    // Redirect to login or profile
                    navigate('/auth/login', { replace: true });
                  } else {
                    alert('Invalid PIN');
                  }
                }}
                className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" /> Exit Kiosk Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CSS Animations ──────────────────────────────────────── */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 15%; opacity: 0.3; }
          50% { top: 75%; opacity: 0.8; }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        #gate-qr-reader video {
          border-radius: 1rem !important;
        }
      `}</style>
    </div>
  );
};

export default GateKiosk;
