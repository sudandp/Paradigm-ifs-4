/**
 * Offline Knowledge Base & SOP Grounding Service for Paradigm Assist
 * Caches ISO 9001:2015 verified operations manuals, shift rules, and emergency SOPs
 * locally in IndexedDB / localStorage for zero-hallucination offline inference.
 */

import { supabase } from './supabase';

export interface OfflineSOP {
  id: string;
  title: string;
  category: 'electrical' | 'plumbing' | 'hvac' | 'fire_safety' | 'attendance' | 'security' | 'general';
  keywords: string[];
  summary: string;
  steps: string[];
  safetyWarnings?: string[];
  contacts?: { role: string; phone: string }[];
  updatedAt: string;
}

const LOCAL_STORAGE_KEY = 'paradigm_offline_sops_v1';
const LAST_SYNC_KEY = 'paradigm_offline_sops_last_sync';

// Default bundled ISO 9001:2015 operational SOPs
const BUNDLED_SOPS: OfflineSOP[] = [
  {
    id: 'sop-dg-cold-start',
    title: 'DG Cold Start Standard Operating Procedure',
    category: 'electrical',
    keywords: ['dg', 'diesel generator', 'cold start', 'amf', 'battery voltage', 'fuel', 'lube oil', 'radiator'],
    summary: 'Step-by-step cold startup and verification checklist for Diesel Generators.',
    steps: [
      'Pre-start check: Verify DG battery terminal voltage is >= 24V DC.',
      'Check Diesel fuel tank level indicator (minimum 70% required for auto-failover).',
      'Inspect lube oil dipstick level (between MIN and MAX markings).',
      'Check coolant level in radiator expansion tank and ensure no visible leaks.',
      'Ensure AMF (Auto Mains Failure) controller is switched from AUTO to MANUAL for testing, or AUTO for standby mode.',
      'Turn key / press START button for crank (do not crank continuously for more than 10 seconds).',
      'Once running, verify engine oil pressure reaches 3.5 to 5.0 kg/cm2 within 15 seconds.',
      'Verify generator output voltage stabilizes at 415V AC (+/- 2%) and 50 Hz frequency before closing circuit breaker.'
    ],
    safetyWarnings: [
      'Never open radiator cap when engine is hot (severe scalding risk).',
      'Wear ear protection (DG noise level exceeds 85 dBA during full load operation).'
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sop-stp-aeration',
    title: 'STP Aeration & Dissolved Oxygen (DO) Maintenance',
    category: 'plumbing',
    keywords: ['stp', 'aeration', 'dissolved oxygen', 'do', 'blower', 'mlss', 'sewage treatment'],
    summary: 'Operational procedure for aeration tanks, air blowers, and DO testing.',
    steps: [
      'Verify air blower pressure gauge reads between 0.3 to 0.5 kg/cm2.',
      'Inspect aeration tank surface for uniform rolling boil pattern (no dead pockets).',
      'Measure Dissolved Oxygen (DO) using digital probe: Maintain between 2.0 to 4.0 mg/L in aeration zone.',
      'Perform 30-minute SV30 settleability test in graduated cylinder: Settled sludge should be 200 - 350 mL/L.',
      'If DO is below 1.5 mg/L, rotate and activate secondary air blower immediately.',
      'Check MLSS (Mixed Liquor Suspended Solids) target range: 2500 - 3500 mg/L.'
    ],
    safetyWarnings: [
      'Confined space hazard: Ensure forced air exhaust ventilation is running before entering blower room.'
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sop-lift-entrapment',
    title: 'Passenger Lift Entrapment Rescue Protocol',
    category: 'security',
    keywords: ['lift', 'elevator', 'entrapment', 'passenger trapped', 'brake release', 'landing key', 'rescue'],
    summary: 'Emergency evacuation SOP for passengers stranded inside an elevator car.',
    steps: [
      'Communicate immediately via lift intercom: Reassure passengers they are safe and emergency ventilation is active.',
      'Instruct passengers to stand away from doors and NEVER attempt to pry car doors open.',
      'Switch OFF the 3-phase main power supply breaker for the lift in the machine room (LOTO procedure).',
      'Check floor indicator marking on hoisting ropes to determine car position relative to nearest floor.',
      'If car is within leveling zone (+/- 300mm), use emergency landing door key to open doors and assist passengers out.',
      'If car is between floors: Manual Brake Release operation. 2 technicians required. Carefully ease brake lever to allow car to drift gently to nearest floor marking.',
      'Release brake lever to lock car in place, then open landing doors using key.',
      'Keep lift powered off and lock doors until OEM certified elevator technician inspects the unit.'
    ],
    safetyWarnings: [
      'CRITICAL: Never attempt manual brake release alone. Requires 2 trained technicians.',
      'Always switch off machine room power breaker before touching hoisting motor.'
    ],
    contacts: [
      { role: 'Lift OEM 24x7 Helpdesk', phone: '1800-102-3344' },
      { role: 'Site Facility Manager', phone: '+91 98450 12345' }
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sop-fire-gas-emergency',
    title: 'Fire & Gas Emergency Escalation SOP',
    category: 'fire_safety',
    keywords: ['fire', 'gas leak', 'smoke', 'mcp', 'manual call point', 'sprinkler', 'l1', 'l2', 'l3', 'evacuation'],
    summary: 'Immediate action plan upon fire detection or gas alarm trigger.',
    steps: [
      'L1 (Local Alarm): Security guard verifies zone alarm at Fire Alarm Control Panel (FACP) within 90 seconds.',
      'If confirmed fire: Break nearest Manual Call Point (MCP) and initiate public address (PA) system announcement.',
      'Deploy appropriate fire extinguisher: Type A (Water/Foam for solid fuels), Type B/C (CO2 / Dry Powder for electrical/gas fires).',
      'Never use water on electrical panels or transformers.',
      'Shut off main LPG / PNG supply ball valve at gas bank manifold immediately.',
      'L2/L3 Escalation: Sound site evacuation siren and dial 101 (Fire Brigade) and 108 (Ambulance).',
      'Assemble all building occupants at designated Assembly Point.'
    ],
    contacts: [
      { role: 'National Fire Emergency', phone: '101' },
      { role: 'National Medical Emergency', phone: '108' },
      { role: 'Site Security Control Room', phone: '+91 98450 99999' }
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sop-shift-attendance-rules',
    title: 'Paradigm Shift Timings, Double Duty & Attendance Rules',
    category: 'attendance',
    keywords: ['shift', 'timings', 'duty', 'weekly off', 'double duty', 'a shift', 'b shift', 'c shift', 'a+b', 'b+c', 'a+c', 'multiplier'],
    summary: 'Official attendance calculation and shift slot rules for Paradigm Facility Operations.',
    steps: [
      'Shift A (Morning): Arrival 05:00 - 11:30. Typical span 07:00 to 15:00. Multiplier 1.0x.',
      'Shift B (Afternoon): Arrival 11:30 - 18:30. Typical span 14:00 to 22:00. Multiplier 1.0x.',
      'Shift C (Night): Arrival 18:30 - 23:59. Typical span 21:00/22:00 to 06:00/07:00 next day. Anchored to Day 1 (IN Date). Multiplier 1.0x. Morning exit before 10:00 AM belongs to Day 1 night shift.',
      'Double Duty (2.0x Multiplier): Requires continuous work of >= 14 hours across two shift windows (A+B: 06:00 to 22:00+, B+C: 13:30 to 06:00+ next day, A+C: Morning A + Night C on same date).',
      'Overtime vs Double Duty: Working 10 to 12 hours is 1.0 Duty + Overtime hours, NOT Double Duty.',
      'Weekly Off (W/O): Earned after 6 completed working duties. Strictly capped at MAXIMUM 1 Weekly Off per calendar week (Monday to Sunday).'
    ],
    updatedAt: new Date().toISOString()
  }
];

export class OfflineKnowledgeBase {
  private static instance: OfflineKnowledgeBase;
  private sops: OfflineSOP[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): OfflineKnowledgeBase {
    if (!OfflineKnowledgeBase.instance) {
      OfflineKnowledgeBase.instance = new OfflineKnowledgeBase();
    }
    return OfflineKnowledgeBase.instance;
  }

  /**
   * Load SOPs from local storage or fallback to bundled defaults
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.sops = JSON.parse(stored);
      } else {
        this.sops = BUNDLED_SOPS;
        this.saveToStorage();
      }
    } catch {
      this.sops = BUNDLED_SOPS;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.sops));
    } catch (e) {
      console.warn('Failed to save SOPs to localStorage:', e);
    }
  }

  /**
   * Sync newest SOPs from Supabase whenever online
   */
  public async syncWithCloud(): Promise<boolean> {
    if (!navigator.onLine) return false;

    try {
      const { data, error } = await supabase
        .from('assist_sops')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Map Supabase rows to local structure
        const cloudSOPs: OfflineSOP[] = data.map((d: any) => ({
          id: d.id,
          title: d.title || d.name,
          category: d.category || 'general',
          keywords: d.keywords || [],
          summary: d.summary || d.description || '',
          steps: Array.isArray(d.steps) ? d.steps : (d.content ? d.content.split('\n') : []),
          safetyWarnings: d.safety_warnings || [],
          contacts: d.contacts || [],
          updatedAt: d.updated_at || new Date().toISOString()
        }));

        this.sops = cloudSOPs;
        this.saveToStorage();
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        return true;
      }
    } catch (err) {
      console.warn('Background SOP sync failed, continuing with cached SOPs:', err);
    }
    return false;
  }

  /**
   * Match user query to the most relevant SOPs using keyword & token overlap
   */
  public searchRelevantSOPs(query: string, maxResults = 2): OfflineSOP[] {
    const stopWords = new Set(['what', 'are', 'the', 'things', 'you', 'can', 'how', 'does', 'this', 'that', 'with', 'for', 'and', 'tell', 'show', 'give', 'need', 'about', 'from', 'have', 'your', 'help', 'please', 'know', 'some', 'where', 'when', 'which', 'who', 'why']);
    const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2 && !stopWords.has(t));
    if (tokens.length === 0) return [];

    const scored = this.sops.map(sop => {
      let score = 0;
      const titleLower = sop.title.toLowerCase();
      const summaryLower = sop.summary.toLowerCase();
      const stepsLower = sop.steps.join(' ').toLowerCase();

      for (const token of tokens) {
        // High weight for keyword matches
        if (sop.keywords.some(k => k.toLowerCase().includes(token))) score += 5;
        // High weight for title match
        if (titleLower.includes(token)) score += 4;
        // Medium weight for summary
        if (summaryLower.includes(token)) score += 2;
        // Low weight for step text
        if (stepsLower.includes(token)) score += 1;
      }

      return { sop, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score >= 4).slice(0, maxResults).map(s => s.sop);
  }

  /**
   * Format matched SOPs into clean system context for Qwen 2.5
   */
  public buildGroundingPrompt(query: string): string {
    const matched = this.searchRelevantSOPs(query, 2);
    if (matched.length === 0) {
      return '';
    }

    let context = '### VERIFIED PARADIGM OPERATIONAL MANUALS (GROUNDING CONTEXT):\n';
    matched.forEach((sop, idx) => {
      context += `\n[Document ${idx + 1}: ${sop.title}]\n`;
      context += `Summary: ${sop.summary}\n`;
      if (sop.safetyWarnings && sop.safetyWarnings.length > 0) {
        context += `SAFETY WARNINGS:\n- ${sop.safetyWarnings.join('\n- ')}\n`;
      }
      context += `STEPS:\n${sop.steps.map((st, i) => `${i + 1}. ${st}`).join('\n')}\n`;
      if (sop.contacts && sop.contacts.length > 0) {
        context += `EMERGENCY CONTACTS:\n${sop.contacts.map(c => `- ${c.role}: ${c.phone}`).join('\n')}\n`;
      }
    });

    return context;
  }
}

export const offlineKnowledgeBase = OfflineKnowledgeBase.getInstance();
