import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  Plus, 
  X, 
  RotateCw, 
  Flame, 
  ShieldAlert, 
  Check, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

export interface SmartReminder {
  id: string;
  title: string;
  category: 'amc_contract' | 'compliance' | 'inventory' | 'operational' | 'personal';
  siteName: string;
  dueTime: string;
  isUrgent: boolean;
  isCompleted: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  snoozedUntil?: string;
}

const DEFAULT_REMINDERS: SmartReminder[] = [
  {
    id: 'REM-01',
    title: 'Submit Monthly PF & ESI Statutory Challans to Portal',
    category: 'compliance',
    siteName: 'Corporate HO',
    dueTime: 'Tomorrow 05:00 PM',
    isUrgent: true,
    isCompleted: false,
    recurrence: 'monthly'
  },
  {
    id: 'REM-02',
    title: 'Otis Elevator AMC Renewal - Finalize Contract Signatures',
    category: 'amc_contract',
    siteName: 'iTowers Exente',
    dueTime: 'In 3 days',
    isUrgent: true,
    isCompleted: false,
    recurrence: 'none'
  },
  {
    id: 'REM-03',
    title: 'Order STP Sodium Hypochlorite & PAC Dosing Chemicals',
    category: 'inventory',
    siteName: 'Southwall Residency',
    dueTime: 'Today 04:00 PM',
    isUrgent: false,
    isCompleted: false,
    recurrence: 'weekly'
  },
  {
    id: 'REM-04',
    title: 'Verify DG Fuel Tank Dip Gauge & Meter Reading Before Evening Shift',
    category: 'operational',
    siteName: 'Sobha Silicon Oasis',
    dueTime: 'Today 06:30 PM',
    isUrgent: false,
    isCompleted: false,
    recurrence: 'daily'
  },
  {
    id: 'REM-05',
    title: 'Conduct Monthly Fire Hydrant Static Pressure Flow Test',
    category: 'operational',
    siteName: 'Brigade Gateway',
    dueTime: 'In 5 days',
    isUrgent: false,
    isCompleted: true,
    recurrence: 'monthly'
  }
];

export const SmartRemindersHub: React.FC<{
  departmentFilter?: string;
}> = () => {
  const [reminders, setReminders] = useState<SmartReminder[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_facility_reminders');
      return saved ? JSON.parse(saved) : DEFAULT_REMINDERS;
    } catch {
      return DEFAULT_REMINDERS;
    }
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'all'>('pending');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const saveReminders = (newReminders: SmartReminder[]) => {
    setReminders(newReminders);
    try {
      localStorage.setItem('paradigm_facility_reminders', JSON.stringify(newReminders));
    } catch (e) {
      console.warn('Failed to save reminders to localStorage', e);
    }
  };

  const handleToggle = (id: string) => {
    const updated = reminders.map(r => {
      if (r.id !== id) return r;
      return { ...r, isCompleted: !r.isCompleted };
    });
    saveReminders(updated);
  };

  const handleSnooze = (id: string) => {
    const updated = reminders.map(r => {
      if (r.id !== id) return r;
      return { 
        ...r, 
        dueTime: 'Tomorrow 09:00 AM', 
        snoozedUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString() 
      };
    });
    saveReminders(updated);
  };

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<SmartReminder['category']>('operational');
  const [newSite, setNewSite] = useState('All Sites');
  const [newDue, setNewDue] = useState('Tomorrow 10:00 AM');
  const [newUrgent, setNewUrgent] = useState(false);
  const [newRecurrence, setNewRecurrence] = useState<SmartReminder['recurrence']>('none');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: SmartReminder = {
      id: `REM-${Date.now().toString().slice(-4)}`,
      title: newTitle,
      category: newCategory,
      siteName: newSite,
      dueTime: newDue,
      isUrgent: newUrgent,
      isCompleted: false,
      recurrence: newRecurrence
    };

    saveReminders([created, ...reminders]);
    setIsAddOpen(false);
    setNewTitle('');
  };

  const filtered = useMemo(() => {
    return reminders.filter(r => {
      if (activeTab === 'pending') return !r.isCompleted;
      if (activeTab === 'completed') return r.isCompleted;
      return true;
    });
  }, [reminders, activeTab]);

  const pendingCount = reminders.filter(r => !r.isCompleted).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Smart Facility Reminders Hub
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006B3F]">
                {pendingCount} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated renewal alerts, chemical ordering milestones, and compliance alarms.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006B3F] hover:bg-[#005230] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="p-3 sm:px-5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          {(['pending', 'completed', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#006B3F] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Reminders List */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-600" />
            <p className="text-sm font-medium text-slate-600">No reminders in this queue.</p>
          </div>
        ) : (
          filtered.map(rem => (
            <div 
              key={rem.id}
              className={`p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex items-start gap-3 ${
                rem.isCompleted ? 'opacity-50 bg-slate-50/30' : ''
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(rem.id)}
                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                  rem.isCompleted 
                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                    : 'border-slate-300 hover:border-emerald-600 bg-white'
                }`}
              >
                {rem.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {rem.isUrgent && !rem.isCompleted && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-600" /> Urgent
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {rem.siteName}
                  </span>
                  {rem.recurrence && rem.recurrence !== 'none' && (
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5 capitalize">
                      <RotateCw className="w-2.5 h-2.5" /> {rem.recurrence}
                    </span>
                  )}
                </div>

                <h4 className={`text-sm font-semibold text-slate-900 leading-snug ${rem.isCompleted ? 'line-through text-slate-400' : ''}`}>
                  {rem.title}
                </h4>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-mono text-slate-600 font-medium text-[11px]">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Due: {rem.dueTime}
                  </span>

                  {!rem.isCompleted && (
                    <button
                      onClick={() => handleSnooze(rem.id)}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline"
                    >
                      Snooze 1d
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Reminder Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Create Facility Reminder
              </h3>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect DG diesel reserve before 6 PM peak"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="operational">Operational</option>
                    <option value="amc_contract">AMC & Vendor</option>
                    <option value="compliance">Statutory Compliance</option>
                    <option value="inventory">Chemicals & Inventory</option>
                    <option value="personal">Personal / Team</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Site</label>
                  <input
                    type="text"
                    value={newSite}
                    onChange={e => setNewSite(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Timing</label>
                  <input
                    type="text"
                    value={newDue}
                    placeholder="e.g. Tomorrow 10:00 AM"
                    onChange={e => setNewDue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recurrence</label>
                  <select
                    value={newRecurrence}
                    onChange={e => setNewRecurrence(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="none">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="urgent-check"
                  checked={newUrgent}
                  onChange={e => setNewUrgent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#006B3F] focus:ring-[#006B3F] border-slate-300"
                />
                <label htmlFor="urgent-check" className="font-semibold text-slate-700 cursor-pointer">
                  Mark as High Priority / Urgent Alert
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#006B3F] text-white font-semibold shadow-xs hover:bg-[#005230]"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
