/**
 * Gate Attendance Zustand Store
 * Manages kiosk state: active mode, recent scans, duplicate prevention, and face descriptor cache.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GateMode, GateUser, GateAttendanceLog, GateScanResult } from '../types/gate';

interface RecentScan {
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  method: string;
  timestamp: number; // epoch ms
}

interface GateStore {
  // Mode
  activeMode: GateMode;
  setActiveMode: (mode: GateMode) => void;

  // Camera
  isCameraReady: boolean;
  setCameraReady: (ready: boolean) => void;

  // User cache (loaded from DB)
  registeredUsers: GateUser[];
  setRegisteredUsers: (users: GateUser[]) => void;
  lastSyncTime: number | null;

  // Loading & errors
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Recent scans for duplicate prevention (5-min window)
  recentScans: RecentScan[];
  addRecentScan: (scan: RecentScan) => void;
  isDuplicate: (userId: string) => boolean;
  clearExpiredScans: () => void;

  // Current scan result (for UI overlay)
  currentResult: GateScanResult | null;
  setCurrentResult: (result: GateScanResult | null) => void;

  // Today's logs for dashboard
  todayLogs: GateAttendanceLog[];
  setTodayLogs: (logs: GateAttendanceLog[]) => void;
  addLog: (log: GateAttendanceLog) => void;


  // Kiosk pin
  kioskPin: string;
  setKioskPin: (pin: string) => void;
  isKioskLocked: boolean;
  setKioskLocked: (locked: boolean) => void;

  // Device Configuration (Persisted)
  assignedLocationId: string | null;
  assignedLocationName: string | null;
  setAssignedLocation: (id: string | null, name: string | null) => void;

  deviceId: string | null;
  setDeviceId: (id: string | null) => void;
  locationName: string | null;
  setLocationName: (name: string | null) => void;
  isKioskMode: boolean;
  setKioskMode: (active: boolean) => void;
  isKioskSkipped: boolean;
  setKioskSkipped: (skipped: boolean) => void;
}

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const useGateStore = create<GateStore>()(
  persist(
    (set, get) => ({
      activeMode: 'qr',
      setActiveMode: (mode) => set({ activeMode: mode }),

      isCameraReady: false,
      setCameraReady: (ready) => set({ isCameraReady: ready }),

      registeredUsers: [],
      setRegisteredUsers: (users) => set({ registeredUsers: users, lastSyncTime: Date.now() }),
      lastSyncTime: null,

      recentScans: [],
      addRecentScan: (scan) => set((state) => ({
        recentScans: [...state.recentScans, scan]
      })),
      isDuplicate: (userId) => {
        const { recentScans } = get();
        const now = Date.now();
        return recentScans.some(
          (s) => s.userId === userId && (now - s.timestamp) < DUPLICATE_WINDOW_MS
        );
      },
      clearExpiredScans: () => set((state) => ({
        recentScans: state.recentScans.filter(
          (s) => (Date.now() - s.timestamp) < DUPLICATE_WINDOW_MS
        )
      })),

      currentResult: null,
      setCurrentResult: (result) => set({ currentResult: result }),

      todayLogs: [],
      setTodayLogs: (logs) => set({ todayLogs: logs }),
      addLog: (log) => set((state) => ({
        todayLogs: [log, ...state.todayLogs]
      })),

      isProcessing: false,
      setProcessing: (processing) => set({ isProcessing: processing }),
      error: null,
      setError: (error) => set({ error }),

      kioskPin: '1234',
      setKioskPin: (pin) => set({ kioskPin: pin }),
      isKioskLocked: true,
      setKioskLocked: (locked) => set({ isKioskLocked: locked }),

      assignedLocationId: null,
      assignedLocationName: null,
      setAssignedLocation: (id, name) => set({ assignedLocationId: id, assignedLocationName: name }),

      deviceId: null,
      setDeviceId: (id) => set({ deviceId: id }),
      locationName: null,
      setLocationName: (name) => set({ locationName: name }),
      isKioskMode: false,
      setKioskMode: (active) => set({ isKioskMode: active }),
      isKioskSkipped: false,
      setKioskSkipped: (skipped) => set({ isKioskSkipped: skipped }),
    }),
    {
      name: 'gate-kiosk-storage',
      partialize: (state) => ({ 
        assignedLocationId: state.assignedLocationId, 
        assignedLocationName: state.assignedLocationName,
        kioskPin: state.kioskPin,
        deviceId: state.deviceId,
        locationName: state.locationName,
        isKioskMode: state.isKioskMode,
        isKioskSkipped: state.isKioskSkipped
      }),
    }
  )
);
