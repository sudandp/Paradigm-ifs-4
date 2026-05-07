import { registerPlugin } from '@capacitor/core';

export interface KioskPluginInterface {
  startKioskMode(): Promise<void>;
  stopKioskMode(): Promise<void>;
  setKioskActive(options: { active: boolean }): Promise<void>;
  isKioskActive(): Promise<{ active: boolean }>;
  getDeviceId(): Promise<{ deviceId: string }>;
}

export const KioskPlugin = registerPlugin<KioskPluginInterface>('KioskPlugin');
