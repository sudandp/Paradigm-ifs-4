import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

interface StepCountChangedEvent {
  steps: number;
  totalCumulativeSteps: number;
}

interface StepCounterPlugin {
  isStepCountingSupported(): Promise<{ supported: boolean }>;
  getPermissionStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  startStepCount(): Promise<void>;
  stopStepCount(): Promise<void>;
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter');

class StepCounterService {
  private listenerHandle: PluginListenerHandle | null = null;
  private isCounting: boolean = false;
  private currentSteps: number = 0;

  /**
   * Get the current accumulated steps recorded since startCounting was called.
   */
  public getStepsCount(): number {
    return this.currentSteps;
  }

  /**
   * Check if step counting is supported on the current device / platform.
   */
  public async isSupported(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      console.log('[StepCounterService] Step counting is only supported on Android hardware.');
      return false;
    }
    try {
      const { supported } = await StepCounter.isStepCountingSupported();
      return supported;
    } catch (err) {
      console.error('[StepCounterService] Error checking support status:', err);
      return false;
    }
  }

  /**
   * Get current permission status for ACTIVITY_RECOGNITION.
   */
  public async getPermissionStatus(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return true; // Auto-grant/mock on web/iOS
    }
    try {
      const { granted } = await StepCounter.getPermissionStatus();
      return granted;
    } catch (err) {
      console.error('[StepCounterService] Error getting permission status:', err);
      return false;
    }
  }

  /**
   * Request ACTIVITY_RECOGNITION permission.
   */
  public async requestPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return true; // Mock success on non-Android platforms
    }
    try {
      const { granted } = await StepCounter.requestPermission();
      return granted;
    } catch (err) {
      console.error('[StepCounterService] Error requesting permission:', err);
      return false;
    }
  }

  /**
   * Start listening for step changes.
   * @param onStepChange Callback executed when step updates occur.
   */
  public async startCounting(onStepChange: (steps: number) => void): Promise<void> {
    if (this.isCounting) return;

    const isSupported = await this.isSupported();
    if (!isSupported) {
      console.warn('[StepCounterService] Step counter is not supported or not running on Android.');
      // Mock step counting on non-Android (increment steps periodically for prototype simulation)
      if (Capacitor.getPlatform() !== 'android') {
        this.simulateSteps(onStepChange);
      }
      return;
    }

    const hasPermission = await this.getPermissionStatus();
    if (!hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error('Activity Recognition permission denied by user.');
      }
    }

    try {
      // Reset step state at session start
      this.currentSteps = 0;

      // Register event listener
      this.listenerHandle = await (StepCounter as any).addListener(
        'stepCountChanged',
        (data: StepCountChangedEvent) => {
          console.log(`[StepCounterService] Steps update: ${data.steps} (Total cumulative: ${data.totalCumulativeSteps})`);
          this.currentSteps = data.steps;
          onStepChange(data.steps);
        }
      );

      // Start the native service listener
      await StepCounter.startStepCount();
      this.isCounting = true;
      console.log('[StepCounterService] Native step counting started.');
    } catch (err) {
      console.error('[StepCounterService] Failed to start native step counting:', err);
      this.cleanup();
      throw err;
    }
  }

  /**
   * Stop listening for step changes.
   */
  public async stopCounting(): Promise<void> {
    this.cleanupSimulation();
    if (!this.isCounting) return;

    if (Capacitor.getPlatform() === 'android') {
      try {
        await StepCounter.stopStepCount();
      } catch (err) {
        console.warn('[StepCounterService] Error stopping native step counter:', err);
      }
    }

    this.cleanup();
    console.log('[StepCounterService] Step counting stopped.');
  }

  private cleanup(): void {
    if (this.listenerHandle) {
      this.listenerHandle.remove();
      this.listenerHandle = null;
    }
    this.isCounting = false;
  }

  // --- Prototype Simulation Logic for non-Android platforms ---
  private simulationIntervalId: any = null;
  private simulatedSteps: number = 0;

  private simulateSteps(onStepChange: (steps: number) => void) {
    if (this.simulationIntervalId) return;
    this.isCounting = true;
    this.simulatedSteps = 0;
    this.currentSteps = 0;
    console.log('[StepCounterService] Starting mock steps simulation.');
    this.simulationIntervalId = setInterval(() => {
      // Add random steps between 1 and 5
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
      console.log('[StepCounterService] Stopped mock steps simulation.');
    }
  }
}

export const stepCounterService = new StepCounterService();
