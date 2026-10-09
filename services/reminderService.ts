/**
 * Reminder & Scheduler Service
 * Schedules on-device alarms and notifications for tasks, patrol rounds, and meetings.
 * Uses Web Notifications API with an automatic fallback to Web Audio synthetic chimes and in-app toasts.
 */

import toast from 'react-hot-toast';

export interface LocalReminder {
  id: string;
  title: string;
  dueAt: string; // ISO String
  isTriggered: boolean;
  createdAt: string;
}

const REMINDERS_KEY = 'paradigm_local_reminders_v1';

export class ReminderService {
  private static instance: ReminderService;
  private reminders: LocalReminder[] = [];
  private activeTimers: Map<string, number> = new Map();

  private constructor() {
    this.loadReminders();
    this.restorePendingTimers();
  }

  public static getInstance(): ReminderService {
    if (!ReminderService.instance) {
      ReminderService.instance = new ReminderService();
    }
    return ReminderService.instance;
  }

  private loadReminders() {
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      if (raw) {
        this.reminders = JSON.parse(raw);
      }
    } catch {
      this.reminders = [];
    }
  }

  private saveReminders() {
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(this.reminders));
    } catch (e) {
      console.warn('Failed to save reminders:', e);
    }
  }

  public getReminders(): LocalReminder[] {
    return [...this.reminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  /**
   * Request system notification permission
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  }

  /**
   * Synthetic audio chime using Web Audio API (works without external mp3 files)
   */
  public playAudioChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  }

  /**
   * Schedule a new reminder
   */
  public scheduleReminder(title: string, delayMs: number): LocalReminder {
    const dueTime = new Date(Date.now() + Math.max(delayMs, 1000));
    const reminder: LocalReminder = {
      id: `rem_${Date.now()}`,
      title: title.trim(),
      dueAt: dueTime.toISOString(),
      isTriggered: false,
      createdAt: new Date().toISOString()
    };

    this.reminders.push(reminder);
    this.saveReminders();

    this.startTimer(reminder, delayMs);
    return reminder;
  }

  private startTimer(reminder: LocalReminder, delayMs: number) {
    if (this.activeTimers.has(reminder.id)) {
      window.clearTimeout(this.activeTimers.get(reminder.id));
    }

    const timerId = window.setTimeout(() => {
      this.triggerReminder(reminder);
    }, delayMs);

    this.activeTimers.set(reminder.id, timerId);
  }

  private restorePendingTimers() {
    const now = Date.now();
    this.reminders.forEach(rem => {
      if (!rem.isTriggered) {
        const remainingMs = new Date(rem.dueAt).getTime() - now;
        if (remainingMs > 0) {
          this.startTimer(rem, remainingMs);
        } else {
          // Passed while offline/closed
          rem.isTriggered = true;
        }
      }
    });
    this.saveReminders();
  }

  private triggerReminder(reminder: LocalReminder) {
    reminder.isTriggered = true;
    this.saveReminders();
    this.activeTimers.delete(reminder.id);

    this.playAudioChime();

    // 1. Try OS Notification
    let notificationShown = false;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🔔 Paradigm Reminder', {
          body: reminder.title,
          icon: '/favicon.ico'
        });
        notificationShown = true;
      } catch {
        notificationShown = false;
      }
    }

    // 2. Always show in-app high-visibility alert
    toast(
      (t) => (
        `⏰ Reminder: ${reminder.title}`
      ),
      {
        duration: 8000,
        icon: '🔔',
        style: {
          borderRadius: '16px',
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155'
        }
      }
    );
  }

  /**
   * Parse natural language reminder string e.g. "remind me in 10 minutes to check STP"
   */
  public parseNaturalReminder(text: string): { title: string; delayMs: number } | null {
    const lower = text.toLowerCase();
    const match = lower.match(/remind\s+(?:me\s+)?(?:in\s+)?(\d+)\s*(min|minute|minutes|hr|hour|hours|sec|second|seconds)?(?:\s+to|\s+that|\s+about)?\s*(.*)/i);
    
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2] || 'minute';
    const task = match[3]?.trim() || 'Check scheduled task';

    let delayMs = amount * 60 * 1000;
    if (unit.startsWith('hr') || unit.startsWith('hour')) {
      delayMs = amount * 60 * 60 * 1000;
    } else if (unit.startsWith('sec')) {
      delayMs = amount * 1000;
    }

    return { title: task, delayMs };
  }

  public deleteReminder(id: string) {
    if (this.activeTimers.has(id)) {
      window.clearTimeout(this.activeTimers.get(id));
      this.activeTimers.delete(id);
    }
    this.reminders = this.reminders.filter(r => r.id !== id);
    this.saveReminders();
  }
}

export const reminderService = ReminderService.getInstance();
