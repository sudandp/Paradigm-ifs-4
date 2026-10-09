import React, { useState } from 'react';
import { Phone, ShieldAlert, AlertTriangle, Flame, Zap, Crosshair, Users, X, ExternalLink } from 'lucide-react';
import { useAssistStore } from '../../store/assistStore';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteName?: string;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  siteName = 'All Sites'
}) => {
  const { offlineEmergencyContacts } = useAssistStore();
  const [activeTab, setActiveTab] = useState<'contacts' | 'protocols'>('contacts');

  if (!isOpen) return null;

  const defaultCentralContacts = [
    { title: 'Paradigm 24x7 Central Helpdesk', phone: '+91 80 4114 2666', role: 'HQ Central Desk', tat: 'Instant' },
    { title: 'Operations Director on Duty', phone: '+91 98450 12345', role: 'Director Escalation', tat: '15 mins' },
    { title: 'Central Technical SME / MEP Lead', phone: '+91 98450 67890', role: 'Technical Audit', tat: '45-60 mins' },
    { title: 'National Fire Emergency', phone: '101', role: 'Fire & Rescue', tat: 'Instant' },
    { title: 'National Medical Ambulance', phone: '108', role: 'Ambulance', tat: 'Instant' },
    { title: 'National Police Control Room', phone: '100', role: 'Police', tat: 'Instant' }
  ];

  const protocols = [
    {
      title: 'Fire / Smoke Outbreak',
      icon: Flame,
      color: 'text-red-500 bg-red-500/10 border-red-500/30',
      steps: [
        'Sound the manual call point / fire alarm immediately.',
        'Evacuate people via fire stairs (NEVER use elevators).',
        'Deploy CO2 / ABC Dry Powder extinguisher if safe.',
        'Cut main electrical circuit breaker and piped LPG valve.',
        'Dial 101 and notify Facility Manager + Director on Duty.'
      ]
    },
    {
      title: 'Lift / Elevator Passenger Entrapment',
      icon: Users,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      steps: [
        'Communicate via intercom: assure passengers air is flowing.',
        'Check car position in machine room / floor indicators.',
        'Switch OFF main lift 3-phase isolator.',
        'Release manual brake slowly to level car to closest floor.',
        'Use triangular landing key to open door and extract passengers.'
      ]
    },
    {
      title: 'Electrical Shock / Arc Flash',
      icon: Zap,
      color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
      steps: [
        'DO NOT touch victim directly with bare hands.',
        'Trip the main incomer circuit breaker (ACB/MCCB) immediately.',
        'Separate victim using dry wooden or PVC non-conductive object.',
        'Check breathing and initiate CPR if pulse is absent.',
        'Dial 108 Ambulance and summon site first responder.'
      ]
    },
    {
      title: 'Critical LPG / Gas Leak',
      icon: AlertTriangle,
      color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
      steps: [
        'DO NOT operate electrical switches, phones, or open flames.',
        'Open all external windows and doors for ventilation.',
        'Shut off main manifold gas bank cylinders immediately.',
        'Evacuate all personnel 100 meters away upwind.',
        'Call Gas Vendor Hotline and Site MEP Supervisor.'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-red-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-red-950/20 dark:shadow-red-950/50 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-red-50 via-white to-red-50/50 dark:from-red-950/80 dark:to-slate-900 border-b border-red-200 dark:border-red-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 dark:bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Emergency Response Hub
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">
                  Offline Ready
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Site: {siteName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-3 text-sm font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'contacts'
                ? 'text-red-600 dark:text-red-400 border-b-2 border-red-500 bg-red-50/50 dark:bg-red-500/5'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            Emergency Contacts & Escalation
          </button>
          <button
            onClick={() => setActiveTab('protocols')}
            className={`flex-1 py-3 text-sm font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'protocols'
                ? 'text-red-600 dark:text-red-400 border-b-2 border-red-500 bg-red-50/50 dark:bg-red-500/5'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Critical SOP Protocols
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'contacts' ? (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Click any phone number to dial directly. For critical life safety, immediately notify the HQ Helpdesk and Director.
              </div>

              {/* Site Escalation Contacts from Database */}
              {offlineEmergencyContacts && offlineEmergencyContacts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Site Escalation Hierarchy ({siteName})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {offlineEmergencyContacts.map((c: any) => (
                      <div
                        key={c.id || c.phone}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {c.contact_person}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {c.role_name} ({c.level})
                          </div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            TAT: {c.tat_minutes} mins • {c.service_type || 'All'}
                          </div>
                        </div>
                        <a
                          href={`tel:${c.phone}`}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 flex-shrink-0 transition shadow-md shadow-red-900/20"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Central Paradigm & National Helplines */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Paradigm HQ 24x7 & National Emergency Numbers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {defaultCentralContacts.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.role}</div>
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Response: {c.tat}</div>
                      </div>
                      <a
                        href={`tel:${c.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 flex-shrink-0 transition shadow-md shadow-red-900/20"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {protocols.map((p, idx) => {
                const IconComponent = p.icon;
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${p.color}`}>
                    <div className="flex items-center gap-2.5 font-bold text-sm mb-2 text-slate-900 dark:text-white">
                      <IconComponent className="w-5 h-5 flex-shrink-0" />
                      <span>{p.title}</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-200">
                      {p.steps.map((st, sidx) => (
                        <li key={sidx} className="leading-relaxed">{st}</li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Paradigm Integrated Facility Services • ISO 9001:2015</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyModal;
