import { api } from './api';
import { getPrecisePosition } from '../utils/locationUtils';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { supabaseUrl, supabaseAnonKey, supabase } from './supabase';


interface TrackingPlugin {
  startForegroundService(options: {
    title: string;
    text: string;
    userId: string;
    supabaseUrl: string;
    supabaseKey: string;        // anon key — used as apikey header only
    supabaseToken: string;     // user JWT access token — used as Authorization Bearer header
    supabaseRefreshToken?: string; // user JWT refresh token
    intervalMinutes: number;
  }): Promise<void>;
  stopForegroundService(): Promise<void>;
  updateTokens(options: {
    supabaseToken: string;
    supabaseRefreshToken?: string;
  }): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  openAppSettings(): Promise<void>;
  checkLocationIntegrity(): Promise<{ isMock: boolean; mockReason?: string; error?: string }>;
}

export const Tracking = registerPlugin<TrackingPlugin>('Tracking');

class RouteTrackingService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isTracking: boolean = false;
  private isBackgroundServiceRunning: boolean = false;
  private isRecording: boolean = false;
  private lastRecordedAt: number = 0;
  private currentUserId: string | null = null;
  private currentIntervalMinutes: number = 15;

  public async startTracking(userId: string, intervalMinutes: number = 15, runBackgroundService: boolean = false) {
    this.currentUserId = userId;
    this.currentIntervalMinutes = intervalMinutes;

    console.log(`[RouteTracking] Starting/syncing tracking for user ${userId}: interval=${intervalMinutes}m, bgService=${runBackgroundService}`);

    // 1. Manage Android Native Background Foreground Service
    // Only run native background persistent notification if employee is actively checked in
    if (Capacitor.getPlatform() === 'android') {
      if (runBackgroundService) {
        if (!this.isBackgroundServiceRunning) {
          try {
            // [AUTH FIX] Read the live JWT access token and refresh token from the current session.
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken  = session?.access_token || supabaseAnonKey || '';
            const refreshToken = session?.refresh_token || '';

            await Tracking.startForegroundService({
              title: 'Paradigm Field Ops',
              text:  'Location tracking is active',
              userId,
              supabaseUrl:          supabaseUrl  || '',
              supabaseKey:          supabaseAnonKey || '',  // still needed as apikey header
              supabaseToken:        accessToken,             // JWT for Authorization header
              supabaseRefreshToken: refreshToken,            // Refresh token for native auto-renewal
              intervalMinutes,
            });
            this.isBackgroundServiceRunning = true;
            console.log('[RouteTracking] Native Android foreground service started — GPS handled natively in background');
          } catch (err) {
            console.error('[RouteTracking] Failed to start foreground service:', err);
          }
        }
      } else if (this.isBackgroundServiceRunning) {
        // User not checked in — stop the sticky notification service
        try {
          await Tracking.stopForegroundService();
          this.isBackgroundServiceRunning = false;
          console.log('[RouteTracking] Stopped native Android background service (user is not checked in)');
        } catch (err) {
          console.warn('[RouteTracking] Failed to stop foreground service:', err);
        }
      }
    }

    // 2. Active In-App Interval Tracking (Runs while app is active / open across Web, iOS, & Android)
    const intervalMs = intervalMinutes * 60 * 1000;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      if (this.currentUserId) {
        console.log(`[RouteTracking] Running periodic active interval location ping for user ${this.currentUserId}...`);
        this.recordPosition(this.currentUserId);
      }
    }, intervalMs);

    // 3. Trigger immediate app-open location record if not recently recorded (<10s)
    const now = Date.now();
    if (!this.isTracking || (now - this.lastRecordedAt > 10000)) {
      this.isTracking = true;
      this.recordPosition(userId);
    }
  }

  public async recordAppOpenPosition(userId: string) {
    console.log(`[RouteTracking] Capturing location on app open/resume for user ${userId}...`);
    return this.recordPosition(userId);
  }

  public async stopTracking() {
    if (!this.isTracking && !this.isBackgroundServiceRunning) return;
    
    console.log('[RouteTracking] Stopping tracking');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (Capacitor.getPlatform() === 'android' && this.isBackgroundServiceRunning) {
      try {
        await Tracking.stopForegroundService();
      } catch (err) {
        console.warn('[RouteTracking] Failed to stop foreground service:', err);
      }
    }

    this.isTracking = false;
    this.isBackgroundServiceRunning = false;
    this.isRecording = false;
    this.currentUserId = null;
  }

  public async updateTokens(supabaseToken: string, supabaseRefreshToken?: string) {
    if (Capacitor.getPlatform() === 'android' && supabaseToken) {
      try {
        await Tracking.updateTokens({ supabaseToken, supabaseRefreshToken });
        console.log('[RouteTracking] Fresh session tokens pushed to Android TrackingService');
      } catch (err) {
        console.warn('[RouteTracking] Failed to update tokens on native tracking plugin:', err);
      }
    }
  }

  public async recordPosition(userId: string, requestId?: string) {
    const now = Date.now();
    // Allow admin-triggered request pings through immediately, but throttle routine pings to a 10s minimum cooldown
    if (!requestId && now - this.lastRecordedAt < 10000 && this.lastRecordedAt !== 0) {
      console.log('[RouteTracking] Skip routine ping: throttled within 10s cooldown window');
      return;
    }

    if (this.isRecording) {
      // If we're already recording a routine ping, we still need to respond to
      // admin-triggered requests so they don't stay in PENDING forever.
      // Wait up to 15s for the current recording to finish, then try again.
      if (requestId) {
        console.log(`[RouteTracking] Busy recording; will retry admin ping (${requestId}) after current position resolves...`);
        const maxWaitMs = 15000;
        const pollInterval = 500;
        let elapsed = 0;
        while (this.isRecording && elapsed < maxWaitMs) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          elapsed += pollInterval;
        }
        if (this.isRecording) {
          // Still locked after 15s — report failure so the log doesn't stay pending
          console.warn(`[RouteTracking] Timed out waiting for lock release for request ${requestId}. Reporting failure.`);
          await api.updateTrackingRequestStatus(requestId, 'failed');
          return;
        }
        // Now unlocked — fall through and record for this request
        console.log(`[RouteTracking] Lock released. Proceeding with admin ping (${requestId}).`);
      } else {
        console.log('[RouteTracking] Skip routine ping: Already recording a position');
        return;
      }
    }

    try {
      this.isRecording = true;
      // Target high-precision fix (30m threshold with active GPS warmup lock)
      const pos = await getPrecisePosition(30, 15000); 
      
      // Fetch Device Telemetry
      let batteryLevel: number | undefined;
      let deviceName: string | undefined;
      let networkType: string | undefined;
      let networkProvider: string | undefined;
      let ipAddress: string | undefined;

      try {
        const battery = await Device.getBatteryInfo();
        batteryLevel = battery.batteryLevel;
        
        const info = await Device.getInfo();
        deviceName = `${info.manufacturer} ${info.model}`;
        
        const netStatus = await Network.getStatus();
        networkType = netStatus.connectionType;
        
        // Try to fetch IP if connected
        if (netStatus.connected) {
          const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null);
          if (ipRes) {
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
          }
        }
      } catch (telemetryErr) {
        console.warn('[RouteTracking] Failed to fetch device telemetry:', telemetryErr);
      }

      // Determine source platform so the dashboard can show the correct device badge
      const platform = Capacitor.getPlatform(); // 'android', 'ios', or 'web'
      const source = platform === 'android' ? 'android_foreground'
                   : platform === 'ios'     ? 'ios_foreground'
                   : 'web';

      const routePoint = {
        userId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed || undefined,
        heading: pos.coords.heading || undefined,
        batteryLevel,
        deviceName,
        networkType,
        ipAddress,
        networkProvider,
        source  // 'android_foreground' | 'ios_foreground' | 'web'
      };

      await api.addRoutePoint(routePoint);
      this.lastRecordedAt = Date.now();
      console.log(`[RouteTracking] Position recorded for request ${requestId || 'no-id'}:`, routePoint.latitude, routePoint.longitude);
      
      // If this was triggered by a specific admin request, update the status to successful
      if (requestId) {
        console.log(`[RouteTracking] Reporting success for request ${requestId}...`);
        await api.updateTrackingRequestStatus(requestId, 'successful');
      }
    } catch (err) {
      console.warn(`[RouteTracking] Failed to record position for request ${requestId || 'no-id'}:`, err);
      if (requestId) {
        console.log(`[RouteTracking] Reporting failure for request ${requestId}...`);
        await api.updateTrackingRequestStatus(requestId, 'failed');
      }
    } finally {
      this.isRecording = false;
    }
  }

  public isActive(): boolean {
    return this.isTracking;
  }

  public async isBatteryOptimizationIgnored(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        const res = await Tracking.isBatteryOptimizationIgnored();
        return res?.isIgnored ?? true;
      } catch (err) {
        console.warn('[RouteTracking] Error checking battery optimization:', err);
        return true;
      }
    }
    return true;
  }

  public async requestIgnoreBatteryOptimization(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Tracking.requestIgnoreBatteryOptimization();
      } catch (err) {
        console.warn('[RouteTracking] Error requesting battery optimization exemption:', err);
      }
    }
  }

  public async openAppSettings(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Tracking.openAppSettings();
      } catch (err) {
        console.warn('[RouteTracking] Error opening app settings:', err);
      }
    }
  }
}

export const routeTrackingService = new RouteTrackingService();
