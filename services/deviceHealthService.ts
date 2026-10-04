import { Capacitor, registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';

interface TrackingPluginInterface {
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  openAppSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openBatteryOptimizationSettings(): Promise<void>;
}

const Tracking = registerPlugin<TrackingPluginInterface>('Tracking');

export interface DeviceHealthReport {
  isNative: boolean;
  batteryWhitelisted: boolean;
  notificationsGranted: boolean;
  manufacturer: string;
  model: string;
  osVersion: string;
  reliabilityScore: number; // 0 - 100
  needsAction: boolean;
  issues: string[];
}

class DeviceHealthService {
  /**
   * Run a real-time audit of background permissions, battery optimization, and notification channels.
   */
  public async auditDevice(): Promise<DeviceHealthReport> {
    if (!Capacitor.isNativePlatform()) {
      return {
        isNative: false,
        batteryWhitelisted: true,
        notificationsGranted: true,
        manufacturer: 'Web Browser',
        model: 'Desktop/Web',
        osVersion: navigator.userAgent,
        reliabilityScore: 100,
        needsAction: false,
        issues: [],
      };
    }

    let batteryWhitelisted = false;
    let notificationsGranted = false;
    let manufacturer = 'Android';
    let model = 'Device';
    let osVersion = 'Unknown';
    const issues: string[] = [];

    // 1. Audit Battery Optimization Whitelist (Doze Mode)
    try {
      const res = await Tracking.isBatteryOptimizationIgnored();
      batteryWhitelisted = !!res?.isIgnored;
      if (!batteryWhitelisted) {
        issues.push('Battery optimization is active (app may be paused when device is locked).');
      }
    } catch (e) {
      console.warn('[DeviceHealth] Battery optimization audit error:', e);
      batteryWhitelisted = false;
    }

    // 2. Audit Push Notification Permission
    try {
      const perm = await PushNotifications.checkPermissions();
      notificationsGranted = perm.receive === 'granted';
      if (!notificationsGranted) {
        issues.push('Push notifications permission is not granted.');
      }
    } catch (e) {
      console.warn('[DeviceHealth] Notification check error:', e);
      notificationsGranted = false;
    }

    // 3. Audit Device Brand & Model for OEM-specific aggressions
    try {
      const info = await Device.getInfo();
      manufacturer = (info.manufacturer || 'Android').toLowerCase();
      model = info.model || '';
      osVersion = info.osVersion || '';
    } catch (e) {
      console.warn('[DeviceHealth] Device info error:', e);
    }

    // Calculate overall reliability score
    let score = 100;
    if (!batteryWhitelisted) score -= 40;
    if (!notificationsGranted) score -= 40;

    return {
      isNative: true,
      batteryWhitelisted,
      notificationsGranted,
      manufacturer,
      model,
      osVersion,
      reliabilityScore: Math.max(20, score),
      needsAction: !batteryWhitelisted || !notificationsGranted,
      issues,
    };
  }

  /**
   * Direct heavy-lifting action: Requests battery optimization exemption directly from the OS.
   * Prompts the system dialog: "Allow app to always run in the background?"
   */
  public async requestBackgroundAllowance(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Tracking.requestIgnoreBatteryOptimization();
    } catch (err) {
      console.warn('[DeviceHealth] Direct battery request failed, opening settings fallback:', err);
      await this.openBatterySettings();
    }
  }

  /**
   * Direct link: Opens the exact app notification settings page where channels and sounds can be adjusted.
   */
  public async openNotificationSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Tracking.openNotificationSettings();
    } catch (err) {
      console.warn('[DeviceHealth] Failed to open notification settings, opening app info fallback:', err);
      await this.openAppSettings();
    }
  }

  /**
   * Direct link: Opens battery optimization settings.
   */
  public async openBatterySettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Tracking.openBatteryOptimizationSettings();
    } catch (err) {
      await this.openAppSettings();
    }
  }

  /**
   * Direct link: Opens application details (App Info) screen.
   */
  public async openAppSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Tracking.openAppSettings();
    } catch (err) {
      console.error('[DeviceHealth] Failed to open app settings:', err);
    }
  }
}

export const deviceHealthService = new DeviceHealthService();
