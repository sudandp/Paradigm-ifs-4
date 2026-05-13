/**
 * GateKiosk.tsx — Full-screen kiosk-style attendance gate
 * Supports QR Scan and Manual check-in.
 * Designed for a single mounted phone/tablet running in browser.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useGateStore } from '../../store/gateStore';
import {
  fetchGateUsers, markGateAttendance, lookupByQrToken, lookupByPasscode, uploadGatePhoto, reportKioskHeartbeat, fetchKioskLocations, fetchKioskDevices, reportSecurityLog,
} from '../../services/gateApi';
import { useKioskTelemetry } from '../../hooks/useKioskTelemetry';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { KioskPlugin } from '../../plugins/KioskPlugin';
import { useNavigate } from 'react-router-dom';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import type { GateUser, GateScanResult, GateMode } from '../../types/gate';
import type { AttendanceEventType, Location } from '../../types/attendance';
import { playFeedbackSound, initAudioContext } from '../../utils/audioFeedback';
import { useAuthStore } from '../../store/authStore';
import { isAdmin as checkIsAdmin } from '../../utils/auth';
import { ScanLine, User, QrCode, Camera, Shield, Lock, Unlock, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Loader2, Search, Settings, LogIn, LogOut, Coffee, MapPin, ArrowLeft, Copy, Hash, Delete, Eye } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const SCAN_INTERVAL_MS = 500; // Snappier detection as per requirements
const RESULT_DISPLAY_MS = 1500; // Faster turnover for queues
const QR_SCAN_INTERVAL_MS = 500;

// ─── Time formatting helper ─────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

const GateKiosk: React.FC = () => {
  const store = useGateStore();
  const {
    activeMode, setActiveMode,
    registeredUsers, setRegisteredUsers,
    addRecentScan, clearExpiredScans,
    currentResult, setCurrentResult,
    isProcessing, setProcessing,
    todayLogs, addLog,
    isKioskLocked, setKioskLocked, kioskPin,
    assignedLocationId, assignedLocationName, setAssignedLocation,
    deviceId, locationName, setDeviceId, setLocationName,
    isKioskMode, setKioskMode
  } = store;

  // Force isDuplicate to false for unrestricted testing
  const isDuplicate = () => false;

  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  // ─── RBAC: Ensure only Admin and Security roles can access ───
  useEffect(() => {
    if (!currentUser) return;
    
    const role = (currentUser.role || '').toLowerCase();
    const isSecurity = role.includes('security');
    const isAdmin = checkIsAdmin(currentUser.role);
    
    if (!isAdmin && !isSecurity) {
      console.warn('[GateKiosk] Unauthorized access attempt by:', currentUser.email);
      navigate('/forbidden', { replace: true });
    }
  }, [currentUser, navigate]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [manualSearch, setManualSearch] = useState('');
  const [manualSelected, setManualSelected] = useState<GateUser | null>(null);
  const [qrScanner, setQrScanner] = useState<any>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [isPasscodeError, setIsPasscodeError] = useState(false);

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
    let isCancelled = false;

    const initDeviceSync = async () => {
      let nativeId = 'web-kiosk-dev';

      if (Capacitor.isNativePlatform()) {
        try {
          const result = await KioskPlugin.getDeviceId();
          nativeId = result.deviceId;
        } catch (err) {
          console.warn('[GateKiosk] Native KioskPlugin.getDeviceId failed:', err);
        }
      } else {
        // Persistent Web Device ID fallback
        const cachedId = localStorage.getItem('kiosk_web_device_id');
        if (cachedId) {
          nativeId = cachedId;
        } else {
          nativeId = 'WEB-' + Math.random().toString(36).substring(2, 11).toUpperCase();
          localStorage.setItem('kiosk_web_device_id', nativeId);
        }
      }
      
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

      if (isCancelled) return;

      // Subscribe to Realtime for location updates from Admin
      const channelName = `kiosk-device-${nativeId}-${Math.random().toString(36).substring(2, 7)}`;
      const newChannel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'kiosk_devices',
          filter: `device_id=eq.${nativeId}`
        }, (payload: any) => {
          if (isCancelled) return;
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
      
      if (isCancelled) {
        supabase.removeChannel(newChannel);
      } else {
        channel = newChannel;
      }
    };

    initDeviceSync();

    return () => {
      isCancelled = true;
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

  // ─── Sync registered users from Supabase ──────────────────────────
  const syncUsers = useCallback(async () => {
    try {
      const users = await fetchGateUsers();
      setRegisteredUsers(users);
      console.log(`[GateKiosk] Synced ${users.length} users from database`);
    } catch (err) {
      console.error('[GateKiosk] Failed to sync users:', err);
    }
  }, [setRegisteredUsers]);

  useEffect(() => {
    syncUsers();
    const syncInterval = setInterval(syncUsers, 5 * 60 * 1000);

    const channel = supabase
      .channel(`gate-users-realtime-${Math.random().toString(36).substring(2, 7)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gate_users',
      }, () => {
        syncUsers();
      })
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [syncUsers]);

  const startCamera = useCallback(async () => {
    if (isKioskLocked) return;
    // Camera is only needed for proof photos in manual/passcode if desired,
    // but originally it was for face. QR scanner uses its own logic.
    // We'll keep it simple: no background camera for now.
  }, [isKioskLocked]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ─── Show result overlay, then auto-clear ─────────────────────────
  const showResult = useCallback((result: GateScanResult) => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setCurrentResult(result);

    // Audio feedback based on result
    if (result.success) {
      playFeedbackSound('success');
    } else if (result.alreadyMarked) {
      playFeedbackSound('warning');
    } else {
      playFeedbackSound('error');
    }

    resultTimerRef.current = setTimeout(() => setCurrentResult(null), RESULT_DISPLAY_MS);
  }, [setCurrentResult]);

  // ─── Handle successful match ──────────────────────────────────────
  const handleMatch = useCallback(async (user: GateUser, method: GateMode) => {
    setProcessing(true);
    try {
      const currentDevice = kioskDevices.find(d => d.deviceId === deviceId);
      const currentDeviceName = currentDevice ? (currentDevice.deviceName || currentDevice.deviceModel) : 'Samsung M07';

      const log = await markGateAttendance({
        userId: user.userId,
        gateUserId: user.id,
        method,
        action: selectedAction || 'punch_in', 
        deviceName: currentDeviceName,
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
          type: selectedAction || 'punch-in',
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
        message: `Welcome, ${user.userName}!`,
      });
      setSelectedAction(null); // Reset for the next person
    } catch (err: any) {
      if (err.message && err.message.includes('Duplicate attendance mark')) {
        showResult({ success: false, method, alreadyMarked: true, message: `Already checked in, ${user.userName}` });
      } else {
        showResult({ success: false, method, message: err.message || 'Failed to mark attendance' });
      }
    } finally {
      setProcessing(false);
    }
  }, [showResult, addRecentScan, addLog, setProcessing, selectedAction, assignedLocationId, assignedLocationName, kioskDevices, deviceId]);

  // ─── QR scanning loop ────────────────────────────────────────────
  useEffect(() => {
    if (activeMode !== 'qr' || isKioskLocked) return;
    let html5QrCode: any = null;
    let mounted = true;

    (async () => {
      // ─── HARDWARE RESET: Wait for Face camera to release ───
      stopCamera();
      await new Promise(r => setTimeout(r, 500));
      
      if (!mounted || activeMode !== 'qr') return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('gate-qr-reader');
        setQrScanner(html5QrCode);

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          async (decodedText: string) => {
            if (!mounted || isProcessing || currentResult) return;
            console.log('[GateKiosk] QR Scanned Token:', decodedText.trim());
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
        const stopScanner = async () => {
          try {
            // getState() === 2 means SCANNING
            if (html5QrCode.getState() === 2) {
              await html5QrCode.stop();
            }
            html5QrCode.clear();
          } catch (e) {
            console.warn('[GateKiosk] QR Cleanup safe-catch:', e);
          }
        };
        stopScanner();
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

  // ─── Passcode check-in handler ────────────────────────────────────
  const handlePasscodeSubmit = useCallback(async (code: string) => {
    if (isProcessing) return;
    setProcessing(true);
    setIsPasscodeError(false);
    try {
      const user = await lookupByPasscode(code);
      if (user) {
        await handleMatch(user, 'passcode');
        setPasscodeInput('');
      } else {
        setIsPasscodeError(true);
        setTimeout(() => setIsPasscodeError(false), 600); // Reset shake after animation
        setPasscodeInput('');
        showResult({ success: false, method: 'passcode', message: 'Invalid Passcode' });
      }
    } catch (err: any) {
      showResult({ success: false, method: 'passcode', message: err.message || 'System error' });
      setPasscodeInput('');
    } finally {
      setProcessing(false);
    }
  }, [isProcessing, setProcessing, handleMatch, showResult]);

  const onKeypadPress = (val: string) => {
    if (passcodeInput.length >= 4) return;
    const newCode = passcodeInput + val;
    setPasscodeInput(newCode);
    if (newCode.length === 4) {
      handlePasscodeSubmit(newCode);
    }
  };

  const onKeypadDelete = () => {
    setPasscodeInput(prev => prev.slice(0, -1));
  };

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

    return registeredUsers.filter((u) => {
      const name = (u.userName || '').toLowerCase();
      const email = (u.userEmail || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();

      // Every word typed must be present in either name, email, or department
      return queryTokens.every((token) =>
        name.includes(token) || email.includes(token) || dept.includes(token)
      );
    }).slice(0, 8);
  }, [manualSearch, registeredUsers]);

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
          <div className="relative group cursor-help">
            <span className="text-emerald-400/60 hover:text-emerald-400 transition-colors text-xs">
              {registeredUsers.length} personnel synced
            </span>
            <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-2">Synced Personnel</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {registeredUsers.slice(0, 10).map(u => (
                  <div key={u.id} className="text-xs text-emerald-300 font-medium flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {u.userName}
                  </div>
                ))}
                {registeredUsers.length > 10 && (
                  <div className="text-[10px] text-emerald-300/40 pl-3.5 italic">
                    + {registeredUsers.length - 10} more...
                  </div>
                )}
              </div>
            </div>
          </div>
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
          {(['qr', 'manual', 'passcode'] as GateMode[]).map((mode) => {
          const icons = { qr: QrCode, manual: User, passcode: Hash };
          const labels = { qr: 'QR Scan', manual: 'Manual', passcode: 'Passcode' };
          const Icon = icons[mode as keyof typeof icons];
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
              {labels[mode as keyof typeof labels]}
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
          <div className="w-full h-full relative flex flex-col items-center justify-center p-6">

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

        {activeMode === 'passcode' && (
          <div className={`w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-8 ${isPasscodeError ? 'animate-shake' : ''}`}>
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isPasscodeError ? 'bg-red-500/20' : 'bg-emerald-500/10'}`}>
                <Hash className={`w-8 h-8 ${isPasscodeError ? 'text-red-400' : 'text-emerald-400'}`} />
              </div>
              <p className={`text-sm font-medium transition-colors ${isPasscodeError ? 'text-red-400' : 'text-emerald-300/60'}`}>
                {isPasscodeError ? 'Invalid Passcode' : 'Enter your 4-digit passcode'}
              </p>
              
              {/* Passcode dots */}
              <div className="flex gap-4 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    passcodeInput.length > i 
                      ? (isPasscodeError ? 'bg-red-400 scale-110' : 'bg-emerald-400 scale-110') 
                      : 'bg-white/10'
                  }`} />
                ))}
              </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-4 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} onClick={() => onKeypadPress(n.toString())}
                  className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 text-white text-2xl font-bold transition-all border border-white/5 flex items-center justify-center">
                  {n}
                </button>
              ))}
              <div className="h-16" /> {/* Empty spacer */}
              <button onClick={() => onKeypadPress('0')}
                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 text-white text-2xl font-bold transition-all border border-white/5 flex items-center justify-center">
                0
              </button>
              <button onClick={onKeypadDelete}
                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-red-500/20 text-emerald-400/60 transition-all flex items-center justify-center">
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
          </div>
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
                    if (Capacitor.isNativePlatform()) {
                      try {
                        await KioskPlugin.stopLockTask();
                      } catch (err) {
                        console.warn('[GateKiosk] KioskPlugin.stopLockTask failed:', err);
                      }
                    }
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
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
