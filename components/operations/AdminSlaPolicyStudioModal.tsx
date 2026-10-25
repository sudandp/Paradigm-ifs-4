import React, { useState, useEffect } from 'react';
import { Settings2, Clock, ShieldCheck, X, CheckCircle2, RefreshCw, AlertTriangle, HelpCircle } from 'lucide-react';
import type { HelpdeskSlaPolicy, TicketPriority } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';

interface AdminSlaPolicyStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: string;
}

const DEFAULT_POLICIES: Record<TicketPriority, { responseMins: number; resolutionMins: number; label: string; desc: string }> = {
  P1: {
    responseMins: 15,
    resolutionMins: 120, // 2h
    label: 'P1 - Critical Priority',
    desc: 'Lifts stuck, main water pipe burst, total power outage, fire alarm triggering'
  },
  P2: {
    responseMins: 30,
    resolutionMins: 360, // 6h
    label: 'P2 - High Priority',
    desc: 'Partial power failure, water leakage in corridor, main gate barrier fault'
  },
  P3: {
    responseMins: 120, // 2h
    resolutionMins: 1440, // 24h
    label: 'P3 - Medium Priority',
    desc: 'Clubhouse AC issue, garden sprinkler repair, intercom buzzer fault'
  },
  P4: {
    responseMins: 240, // 4h
    resolutionMins: 2880, // 48h
    label: 'P4 - Low Priority',
    desc: 'Common area bulb replacement, paint touch-up, notice board fixing'
  }
};

export const AdminSlaPolicyStudioModal: React.FC<AdminSlaPolicyStudioModalProps> = ({
  isOpen,
  onClose,
  entityId
}) => {
  const { slaPolicies, fetchSlaPolicies, saveSlaPolicy } = useOpsStore();

  const [policies, setPolicies] = useState<Record<TicketPriority, { responseMins: number; resolutionMins: number; id?: string }>>({
    P1: { responseMins: 15, resolutionMins: 120 },
    P2: { responseMins: 30, resolutionMins: 360 },
    P3: { responseMins: 120, resolutionMins: 1440 },
    P4: { responseMins: 240, resolutionMins: 2880 }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSlaPolicies(entityId);
      setSuccessMsg(null);
    }
  }, [isOpen, entityId]);

  useEffect(() => {
    if (slaPolicies && slaPolicies.length > 0) {
      const mapped = { ...policies };
      slaPolicies.forEach(p => {
        if (mapped[p.priority]) {
          mapped[p.priority] = {
            responseMins: p.responseTimeMinutes,
            resolutionMins: p.resolutionTimeMinutes,
            id: p.id
          };
        }
      });
      setPolicies(mapped);
    }
  }, [slaPolicies]);

  if (!isOpen) return null;

  const handleChange = (priority: TicketPriority, field: 'responseMins' | 'resolutionMins', value: number) => {
    setPolicies(prev => ({
      ...prev,
      [priority]: {
        ...prev[priority],
        [field]: Math.max(1, value)
      }
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      const priorities: TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];
      for (const priority of priorities) {
        const item = policies[priority];
        await saveSlaPolicy({
          id: item.id,
          entityId: entityId || undefined,
          priority,
          responseTimeMinutes: item.responseMins,
          resolutionTimeMinutes: item.resolutionMins
        });
      }
      setSuccessMsg('SLA Policy rules updated across all helpdesk categories');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Settings2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Policy Studio: Helpdesk SLA Matrix</h3>
              <p className="text-[11px] text-slate-300">Standard Operational Response & Escalation Thresholds</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              When tickets exceed these target limits without completion, they automatically trigger an **Actions Pending Escalation Alert** on the Estate Manager dashboard and dispatch emergency push notifications.
            </p>
          </div>

          <div className="space-y-4">
            {(['P1', 'P2', 'P3', 'P4'] as TicketPriority[]).map((p) => {
              const def = DEFAULT_POLICIES[p];
              const cur = policies[p];
              const resolutionHours = (cur.resolutionMins / 60).toFixed(1).replace('.0', '');

              return (
                <div key={p} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:shadow-xs transition space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          p === 'P1' ? 'bg-red-100 text-red-800 border-red-200' :
                          p === 'P2' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                          p === 'P3' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          'bg-blue-100 text-blue-800 border-blue-200'
                        }`}>
                          {p}
                        </span>
                        <h4 className="text-xs font-bold text-gray-900">{def.label}</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{def.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Resolution: {resolutionHours} Hours</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        First Response Target (Minutes)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        value={cur.responseMins}
                        onChange={(e) => handleChange(p, 'responseMins', parseInt(e.target.value) || 15)}
                        className="w-full px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800"
                      />
                      <span className="text-[10px] text-gray-400">Benchmark: {def.responseMins} min</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Resolution Target (Minutes)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="10080"
                        value={cur.resolutionMins}
                        onChange={(e) => handleChange(p, 'resolutionMins', parseInt(e.target.value) || 120)}
                        className="w-full px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800"
                      />
                      <span className="text-[10px] text-gray-400">Benchmark: {def.resolutionMins} min ({(def.resolutionMins / 60)}h)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-xs"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            Save SLA Configurations
          </button>
        </div>
      </div>
    </div>
  );
};
