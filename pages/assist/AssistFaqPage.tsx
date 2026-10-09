import React, { useState } from 'react';
import {
  HelpCircle, BookOpen, Search, ArrowRight, Sparkles, CheckCircle2,
  ChevronDown, ChevronUp, ShieldCheck, Zap, Droplets, Users, Flame,
  FileText, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  summary: string;
  detailedAnswer: string[];
  referenceDoc: string;
  tags: string[];
}

export const AssistFaqPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>('dg-cold-start');

  const categories = [
    'All',
    'DG & Electrical',
    'STP & Water Treatment',
    'Lifts & Elevators',
    'Attendance & Shifts',
    'Fire & Safety',
    'General Operations'
  ];

  const faqs: FaqItem[] = [
    {
      id: 'dg-cold-start',
      category: 'DG & Electrical',
      question: 'What is the standard procedure to start a cold Diesel Generator (DG)?',
      summary: 'Pre-checks on starter battery voltage, fuel day tank levels, radiator coolant, and AMF panel selector sequence.',
      detailedAnswer: [
        'Step 1: Check DG Starter Battery Voltage — ensure voltage is ≥ 24.5V DC across terminals.',
        'Step 2: Inspect Fuel Day Tank Level — verify fuel level is at least 70% full, with fuel valves open and no visible sediment.',
        'Step 3: Check Radiator Coolant Level & Engine Lube Oil — inspect dipstick to confirm oil level between Min and Max markers.',
        'Step 4: Check Air Filter Restriction Indicator — ensure indicator is in clear green zone.',
        'Step 5: AMF Panel Set to Manual Mode — press START push button on controller and observe engine cranking for 3 to 5 seconds.',
        'Step 6: Confirm Engine RPM reaches rated 1500 RPM, frequency stabilizes at 50 Hz ± 0.5 Hz, and terminal voltage reaches 415V AC phase-to-phase.',
        'Step 7: Allow engine to idle without load for 2-3 minutes to reach normal lube oil pressure (3.5 to 5.0 kg/cm²) before closing DG breaker.'
      ],
      referenceDoc: 'SOP-DG-001 (ISO 9001:2015 MEP Operations)',
      tags: ['DG', 'Diesel Generator', 'AMF', 'Power Backup', 'Cold Start']
    },
    {
      id: 'stp-parameters',
      category: 'STP & Water Treatment',
      question: 'What are the required operational parameters for the STP Aeration Tank?',
      summary: 'Dissolved Oxygen (DO), MLSS concentration, blower cycling, and daily return activated sludge (RAS) ratios.',
      detailedAnswer: [
        'Dissolved Oxygen (DO): Maintain between 2.0 to 4.0 mg/L in aeration tank. Check using digital DO meter at 09:00 AM and 03:00 PM.',
        'Mixed Liquor Suspended Solids (MLSS): Optimum range is 2500 to 3500 mg/L for conventional activated sludge, or 6000 to 8000 mg/L for MBR systems.',
        'Sludge Volume Index (SVI): 30-minute settleability test in 1000ml graduated cylinder should yield 250ml to 350ml settled volume.',
        'Air Blower Operation: Run air blowers on alternating 4-hour cycles to prevent overheating while maintaining continuous fine-bubble aeration.',
        'Treated Water Quality Standards: pH 6.5 - 8.5, BOD < 10 mg/L, COD < 50 mg/L, TSS < 10 mg/L, Turbidity < 2 NTU for flushing and gardening reuse.'
      ],
      referenceDoc: 'SOP-STP-004 (Environmental Compliance Manual)',
      tags: ['STP', 'Aeration', 'MLSS', 'Dissolved Oxygen', 'Water Treatment']
    },
    {
      id: 'lift-entrapment',
      category: 'Lifts & Elevators',
      question: 'What is the step-by-step rescue procedure when a passenger is trapped in an elevator?',
      summary: 'Intercom reassurance, machine room breaker isolation, manual motor brake pulsing, and landing door key extraction.',
      detailedAnswer: [
        'Immediate Passenger Reassurance: Speak via lift car intercom immediately. Advise passengers to remain calm and confirm emergency ventilation fan is active.',
        'Safety Lockout: Go to the machine room, switch OFF the main 3-phase incoming isolator switch for the affected lift, and tag out.',
        'Car Position Check: Inspect the hoist ropes and leveling markings on the main traction sheave to determine closest floor landing.',
        'Manual Brake Release: Two technicians required. One technician gently pulls the manual brake release lever in brief controlled pulses while second technician watches flywheel indicator.',
        'Floor Level Alignment: Stop when cable marker matches the landing floor level line.',
        'Extraction: Use the designated triangular landing door key to open landing doors, hold car door open, and assist passengers safely out.',
        'Post-incident: Keep elevator isolated and log call with Lift OEM AMC emergency hotline immediately.'
      ],
      referenceDoc: 'SOP-LIFT-002 (Life Safety & Passenger Extraction)',
      tags: ['Lift', 'Elevator', 'Entrapment', 'Passenger Safety', 'Brake Release']
    },
    {
      id: 'shift-attendance-rules',
      category: 'Attendance & Shifts',
      question: 'What are the official shift timings, double duty criteria, and weekly off rules?',
      summary: 'Window matching for Shift A, B, C; 14-hour continuous criteria for 2.0x Double Duty; strictly 1 Weekly Off per calendar week.',
      detailedAnswer: [
        'Shift A (Morning): Arrival between 05:00 and 11:30. Multiplier 1.0.',
        'Shift B (Afternoon): Arrival between 11:30 and 18:30. Multiplier 1.0.',
        'Shift C (Night): Arrival between 18:30 and 23:59. Duty anchored to Day 1 (IN date). Morning punch-out before 10:00 AM next day closes Day 1 duty.',
        'Double Duty Combinations (2.0x Multiplier): Strictly requires ≥ 14 hours across two shift brackets (A+B: 06:00-08:30 IN to ≥22:00 OUT; B+C: 13:30-15:30 IN to ≥06:00 AM OUT next day). Note: 10-12 hours is 1.0 Duty + OT hours, NOT double duty.',
        'Weekly Off (W/O): Entitled after 6 completed working duties. Strictly capped at maximum 1 Weekly Off per calendar week (Monday to Sunday). Extra unworked days are marked Absent (A).'
      ],
      referenceDoc: 'POL-ATT-2026 (Paradigm Attendance & Dynamic Shift Engine Policy)',
      tags: ['Attendance', 'Shifts', 'Shift A', 'Shift B', 'Shift C', 'Double Duty', 'Weekly Off']
    },
    {
      id: 'fire-escalation',
      category: 'Fire & Safety',
      question: 'What is the fire emergency response and escalation protocol?',
      summary: 'Manual call point trigger, stairwell evacuation, extinguisher deployment, and L1-L3 escalation matrix.',
      detailedAnswer: [
        'Phase 1: Alert & Alarm: Break glass / trigger Manual Call Point (MCP) immediately. Public address announcement to evacuate.',
        'Phase 2: Evacuation: Escort occupants to the external assembly point via fire stairs. Never use lifts.',
        'Phase 3: Isolation: Cut main electrical LT feeder breaker and close main LPG/PNG gas valve.',
        'Phase 4: Suppression: Deploy portable CO2/DCP fire extinguishers only for minor localized blazes.',
        'Phase 5: Emergency Escalation: Call Fire Brigade (101), Paradigm 24x7 HQ Helpdesk (+91 80 4114 2666), and Site Facility Manager.'
      ],
      referenceDoc: 'SOP-FIRE-001 (Emergency Response Plan)',
      tags: ['Fire', 'Emergency', 'Evacuation', 'Safety', 'Call Point']
    },
    {
      id: 'transformer-checks',
      category: 'DG & Electrical',
      question: 'What daily checks are required for the Oil-Filled HT Transformer Yard?',
      summary: 'WTI/OTI temperature gauges, silica gel breather color, oil level indicator, and earth pit connections.',
      detailedAnswer: [
        'Check Winding Temperature Indicator (WTI) and Oil Temperature Indicator (OTI) — ensure readings are < 65°C under normal ambient load.',
        'Inspect Silica Gel Breather: Breather crystals must be deep blue. If crystals have turned pink, replace or regenerate silica gel immediately.',
        'Check Magnetic Oil Gauge (MOG) on conservator tank: Level must be at or above 50% mark.',
        'Inspect for oil leaks around bushings, drain valves, and radiator fins.',
        'Inspect earth pit connections and neutral grounding for tightness and zero physical oxidation.'
      ],
      referenceDoc: 'SOP-HT-003 (Substation & Transformer Maintenance)',
      tags: ['Transformer', 'HT Yard', 'Silica Gel', 'WTI', 'OTI', 'Substation']
    }
  ];

  const filteredFaqs = faqs.filter(f => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.summary.toLowerCase().includes(search.toLowerCase()) ||
      f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Operations Knowledge Base & FAQs
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                  ISO 9001:2015 Verified
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Operational Guidelines, Equipment Checklists, and Technical Reference Manuals
              </p>
            </div>
          </div>
        </div>

        {/* AI Copilot Prompt Launcher */}
        <button
          onClick={() => navigate('/assist')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch AI Copilot Chat</span>
        </button>
      </div>

      {/* ── Search & Category Filter ── */}
      <div className="space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQs, equipment SOPs, technical parameters, or shift rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── FAQ Accordion List ── */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm">
            No knowledge base entries found matching "{search}". You can query the <strong className="text-emerald-600 cursor-pointer" onClick={() => navigate('/assist')}>Paradigm Assist AI Copilot</strong> for dynamic assistance.
          </div>
        ) : (
          filteredFaqs.map(faq => {
            const isExpanded = expandedId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-2xl border transition bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                  className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {faq.category}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {faq.referenceDoc}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {faq.question}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {faq.summary}
                    </p>
                  </div>

                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Detailed Answer */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-3.5">
                    <div className="space-y-2">
                      {faq.detailedAnswer.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {faq.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => navigate('/assist')}
                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1.5"
                      >
                        <span>Ask AI Copilot for more specifics</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssistFaqPage;
