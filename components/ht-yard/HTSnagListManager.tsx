import React from 'react';
import { Plus, Trash2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { HTSnagItem, SnagStatus } from '../../types/htYard';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget.tsx';

interface HTSnagListManagerProps {
  snagItems: HTSnagItem[];
  onChange: (items: HTSnagItem[]) => void;
  equipmentInstanceName?: string;
}

export const HTSnagListManager: React.FC<HTSnagListManagerProps> = ({
  snagItems = [],
  onChange,
  equipmentInstanceName
}) => {
  const addSnagItem = () => {
    const newItem: HTSnagItem = {
      id: `snag-${Date.now()}`,
      auditId: '',
      itemNumber: snagItems.length + 1,
      snagPoint: '',
      actionSuggested: '',
      status: 'Open',
      targetDate: new Date().toISOString().split('T')[0]
    };
    onChange([...snagItems, newItem]);
  };

  const updateItem = (index: number, key: keyof HTSnagItem, value: any) => {
    const updated = [...snagItems];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = snagItems.filter((_, i) => i !== index);
    const renumbered = updated.map((item, i) => ({ ...item, itemNumber: i + 1 }));
    onChange(renumbered);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end pb-4 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={addSnagItem}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" /> Add Snag Point
        </button>
      </div>

      {snagItems.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
          No snag points recorded for this unit yet. Click <strong className="text-slate-700 dark:text-slate-300">+ Add Snag Point</strong> to log a defect.
        </div>
      ) : (
        <div className="space-y-4">
          {snagItems.map((snag, idx) => (
            <div
              key={snag.id || idx}
              className="p-5 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-800/30 space-y-3.5"
            >
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Snag Defect #{snag.itemNumber || idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={snag.status}
                    onChange={(e) => updateItem(idx, 'status', e.target.value as SnagStatus)}
                    className={`text-xs font-bold px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 focus:outline-none ${
                      snag.status === 'Closed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : snag.status === 'In_Progress'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    <option value="Open">Open</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Snag Point / Defect Description *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oil leakage near PRV valve or foundation crack"
                    value={snag.snagPoint}
                    onChange={(e) => updateItem(idx, 'snagPoint', e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Suggested *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Replace Gasket during upcoming service"
                    value={snag.actionSuggested}
                    onChange={(e) => updateItem(idx, 'actionSuggested', e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={snag.targetDate || ''}
                    onChange={(e) => updateItem(idx, 'targetDate', e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Defect Evidence Photo
                  </label>
                  <HTPhotoCaptureWidget
                    photos={snag.photoUrl ? [snag.photoUrl] : []}
                    onChange={(urls) => updateItem(idx, 'photoUrl', urls[0] || '')}
                    maxPhotos={1}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
