import { api } from './api';
import { getPrecisePosition } from '../utils/locationUtils';
import { useAuthStore } from '../store/authStore';

class RouteTrackingService {
  private intervalId: any = null;
  private isTracking: boolean = false;
  private isRecording: boolean = false;

  public async startTracking(userId: string, intervalMinutes: number = 10) {
    if (this.isTracking) return;
    
    console.log(`[RouteTracking] Starting tracking for user ${userId} every ${intervalMinutes} minutes`);
    this.isTracking = true;

    // Immediate first ping
    this.recordPosition(userId);

    // Set up interval
    const intervalMs = intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.recordPosition(userId);
    }, intervalMs);
  }

  public stopTracking() {
    if (!this.isTracking) return;
    
    console.log('[RouteTracking] Stopping tracking');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isTracking = false;
    this.isRecording = false;
  }

  private async recordPosition(userId: string) {
    if (this.isRecording) {
      console.log('[RouteTracking] Skip: Already recording a position');
      return;
    }

    try {
      this.isRecording = true;
      // Use a slightly more lenient accuracy for periodic pings to save battery/time
      const pos = await getPrecisePosition(150, 15000); 
      
      const routePoint = {
        userId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed || undefined,
        heading: pos.coords.heading || undefined
      };

      await api.addRoutePoint(routePoint);
      console.log('[RouteTracking] Position recorded:', routePoint.latitude, routePoint.longitude);
    } catch (err) {
      console.warn('[RouteTracking] Failed to record position:', err);
    } finally {
      this.isRecording = false;
    }
  }

  public isActive(): boolean {
    return this.isTracking;
  }
}

export const routeTrackingService = new RouteTrackingService();
