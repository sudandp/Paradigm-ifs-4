import React, { useState, useEffect } from 'react';
import {
  Phone, ShieldAlert, AlertTriangle, Flame, Zap, Users, Search,
  ArrowRight, ShieldCheck, MapPin, Clock, PhoneCall, ExternalLink,
  ChevronRight, LifeBuoy, AlertOctagon, Droplets
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAssistStore } from '../../store/assistStore';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

export const EmergencyHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { sites, selectedSiteId, setSelectedSiteId, offlineEmergencyContacts } = useAssistStore();
  const [activeTab, setActiveTab] = useState<'contacts' | 'protocols'>('contacts');
  const [search, setSearch] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<number | null>(0);

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteDisplayName = selectedSite ? selectedSite.name : 'All Paradigm Sites';

  const centralEmergencyNumbers = [
    { title: 'Paradigm 24x7 Central Helpdesk', phone: '+91 80 4114 2666', role: 'HQ Central Command Desk', tat: 'Instant (24/7)', priority: 'P0 Critical', color: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' },
    { title: 'Operations Director on Duty', phone: '+91 98450 12345', role: 'Executive Escalation', tat: '< 15 mins', priority: 'P1 Escalation', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' },
    { title: 'Central MEP / Technical SME', phone: '+91 98450 67890', role: 'HVAC, Lift & Electrical Lead', tat: '45-60 mins', priority: 'Technical Support', color: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300' },
    { title: 'National Fire Emergency', phone: '101', role: 'Government Fire & Rescue', tat: 'Instant', priority: 'National Helpline', color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' },
    { title: 'National Medical Ambulance', phone: '108', role: 'Government Emergency Medical', tat: 'Instant', priority: 'National Helpline', color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' },
    { title: 'National Police Control Room', phone: '100', role: 'Police & Law Enforcement', tat: 'Instant', priority: 'National Helpline', color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' }
  ];

  const protocols = [
    {
      id: 0,
      title: 'Fire / Smoke Outbreak Emergency',
      category: 'Life Safety',
      icon: Flame,
      color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/30',
      description: 'Immediate action plan upon sensing smoke, active fire alarm activation, or manual call point trigger.',
      steps: [
        'Sound the Manual Call Point (MCP) / Fire Alarm immediately to notify all occupants.',
        'Evacuate people via fire exit stairways immediately. Strictly NEVER use elevators / lifts.',
        'Deploy CO2 / ABC Dry Chemical Powder fire extinguisher ONLY if safe and fire is in incipient stage.',
        'Isolate the main electrical circuit breaker in the LT panel and close the main piped LPG / PNG gas valve.',
        'Dial 101 for Fire Brigade, notify Site Facility Manager, and escalate to Paradigm 24x7 HQ Helpdesk.',
        'Direct crowd to the designated Assembly Point and conduct headcount with attendance muster roll.'
      ]
    },
    {
      id: 1,
      title: 'Lift / Elevator Passenger Entrapment',
      category: 'Vertical Transport',
      icon: Users,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/30',
      description: 'Step-by-step rescue protocol when passengers are trapped in an elevator car due to power trip or fault.',
      steps: [
        'Communicate immediately via lift intercom: Assure passengers that air ventilation is flowing and help is on the way.',
        'Verify car location using Machine Room floor indicators or shaft indicator lights.',
        'Switch OFF the main 3-phase isolator power supply to the affected lift in the machine room.',
        'Carefully release the manual motor brake in slow pulses to align the car to the nearest landing level mark.',
        'Verify brake is securely locked before opening the landing door using the triangular emergency landing key.',
        'Safely assist passengers out of the car. Escalate immediately to the Lift OEM AMC engineer for inspection.'
      ]
    },
    {
      id: 2,
      title: 'Electrical Shock & Arc Flash Incidents',
      category: 'MEP Electrical',
      icon: Zap,
      color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20 border-yellow-300 dark:border-yellow-500/30',
      description: 'High-voltage or low-voltage electrical contact safety protocols.',
      steps: [
        'DO NOT touch the victim directly with bare hands while they are in contact with the live conductor.',
        'Trip the main breaker / feeder switch immediately at the LT/HT panel.',
        'If power cannot be tripped quickly, use dry non-conductive wooden stick or rubber insulation pole to separate the victim.',
        'Check pulse and breathing. If victim is unresponsive, start CPR immediately if trained.',
        'Call 108 medical emergency and inform Paradigm HQ helpdesk immediately.'
      ]
    },
    {
      id: 3,
      title: 'LPG / PNG Gas Leakage at Commercial Kitchens',
      category: 'Hazardous Gas',
      icon: AlertOctagon,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/30',
      description: 'Escalation procedure when gas odor is detected in utility manifolds or kitchens.',
      steps: [
        'Turn OFF the main emergency gas shutoff valve (ESV) at the gas bank manifold.',
        'DO NOT operate any electrical switches, light switches, or mobile phones inside the affected room.',
        'Open all doors and windows to provide natural cross-ventilation.',
        'Evacuate kitchen and cafeteria staff to fresh air immediately.',
        'Use gas detector or soapy water solution on joints to detect leak origin. Contact gas utility vendor.'
      ]
    },
    {
      id: 4,
      title: 'Basement Flooding & Sump Pump Failure',
      category: 'Plumbing & Stormwater',
      icon: Droplets,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-500/30',
      description: 'Severe water ingress into electrical substations, basements, or lift pits.',
      steps: [
        'If water level threatens electrical switchboards, trip power to the flooded section immediately.',
        'Inspect storm water sump pumps: Switch from Auto to Manual mode on the starter panel.',
        'Deploy backup portable dewatering submersible pump with layflat discharge hose.',
        'Clear suction strainers of debris and silt blockages.',
        'Notify Facility Manager and Technical SME if water enters DG or transformer yard.'
      ]
    }
  ];

  const filteredContacts = (offlineEmergencyContacts || []).filter((c: any) =>
    (c.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.role_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Emergency Response Hub
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">
                  Offline Ready
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                24x7 HQ Escalation Matrix, Emergency Contacts & ISO 9001:2015 Life-Safety SOP Protocols
              </p>
            </div>
          </div>
        </div>

        {/* Site Filter & Quick Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              className="pl-3 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white shadow-xs focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="">🏢 All Paradigm Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  📍 {s.name} {s.city ? `(${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          <a
            href="tel:+918041142666"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-600/30 transition"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Dial 24x7 HQ (+91 80 4114 2666)</span>
          </a>
        </div>
      </div>

      {/* ── Central Paradigm & National Helplines (Top Cards) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Priority Emergency Helplines & National Numbers
          </h2>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            One-touch direct calling
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {centralEmergencyNumbers.map((c, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border shadow-xs transition hover:shadow-md flex items-center justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`}
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {c.priority}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    TAT: {c.tat}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {c.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {c.role}
                </div>
              </div>

              <a
                href={`tel:${c.phone}`}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition flex-shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Switcher: Site Hierarchy Contacts vs Critical Protocols ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-5 py-3 text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'contacts'
              ? 'border-red-600 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Site Escalation Contacts ({siteDisplayName})</span>
        </button>

        <button
          onClick={() => setActiveTab('protocols')}
          className={`px-5 py-3 text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'protocols'
              ? 'border-red-600 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Critical SOP Emergency Protocols ({protocols.length})</span>
        </button>
      </div>

      {/* ── Tab 1: Site Escalation Contacts ── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contact, designation, level, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500 shadow-xs"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing contacts configured for <strong className="text-slate-800 dark:text-white">{siteDisplayName}</strong>
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
              No site-specific escalation contacts found for this query. You can always dial the <strong className="text-red-600">Paradigm 24x7 HQ Central Command</strong> above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredContacts.map((c: any) => (
                <div
                  key={c.id || c.phone}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Level {c.level || '1'}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        TAT: {c.tat_minutes || '15'}m
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {c.contact_person}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {c.role_name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Scope: {c.service_type || 'Site Operations'}
                    </div>
                  </div>

                  <a
                    href={`tel:${c.phone}`}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition flex-shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Critical SOP Emergency Protocols ── */}
      {activeTab === 'protocols' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Protocol selector list */}
          <div className="space-y-2.5">
            {protocols.map((p, idx) => {
              const IconComp = p.icon;
              const isSelected = selectedProtocol === idx;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProtocol(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition shadow-xs flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-red-50/60 dark:bg-red-950/30 border-red-500 dark:border-red-500/60 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 ${p.color}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {p.category} • {p.description}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 mt-2 flex-shrink-0 ${isSelected ? 'text-red-600 dark:text-red-400 translate-x-1' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>

          {/* Detailed Protocol Action Guide */}
          <div className="lg:col-span-2">
            {selectedProtocol !== null && (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className={`p-3 rounded-xl border ${protocols[selectedProtocol].color}`}>
                    {React.createElement(protocols[selectedProtocol].icon, { className: 'w-6 h-6' })}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {protocols[selectedProtocol].category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {protocols[selectedProtocol].title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {protocols[selectedProtocol].description}
                </p>

                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Mandatory Sequence of Actions:
                  </h4>
                  <ol className="space-y-3">
                    {protocols[selectedProtocol].steps.map((st, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed"
                      >
                        <span className="w-6 h-6 rounded-lg bg-red-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                          {i + 1}
                        </span>
                        <span className="mt-0.5">{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>ISO 9001:2015 Operations Manual Compliance</span>
                  <button
                    onClick={() => navigate('/assist')}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>Ask Paradigm Assist AI about this procedure</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyHubPage;
