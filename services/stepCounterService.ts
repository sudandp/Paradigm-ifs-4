import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

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
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter');

class StepCounterService {
  private listenerHandle: PluginListenerHandle | null = null;
  private isCounting: boolean = false;
  private currentSteps: number = 0;

  /** Get the current accumulated steps recorded since startCounting was called. */
  public getStepsCount(): number {
    return this.currentSteps;
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
    if (this.isCounting) return;

    // On non-Android: simulate steps for dev/web preview
    if (Capacitor.getPlatform() !== 'android') {
      this.simulateSteps(onStepChange);
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
      this.currentSteps = 0;

      this.listenerHandle = await (StepCounter as any).addListener(
        'stepCountChanged',
        (data: StepCountChangedEvent) => {
          this.currentSteps = data.steps;
          onStepChange(data.steps);
        }
      );

      await StepCounter.startStepCount();
      this.isCounting = true;
      console.log('[StepCounter] Native step counting started.');
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
    this.isCounting = false;
  }

  // --- Simulation Logic for non-Android platforms (dev/web preview) ---
  private simulationIntervalId: any = null;
  private simulatedSteps: number = 0;

  private simulateSteps(onStepChange: (steps: number) => void) {
    if (this.simulationIntervalId) return;
    this.isCounting = true;
    this.simulatedSteps = 0;
    this.currentSteps = 0;
    this.simulationIntervalId = setInterval(() => {
      const delta = Math.floor(Math.random() * 5) + 1;
      this.simulatedSteps += delta;
      this.currentSteps = this.simulatedSteps;
      onStepChange(this.simulatedSteps);
    }, 3000);
  }

  private cleanupSimulation() {
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
      this.isCounting = false;
      this.simulatedSteps = 0;
    }
  }
}

export const stepCounterService = new StepCounterService();
