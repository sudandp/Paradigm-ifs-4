/**
 * App Launcher Service
 * Facilitates deep-linking and web opening for desktop & mobile apps (Gmail, UltraViewer, WhatsApp, Calculator, etc.)
 * Provides metadata for 1-click Action Cards to bypass browser popup blockers.
 */

export interface LaunchableApp {
  id: string;
  name: string;
  category: 'remote_desktop' | 'communication' | 'productivity' | 'utilities';
  icon: string;
  protocolUrl: string;
  webFallbackUrl: string;
  description: string;
}

export const SUPPORTED_APPS: Record<string, LaunchableApp> = {
  ultraviewer: {
    id: 'ultraviewer',
    name: 'UltraViewer',
    category: 'remote_desktop',
    icon: 'Monitor',
    protocolUrl: 'ultraviewer://',
    webFallbackUrl: 'https://ultraviewer.net/en/download.html',
    description: 'Remote desktop control and screen sharing support tool'
  },
  anydesk: {
    id: 'anydesk',
    name: 'AnyDesk',
    category: 'remote_desktop',
    icon: 'Monitor',
    protocolUrl: 'anydesk://',
    webFallbackUrl: 'https://anydesk.com',
    description: 'Fast remote desktop connection software'
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    category: 'communication',
    icon: 'Mail',
    protocolUrl: 'googlegmail://',
    webFallbackUrl: 'https://mail.google.com',
    description: 'Corporate and personal email inbox'
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'communication',
    icon: 'MessageCircle',
    protocolUrl: 'whatsapp://',
    webFallbackUrl: 'https://web.whatsapp.com',
    description: 'WhatsApp Web & desktop messaging'
  },
  calendar: {
    id: 'calendar',
    name: 'Google Calendar',
    category: 'productivity',
    icon: 'Calendar',
    protocolUrl: 'webcal://',
    webFallbackUrl: 'https://calendar.google.com',
    description: 'Schedules, meetings, and shift duty calendar'
  },
  calculator: {
    id: 'calculator',
    name: 'Calculator',
    category: 'utilities',
    icon: 'Calculator',
    protocolUrl: 'calculator:',
    webFallbackUrl: 'https://www.google.com/search?q=calculator',
    description: 'Quick math and unit calculation tool'
  },
  maps: {
    id: 'maps',
    name: 'Google Maps',
    category: 'utilities',
    icon: 'MapPin',
    protocolUrl: 'geo:0,0',
    webFallbackUrl: 'https://maps.google.com',
    description: 'Location navigation and site directions'
  }
};

export class AppLauncherService {
  private static instance: AppLauncherService;

  public static getInstance(): AppLauncherService {
    if (!AppLauncherService.instance) {
      AppLauncherService.instance = new AppLauncherService();
    }
    return AppLauncherService.instance;
  }

  /**
   * Launch application using protocol with web fallback
   */
  public launchApp(appId: string, params?: { query?: string; email?: string }): { success: boolean; app: LaunchableApp } {
    const app = SUPPORTED_APPS[appId.toLowerCase()];
    if (!app) {
      throw new Error(`Unsupported application: ${appId}`);
    }

    let targetUrl = app.webFallbackUrl;

    if (app.id === 'gmail' && params?.email) {
      targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.email)}`;
    } else if (app.id === 'whatsapp' && params?.query) {
      targetUrl = `https://wa.me/?text=${encodeURIComponent(params.query)}`;
    }

    // Attempt protocol open first, then web fallback window
    try {
      if (app.protocolUrl.startsWith('http')) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Try protocol scheme
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = app.protocolUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);

        // Open fallback tab after brief delay if needed
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    return { success: true, app };
  }

  /**
   * Detect app launch intents from natural language
   */
  public detectLaunchIntent(text: string): LaunchableApp | null {
    const lower = text.toLowerCase();
    if (/(open|launch|start|run)\s+(ultraviewer|ultra\s*viewer)/i.test(lower)) {
      return SUPPORTED_APPS.ultraviewer;
    }
    if (/(open|launch|start|run)\s+(anydesk|any\s*desk)/i.test(lower)) {
      return SUPPORTED_APPS.anydesk;
    }
    if (/(open|launch|start|check)\s+(gmail|email|mail)/i.test(lower)) {
      return SUPPORTED_APPS.gmail;
    }
    if (/(open|launch|start)\s+(whatsapp|wa)/i.test(lower)) {
      return SUPPORTED_APPS.whatsapp;
    }
    if (/(open|launch|start)\s+(calculator|calc)/i.test(lower)) {
      return SUPPORTED_APPS.calculator;
    }
    if (/(open|launch|start|check)\s+(calendar|schedule)/i.test(lower)) {
      return SUPPORTED_APPS.calendar;
    }
    if (/(open|launch|start)\s+(maps|google\s*maps|directions)/i.test(lower)) {
      return SUPPORTED_APPS.maps;
    }
    return null;
  }
}

export const appLauncherService = AppLauncherService.getInstance();
