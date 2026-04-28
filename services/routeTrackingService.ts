import { api } from './api';
import { getPrecisePosition } from '../utils/locationUtils';
import { useAuthStore } from '../store/authStore';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { registerPlugin, Capacitor } from '@capacitor/core';

interface TrackingPlugin {
  startForegroundService(options: { title: string; text: string }): Promise<void>;
  stopForegroundService(): Promise<void>;
}

const Tracking = registerPlugin<TrackingPlugin>('Tracking');

class RouteTrackingService {
  private intervalId: any = null;
  private isTracking: boolean = false;
  private isRecording: boolean = false;

  public async startTracking(userId: string, intervalMinutes: number = 10) {
    if (this.isTracking) return;
    
    console.log(`[RouteTracking] Starting tracking for user ${userId} every ${intervalMinutes} minutes`);
    this.isTracking = true;

    // Launch foreground service on Android to prevent app from being killed
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Tracking.startForegroundService({
          title: "Paradigm Field Ops",
          text: "Location and shift tracking is active"
        });
      } catch (err) {
        console.error('[RouteTracking] Failed to start foreground service:', err);
      }
    }

    // Immediate first ping
    this.recordPosition(userId);

    // Set up interval
    const intervalMs = intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.recordPosition(userId);
    }, intervalMs);
  }

  public async stopTracking() {
    if (!this.isTracking) return;
    
    console.log('[RouteTracking] Stopping tracking');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (Capacitor.getPlatform() === 'android') {
      try {
        await Tracking.stopForegroundService();
      } catch (err) {
        console.warn('[RouteTracking] Failed to stop foreground service:', err);
      }
    }

    this.isTracking = false;
    this.isRecording = false;
  }

  public async recordPosition(userId: string, requestId?: string) {
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
      // Use a slightly more lenient accuracy for periodic pings to save battery/time
      const pos = await getPrecisePosition(150, 15000); 
      
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
}

export const routeTrackingService = new RouteTrackingService();
