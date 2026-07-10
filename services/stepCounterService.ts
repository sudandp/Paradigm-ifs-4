import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';

interface StepCountChangedEvent {
  steps: number;
  totalCumulativeSteps: number;
}

interface StepCounterPlugin {
  isStepCountingSupported(): Promise<{ supported: boolean }>;
  checkPermissions(): Promise<{ activityRecognition: string }>;
  requestPermissions(): Promise<{ activityRecognition: string }>;
  /** @deprecated use checkPermissions / requestPermissions */
  getPermissionStatus(): Promise<{ granted: boolean }>;
  /** @deprecated use checkPermissions / requestPermissions */
  requestPermission(): Promise<{ granted: boolean }>;
  startStepCount(): Promise<void>;
  stopStepCount(): Promise<void>;
  getStepCount(): Promise<{ steps: number }>;
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter');

class StepCounterService {
  private listenerHandle: PluginListenerHandle | null = null;
  private appStateHandle: PluginListenerHandle | null = null;
  private isCounting: boolean = false;
  private currentSteps: number = 0;
  private onStepChange: ((steps: number) => void) | null = null;

  /** Get the current accumulated steps recorded since startCounting was called. */
  public getStepsCount(): number {
    return this.currentSteps;
  }

  /** Read current step count natively and update state. Useful to fetch on demand. */
  public async getStepCountFromNative(): Promise<number> {
    if (Capacitor.getPlatform() !== 'android') return this.currentSteps;
    try {
      const result = await StepCounter.getStepCount();
      this.currentSteps = result.steps;
      return result.steps;
    } catch {
      return this.currentSteps;
    }
  }

  /** Check if step counting is supported on the current device / platform. */
  public async isSupported(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false;
    try {
      const { supported } = await StepCounter.isStepCountingSupported();
      return supported;
    } catch {
      return false;
    }
  }

  /**
   * Check current ACTIVITY_RECOGNITION permission state.
   * Returns 'granted', 'denied', or 'prompt'.
   */
  public async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    if (Capacitor.getPlatform() !== 'android') return 'granted';
    try {
      // Try Capacitor v5+ standard API first
      if (typeof StepCounter.checkPermissions === 'function') {
        const result = await StepCounter.checkPermissions();
        return result.activityRecognition as 'granted' | 'denied' | 'prompt';
      }
      // Fallback to legacy API
      const { granted } = await StepCounter.getPermissionStatus();
      return granted ? 'granted' : 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Request ACTIVITY_RECOGNITION permission and wait for user response.
   * Returns true if granted, false if denied.
   */
  public async ensurePermission(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return true;

    const current = await this.checkPermissionStatus();
    if (current === 'granted') return true;
    if (current === 'denied') {
      console.warn('[StepCounter] ACTIVITY_RECOGNITION permanently denied. User must enable in Settings.');
      return false;
    }

    try {
      // Try Capacitor v5+ standard API first
      if (typeof StepCounter.requestPermissions === 'function') {
        const result = await StepCounter.requestPermissions();
        return result.activityRecognition === 'granted';
      }
      // Fallback to legacy API
      const { granted } = await StepCounter.requestPermission();
      return granted;
    } catch (err) {
      console.error('[StepCounter] Error requesting permission:', err);
      return false;
    }
  }

  /**
   * Pre-flight check: ensure sensor is available and permission is granted.
   * Call this BEFORE startCounting() to surface permission UI early.
   * Returns: { ok: boolean, reason?: string }
   */
  public async preflight(): Promise<{ ok: boolean; reason?: string }> {
    if (Capacitor.getPlatform() !== 'android') {
      return { ok: true }; // Web/iOS — will use simulation
    }
    const supported = await this.isSupported();
    if (!supported) {
      return { ok: false, reason: 'Step counter sensor not available on this device.' };
    }
    const granted = await this.ensurePermission();
    if (!granted) {
      return { ok: false, reason: 'Activity Recognition permission was denied. Steps cannot be counted.' };
    }
    return { ok: true };
  }

  /**
   * Start listening for step changes.
   * Always call preflight() or ensurePermission() first to handle the permission dialog.
   * @param onStepChange Callback executed when step updates occur.
   */
  public async startCounting(onStepChange: (steps: number) => void): Promise<void> {
    this.onStepChange = onStepChange;

    if (this.isCounting) return;

    // On non-Android: Step counting is not natively supported.
    // We return 0 instead of simulating to prevent auto-increasing on web.
    if (Capacitor.getPlatform() !== 'android') {
      this.isCounting = true;
      this.currentSteps = 0;
      if (this.onStepChange) this.onStepChange(0);
      return;
    }

    const supported = await this.isSupported();
    if (!supported) {
      console.warn('[StepCounter] Step counter sensor not available on this device.');
      return;
    }

    // Ensure permission is granted (will request if not yet asked)
    const granted = await this.ensurePermission();
    if (!granted) {
      throw new Error('ACTIVITY_RECOGNITION permission denied. Steps cannot be counted.');
    }

    try {
      // Sync immediately on start
      const initialSteps = await this.getStepCountFromNative();
      if (this.onStepChange) this.onStepChange(initialSteps);

      this.listenerHandle = await (StepCounter as any).addListener(
        'stepCountChanged',
        (data: StepCountChangedEvent) => {
          this.currentSteps = data.steps;
          if (this.onStepChange) this.onStepChange(data.steps);
        }
      );

      await StepCounter.startStepCount();
      this.isCounting = true;
      console.log('[StepCounter] Native step counting started.');

      // Setup AppState listener to re-sync steps and re-attach listener on resume
      this.appStateHandle = await App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive && this.isCounting) {
          try {
            const steps = await this.getStepCountFromNative();
            if (this.onStepChange) this.onStepChange(steps);
            
            // Re-attach listener in case it was lost during backgrounding
            if (this.listenerHandle) {
              this.listenerHandle.remove();
            }
            this.listenerHandle = await (StepCounter as any).addListener(
              'stepCountChanged',
              (data: StepCountChangedEvent) => {
                this.currentSteps = data.steps;
                if (this.onStepChange) this.onStepChange(data.steps);
              }
            );
          } catch (e) {
            console.error('[StepCounter] Error syncing steps on resume:', e);
          }
        }
      });
      
    } catch (err) {
      console.error('[StepCounter] Failed to start native step counting:', err);
      this.cleanup();
      throw err;
    }
  }

  /** Stop listening for step changes. */
  public async stopCounting(): Promise<void> {
    this.cleanupSimulation();
    if (!this.isCounting) return;

    if (Capacitor.getPlatform() === 'android') {
      try {
        await StepCounter.stopStepCount();
      } catch (err) {
        console.warn('[StepCounter] Error stopping native step counter:', err);
      }
    }

    this.cleanup();
    console.log('[StepCounter] Step counting stopped.');
  }

  private cleanup(): void {
    if (this.listenerHandle) {
      this.listenerHandle.remove();
      this.listenerHandle = null;
    }
    if (this.appStateHandle) {
      this.appStateHandle.remove();
      this.appStateHandle = null;
    }
    this.onStepChange = null;
    this.isCounting = false;
  }

  // --- Simulation Logic for non-Android platforms (dev/web preview) ---
  private simulationIntervalId: any = null;
  private simulatedSteps: number = 0;

  private simulateSteps() {
    if (this.simulationIntervalId) return;
    this.isCounting = true;
    this.simulatedSteps = 0;
    this.currentSteps = 0;
    this.simulationIntervalId = setInterval(() => {
      const delta = Math.floor(Math.random() * 5) + 1;
      this.simulatedSteps += delta;
      this.currentSteps = this.simulatedSteps;
      if (this.onStepChange) this.onStepChange(this.simulatedSteps);
    }, 3000);
  }

  private cleanupSimulation() {
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
      this.isCounting = false;
      this.simulatedSteps = 0;
      this.currentSteps = 0; // Reset so next startCounting begins at 0
    }
  }
}

export const stepCounterService = new StepCounterService();
