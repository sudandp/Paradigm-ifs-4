/**
 * 50+ Office Skills Suite & Action Dispatcher for Paradigm Digital Companion
 * Grouped into 6 operational domains with slash command routing and intent recognition.
 */

export interface OfficeSkill {
  id: string;
  name: string;
  category: 'communication' | 'notes_tasks' | 'system_launch' | 'hr_attendance' | 'mep_facilities' | 'office_tools';
  categoryTitle: string;
  slashCommand: string;
  icon: string;
  description: string;
  samplePrompt: string;
}

export const ALL_OFFICE_SKILLS: OfficeSkill[] = [
  // ── 1. COMMUNICATION & DRAFTING (10 Skills) ──
  {
    id: 'email_draft',
    name: 'Executive Email Drafter',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/email',
    icon: 'Mail',
    description: 'Draft polite, corporate-standard emails for clients, management, and vendors.',
    samplePrompt: 'Draft an email to client updating them on scheduled transformer maintenance this Sunday.'
  },
  {
    id: 'whatsapp_update',
    name: 'Site WhatsApp Broadcast',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/whatsapp',
    icon: 'MessageSquare',
    description: 'Format concise, bulleted shift updates ready to paste into team WhatsApp groups.',
    samplePrompt: 'Create a WhatsApp broadcast update for the evening shift team regarding gate pass procedures.'
  },
  {
    id: 'incident_report',
    name: 'ISO 9001 Incident Report',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/incident',
    icon: 'FileText',
    description: 'Generate formal MEP, security, or safety incident reports with root cause and CAPA.',
    samplePrompt: 'Generate an incident report for main water line leakage in basement B2 discovered at 03:00 AM.'
  },
  {
    id: 'meeting_minutes',
    name: 'Minutes of Meeting (MoM)',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/mom',
    icon: 'ListChecks',
    description: 'Convert meeting notes into structured MoM with assigned owners and deadlines.',
    samplePrompt: 'Format these notes into formal Minutes of Meeting: discussed pest control, security roster, DG fuel vendor.'
  },
  {
    id: 'circular_memo',
    name: 'Circular & Policy Memo',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/memo',
    icon: 'Send',
    description: 'Draft official company circulars, dress codes, or site notices.',
    samplePrompt: 'Draft a circular memo regarding mandatory safety shoes and ID badge compliance for technical staff.'
  },
  {
    id: 'quotation_followup',
    name: 'Vendor Quotation Follow-up',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/vendor-followup',
    icon: 'FileCheck',
    description: 'Formal procurement and quotation negotiation letter.',
    samplePrompt: 'Write a follow-up email to the chiller AMC vendor requesting their revised quote.'
  },
  {
    id: 'handover_note',
    name: 'Shift Handover Briefing',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/handover',
    icon: 'Repeat',
    description: 'Structured shift briefing for incoming supervisors detailing open tickets and meter readings.',
    samplePrompt: 'Create a Shift Handover briefing for Shift B supervisor: DG on standby, Chiller 1 running, Lift 3 inspected.'
  },
  {
    id: 'leave_application',
    name: 'Formal Leave Application',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/leave-app',
    icon: 'FileSignature',
    description: 'Draft professional leave application letter with duty handover delegation.',
    samplePrompt: 'Draft a formal leave application for 3 days due to personal emergency starting next Monday.'
  },
  {
    id: 'apology_resolution',
    name: 'Client Complaint De-escalation',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/client-apology',
    icon: 'HeartHandshake',
    description: 'Courteous response letter acknowledging tenant/client complaint and providing timeline.',
    samplePrompt: 'Write a polite apology and resolution letter to tenant in Tower A regarding delayed AC cooling.'
  },
  {
    id: 'greeting_wishes',
    name: 'Festival & Birthday Wishes',
    category: 'communication',
    categoryTitle: 'Drafting & Comms',
    slashCommand: '/wishes',
    icon: 'Sparkles',
    description: 'Warm professional greeting messages for team members and corporate clients.',
    samplePrompt: 'Write a warm Diwali / festive greeting message to all site employees from Paradigm Management.'
  },

  // ── 2. LOCAL NOTES & TASKS (8 Skills) ──
  {
    id: 'note_create',
    name: 'Quick Local Note',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/note',
    icon: 'Bookmark',
    description: 'Save a note or equipment reading instantly to on-device storage.',
    samplePrompt: 'Save note: DG fuel tank current reading is 840 Liters, battery voltage 25.4V.'
  },
  {
    id: 'note_search',
    name: 'Search Local Notes',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/notes-find',
    icon: 'Search',
    description: 'Search saved notes, passwords, and equipment logs in local storage.',
    samplePrompt: 'Search my notes for DG diesel'
  },
  {
    id: 'checklist_create',
    name: 'Daily Operational Checklist',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/checklist',
    icon: 'CheckSquare',
    description: 'Generate interactive step-by-step checklist for MEP or housekeeping morning rounds.',
    samplePrompt: 'Generate a morning MEP checklist for DG, STP, Chiller, and Fire pump house.'
  },
  {
    id: 'set_reminder',
    name: 'Schedule Local Reminder',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/remind',
    icon: 'Bell',
    description: 'Set on-device alarm reminder with audio chime and notifications.',
    samplePrompt: 'Remind me in 15 minutes to inspect STP secondary air blower.'
  },
  {
    id: 'scratchpad',
    name: 'Temporary Scratchpad',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/scratchpad',
    icon: 'FileEdit',
    description: 'Open quick scratchpad for temporary numbers and measurements.',
    samplePrompt: 'Open scratchpad'
  },
  {
    id: 'voice_memo',
    name: 'Voice Memo Transcriber',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/voice-memo',
    icon: 'Mic',
    description: 'Capture spoken voice thoughts and polish them into saved notes.',
    samplePrompt: 'Transcribe and organize my voice notes from site inspection.'
  },
  {
    id: 'note_export',
    name: 'Export Notes & Logs',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/export-notes',
    icon: 'Download',
    description: 'Export all local notes to Markdown or JSON backup.',
    samplePrompt: 'Export all my saved local notes to Markdown.'
  },
  {
    id: 'task_prioritizer',
    name: 'Task Prioritizer Matrix',
    category: 'notes_tasks',
    categoryTitle: 'Notes & Tasks',
    slashCommand: '/prioritize',
    icon: 'Kanban',
    description: 'Organize daily pending tasks into Eisenhower Priority Matrix (Urgent vs Important).',
    samplePrompt: 'Prioritize these 5 tasks: fix lift intercom, order diesel, approve leave, submit billing, change filters.'
  },

  // ── 3. SYSTEM LAUNCH & LOCAL CONTROLS (8 Skills) ──
  {
    id: 'launch_ultraviewer',
    name: 'Launch UltraViewer',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/ultraviewer',
    icon: 'Monitor',
    description: 'Open UltraViewer remote desktop application for instant technical support.',
    samplePrompt: 'Open UltraViewer'
  },
  {
    id: 'launch_gmail',
    name: 'Open Gmail',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/gmail',
    icon: 'Mail',
    description: 'Open Gmail inbox or compose window directly.',
    samplePrompt: 'Open Gmail'
  },
  {
    id: 'launch_whatsapp',
    name: 'Open WhatsApp',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/wa',
    icon: 'MessageCircle',
    description: 'Open WhatsApp Web or desktop messaging.',
    samplePrompt: 'Open WhatsApp'
  },
  {
    id: 'launch_anydesk',
    name: 'Launch AnyDesk',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/anydesk',
    icon: 'Monitor',
    description: 'Open AnyDesk remote control tool.',
    samplePrompt: 'Open AnyDesk'
  },
  {
    id: 'launch_calculator',
    name: 'Launch Calculator',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/calc',
    icon: 'Calculator',
    description: 'Open quick mathematical calculator.',
    samplePrompt: 'Open Calculator'
  },
  {
    id: 'launch_calendar',
    name: 'Open Calendar',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/calendar',
    icon: 'Calendar',
    description: 'Open Google Calendar to review scheduled maintenance.',
    samplePrompt: 'Open Calendar'
  },
  {
    id: 'launch_maps',
    name: 'Open Google Maps',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/maps',
    icon: 'MapPin',
    description: 'Open Google Maps navigation to Paradigm site locations.',
    samplePrompt: 'Open Maps'
  },
  {
    id: 'quick_dial',
    name: 'Emergency Direct Dial',
    category: 'system_launch',
    categoryTitle: 'App Launchers',
    slashCommand: '/dial',
    icon: 'PhoneCall',
    description: 'Dial 24x7 control room, fire brigade, or lift OEM directly.',
    samplePrompt: 'Dial emergency control room'
  },

  // ── 4. HR & ATTENDANCE INTELLIGENCE (10 Skills) ──
  {
    id: 'shift_calculator',
    name: 'Shift Timings & Multiplier',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/shift-calc',
    icon: 'Clock',
    description: 'Calculate duty window match for Shift A, B, C, and 14-hour double duty combinations.',
    samplePrompt: 'If employee punched IN at 07:15 AM and OUT at 22:30 PM, is it Shift A+B double duty?'
  },
  {
    id: 'weekly_off_checker',
    name: 'Weekly Off Eligibility',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/weekly-off',
    icon: 'CalendarDays',
    description: 'Verify 6-day duty cycle and maximum 1 W/O per calendar week limit.',
    samplePrompt: 'Explain how Weekly Off is credited after 6 working duties and why only 1 W/O per week is allowed.'
  },
  {
    id: 'punch_regularization',
    name: 'Punch Regularization Drafter',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/punch-req',
    icon: 'FileClock',
    description: 'Generate biometric punch correction request due to biometric machine failure.',
    samplePrompt: 'Draft a biometric punch regularization request for yesterday due to reader error at Gate 2.'
  },
  {
    id: 'salary_slip_explainer',
    name: 'Salary Slip Breakdown',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/salary-help',
    icon: 'Receipt',
    description: 'Explain PF, ESIC, Professional Tax (PT), and gross vs net calculations.',
    samplePrompt: 'Explain the difference between basic salary, gross salary, and PF deduction.'
  },
  {
    id: 'onboarding_guide',
    name: 'New Hire Onboarding Guide',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/onboard-guide',
    icon: 'UserCheck',
    description: 'Step-by-step checklist of Aadhaar, PAN, bank passbook, and police verification.',
    samplePrompt: 'What mandatory documents does a new technician need to submit during onboarding?'
  },
  {
    id: 'uniform_ppe_rules',
    name: 'PPE & Uniform Policy',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/ppe-rules',
    icon: 'Shield',
    description: 'Rules for safety helmets, high-vis vests, arc-flash gloves, and site uniform.',
    samplePrompt: 'What PPE is mandatory for electricians working on 415V LT panels?'
  },
  {
    id: 'overtime_audit',
    name: 'OT vs Double Duty Audit',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/ot-rules',
    icon: 'Calculator',
    description: 'Distinguish between standard 1.0 Duty + OT hours vs 2.0x Double Duty (14h+).',
    samplePrompt: 'Is working 11 hours considered Double Duty or standard duty with Overtime?'
  },
  {
    id: 'leave_balance_rules',
    name: 'Leave Policy & Entitlement',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/leave-rules',
    icon: 'CalendarCheck',
    description: 'Casual leave, sick leave, and privilege leave accumulation and notice rules.',
    samplePrompt: 'How many days of casual leave (CL) does an on-site facility staff get per year?'
  },
  {
    id: 'holiday_calendar',
    name: 'Site Gazetted Holidays',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/holidays',
    icon: 'Award',
    description: 'Review national and state gazetted holidays for Bangalore, Pune, and Hyderabad sites.',
    samplePrompt: 'What are the gazetted paid holidays for Paradigm Bangalore sites this year?'
  },
  {
    id: 'posh_guidelines',
    name: 'POSH Escalation Protocol',
    category: 'hr_attendance',
    categoryTitle: 'HR & Attendance',
    slashCommand: '/posh',
    icon: 'ShieldAlert',
    description: 'Confidential Internal Complaints Committee (ICC) grievance submission process.',
    samplePrompt: 'What is the confidential escalation procedure for POSH complaints?'
  },

  // ── 5. MEP, SECURITY & FACILITIES (10 Skills) ──
  {
    id: 'dg_cold_start',
    name: 'DG Cold Start SOP',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/dg',
    icon: 'Zap',
    description: 'Battery voltage, lube oil, AMF controller, and 415V synchronization checklist.',
    samplePrompt: 'What is the complete SOP to start a cold Diesel Generator (DG)?'
  },
  {
    id: 'stp_operations',
    name: 'STP Aeration & DO Triage',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/stp',
    icon: 'Droplets',
    description: 'SV30 test, Dissolved Oxygen (2-4 mg/L), MLSS target, and blower rotation.',
    samplePrompt: 'What is the procedure if STP dissolved oxygen drops below 1.5 mg/L?'
  },
  {
    id: 'lift_rescue',
    name: 'Passenger Lift Rescue Protocol',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/lift-rescue',
    icon: 'ArrowUpDown',
    description: 'Intercom passenger reassurance, LOTO machine breaker switch off, and manual brake release.',
    samplePrompt: 'Passengers trapped in Lift 2 between 4th and 5th floor, what are the immediate action steps?'
  },
  {
    id: 'fire_panel_triage',
    name: 'Fire Alarm (FACP) Triage',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/fire-panel',
    icon: 'Flame',
    description: '90-second zone verification, false alarm silence, and L1/L2 siren escalation.',
    samplePrompt: 'Smoke detector activated in Basement 1 zone 4, what is the 90-second SOP?'
  },
  {
    id: 'cctv_troubleshooter',
    name: 'CCTV & NVR Diagnostics',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/cctv',
    icon: 'Camera',
    description: 'Offline camera ping, PoE switch restart, and storage overwrite verification.',
    samplePrompt: 'What to check when 4 IP cameras on Pole 3 show video loss?'
  },
  {
    id: 'chiller_hvac',
    name: 'HVAC Chiller Efficiency Check',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/chiller',
    icon: 'Wind',
    description: 'Chiller approach temp, condenser inlet/outlet pressure, and cooling tower basin.',
    samplePrompt: 'What is the normal approach temperature for a water-cooled screw chiller condenser?'
  },
  {
    id: 'transformer_check',
    name: 'Transformer & Substation Audit',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/transformer',
    icon: 'Cpu',
    description: 'Silica gel breather color check (blue vs pink), oil BDV, and winding temp (WTI/OTI).',
    samplePrompt: 'Silica gel in 11kV transformer breather has turned pink, what does this indicate?'
  },
  {
    id: 'wtp_softener',
    name: 'WTP Softener Regeneration',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/wtp',
    icon: 'Waves',
    description: 'Backwash cycle, brine suction concentration, and raw water hardness testing.',
    samplePrompt: 'Explain step-by-step water softener regeneration using NaCl brine solution.'
  },
  {
    id: 'em_lock_reset',
    name: 'Access Control EM Lock Reset',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/em-lock',
    icon: 'Lock',
    description: '12V DC power supply restart, push-to-exit bypass, and biometric controller reset.',
    samplePrompt: 'Server room EM lock failed to release during swipe, how to reset?'
  },
  {
    id: 'pest_control_audit',
    name: 'Pest Control & Fogging SOP',
    category: 'mep_facilities',
    categoryTitle: 'MEP & Facilities',
    slashCommand: '/pest-control',
    icon: 'Bug',
    description: 'Cold fogging schedule, rodent bait box inspection, and tenant notification.',
    samplePrompt: 'What safety precautions must be taken before diesel thermal fogging in basement parking?'
  },

  // ── 6. OFFICE TOOLS & UTILITIES (8 Skills) ──
  {
    id: 'unit_converter',
    name: 'Facility Unit Converter',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/convert',
    icon: 'Scale',
    description: 'Convert kVA to kW, HP to kW, Bar to PSI, and KLD to Gallons.',
    samplePrompt: 'Convert 500 kVA to kW at 0.8 power factor, and 4 bar to PSI.'
  },
  {
    id: 'diesel_calc',
    name: 'DG Fuel Consumption Estimator',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/fuel-calc',
    icon: 'Fuel',
    description: 'Compute liters per hour based on kVA rating and load percentage (50%, 75%, 100%).',
    samplePrompt: 'Estimate diesel consumption for a 250 kVA DG running for 6 hours at 75% load.'
  },
  {
    id: 'eb_power_estimator',
    name: 'EB Power Tariff & MD Estimator',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/eb-calc',
    icon: 'TrendingUp',
    description: 'Estimate maximum demand charges, power factor incentive, and penalty thresholds.',
    samplePrompt: 'What happens if site power factor drops from 0.98 to 0.85 on BESCOM / EB bill?'
  },
  {
    id: 'grammar_polish',
    name: 'Text & Grammar Polisher',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/polish',
    icon: 'SpellCheck',
    description: 'Upgrade rough technician notes into immaculate, clear corporate English.',
    samplePrompt: 'Polish this rough note: "pump making sound water coming out fast need to off breaker"'
  },
  {
    id: 'summarize_3points',
    name: '3-Bullet Executive Summary',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/summarize',
    icon: 'AlignLeft',
    description: 'Condense any long technical audit or vendor contract into 3 sharp executive points.',
    samplePrompt: 'Summarize the chiller maintenance contract into 3 key executive points.'
  },
  {
    id: 'qr_generator',
    name: 'Asset QR Code Formatter',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/qr',
    icon: 'QrCode',
    description: 'Generate QR code asset identification strings and maintenance URLs.',
    samplePrompt: 'Format an asset QR code metadata string for DG-01 in Basement B2.'
  },
  {
    id: 'duty_roster_summary',
    name: 'Who is on Duty Today?',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/roster',
    icon: 'Users',
    description: 'Quick roster query for facility manager, duty technician, and night security.',
    samplePrompt: 'Who is on duty today across morning and night shifts?'
  },
  {
    id: 'vendor_contacts',
    name: 'OEM Vendor Contacts Directory',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/vendors',
    icon: 'Contact',
    description: 'Emergency helpline directory for Kirloskar, Cummins, Otis, Schindler, Voltas.',
    samplePrompt: 'Give emergency helpline numbers for lift and DG OEM vendors.'
  },
  {
    id: 'realtime_clock_shift',
    name: 'Live Time & Operational Shift Status',
    category: 'office_tools',
    categoryTitle: 'Utilities',
    slashCommand: '/time',
    icon: 'Clock',
    description: 'Real-time on-device clock, IST calendar date, active Paradigm shift (A, B, C, GS), and handover countdown.',
    samplePrompt: 'What is the time now and which shift is currently active?'
  }
];

export class SkillsRegistry {
  private static instance: SkillsRegistry;

  public static getInstance(): SkillsRegistry {
    if (!SkillsRegistry.instance) {
      SkillsRegistry.instance = new SkillsRegistry();
    }
    return SkillsRegistry.instance;
  }

  public getAllSkills(): OfficeSkill[] {
    return ALL_OFFICE_SKILLS;
  }

  public getSkillsByCategory(category: string): OfficeSkill[] {
    return ALL_OFFICE_SKILLS.filter(s => s.category === category);
  }

  public findSkillBySlash(cmd: string): OfficeSkill | undefined {
    const clean = cmd.trim().toLowerCase();
    return ALL_OFFICE_SKILLS.find(s => s.slashCommand.toLowerCase() === clean);
  }

  public searchSkills(query: string): OfficeSkill[] {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_OFFICE_SKILLS;

    return ALL_OFFICE_SKILLS.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.slashCommand.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.categoryTitle.toLowerCase().includes(q)
    );
  }
}

export const skillsRegistry = SkillsRegistry.getInstance();
