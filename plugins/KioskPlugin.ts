import { registerPlugin } from '@capacitor/core';

export interface KioskPluginDefinition {
  isKioskActive(): Promise<{ active: boolean }>;
  startLockTask(): Promise<void>;
  stopLockTask(): Promise<void>;
  getDeviceId(): Promise<{ deviceId: string }>;
}

const KioskPlugin = registerPlugin<KioskPluginDefinition>('KioskPlugin');

export { KioskPlugin };
