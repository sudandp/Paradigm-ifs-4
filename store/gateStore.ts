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

  // Face descriptor cache (loaded from DB / IndexedDB)
  registeredFaces: GateUser[];
  setRegisteredFaces: (faces: GateUser[]) => void;
  lastSyncTime: number | null;

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

  // Loading & errors
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Kiosk pin
  kioskPin: string;
  setKioskPin: (pin: string) => void;
  isKioskLocked: boolean;
  setKioskLocked: (locked: boolean) => void;

  // Device Configuration (Persisted)
  assignedLocationId: string | null;
  assignedLocationName: string | null;
  setAssignedLocation: (id: string | null, name: string | null) => void;
}

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const useGateStore = create<GateStore>()(
  persist(
    (set, get) => ({
      activeMode: 'face',
      setActiveMode: (mode) => set({ activeMode: mode }),

      isCameraReady: false,
      setCameraReady: (ready) => set({ isCameraReady: ready }),

      registeredFaces: [],
      setRegisteredFaces: (faces) => set({ registeredFaces: faces, lastSyncTime: Date.now() }),
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
    }),
    {
      name: 'gate-kiosk-storage',
      partialize: (state) => ({ 
        assignedLocationId: state.assignedLocationId, 
        assignedLocationName: state.assignedLocationName,
        kioskPin: state.kioskPin
      }),
    }
  )
);
