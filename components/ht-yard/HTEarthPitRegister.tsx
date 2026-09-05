import React, { useState, useEffect, useMemo } from 'react';
import { HTEquipmentInstance, HTAuditResponse } from '../../types/htYard';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget.tsx';
import { ShieldCheck, Plus, Edit3, Trash2, Copy, X, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface EarthPitRowDef {
  key: string;
  label: string;
  defaultVal: string;
  options?: string[];
  isCustom?: boolean;
}

interface HTEarthPitRegisterProps {
  equipmentInstances: HTEquipmentInstance[];
  responses: Record<string, HTAuditResponse>;
  onChangeResponse: (key: string, val: Partial<HTAuditResponse>) => void;
}

const DEFAULT_OPTIONS = ['Ok / Healthy', 'Maintenance Needed', 'High Resistance', 'Not Visible'];

const LOCAL_STORAGE_CUSTOM_KEY = 'ht_earth_pit_custom_rows';
const LOCAL_STORAGE_OVERRIDES_KEY = 'ht_earth_pit_overrides';

export const HTEarthPitRegister: React.FC<HTEarthPitRegisterProps> = ({
  equipmentInstances = [],
  responses,
  onChangeResponse
}) => {
  // Custom added rows and overrides for generated rows
  const [customRows, setCustomRows] = useState<EarthPitRowDef[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [overrides, setOverrides] = useState<Record<string, { label?: string; options?: string[]; defaultVal?: string; isHidden?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_OVERRIDES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal states
  const [editingRow, setEditingRow] = useState<EarthPitRowDef | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');

  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [newRowLabel, setNewRowLabel] = useState('');
  const [newRowOptions, setNewRowOptions] = useState<string[]>([...DEFAULT_OPTIONS]);
  const [newRowOptionInput, setNewRowOptionInput] = useState('');

  // Persist custom rows and overrides
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_KEY, JSON.stringify(customRows));
    } catch (e) {
      console.error('Failed to save custom earth pit rows', e);
    }
  }, [customRows]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.error('Failed to save earth pit overrides', e);
    }
  }, [overrides]);

  // Generate baseline auto-calculated rows matching equipment instances
  const baseRows = useMemo(() => {
    const rows: EarthPitRowDef[] = [];

    equipmentInstances.forEach((inst) => {
      if (inst.moduleType === 'RMU') {
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit 1 & 2`,
          defaultVal: 'Ok / Healthy',
          options: DEFAULT_OPTIONS
        });
      } else if (inst.moduleType === 'Transformer') {
        rows.push({
          key: `earth_pit_${inst.id}_neutral`,
          label: `${inst.instanceName} Neutral Earth Pit 1 & 2`,
          defaultVal: 'Ok / Healthy',
          options: DEFAULT_OPTIONS
        });
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit 1 & 2`,
          defaultVal: 'Ok / Healthy',
          options: DEFAULT_OPTIONS
        });
      } else if (inst.moduleType === 'LT_Kiosk') {
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit`,
          defaultVal: 'Ok / Healthy',
          options: DEFAULT_OPTIONS
        });
      }
    });

    rows.push({
      key: 'earth_pit_fencing',
      label: 'Yard Fencing Earth Pit',
      defaultVal: 'Ok / Healthy',
      options: DEFAULT_OPTIONS
    });

    return rows;
  }, [equipmentInstances]);

  // Merge base rows with overrides and custom rows
  const allEarthPitRows = useMemo(() => {
    const activeBaseRows = baseRows
      .filter((r) => !overrides[r.key]?.isHidden)
      .map((r) => {
        const ov = overrides[r.key];
        return {
          ...r,
          label: ov?.label || r.label,
          options: ov?.options && ov.options.length > 0 ? ov.options : (r.options || DEFAULT_OPTIONS),
          defaultVal: ov?.defaultVal || r.defaultVal
        };
      });

    const activeCustomRows = customRows
      .filter((r) => !overrides[r.key]?.isHidden)
      .map((r) => {
        const ov = overrides[r.key];
        return {
          ...r,
          label: ov?.label || r.label,
          options: ov?.options && ov.options.length > 0 ? ov.options : (r.options || DEFAULT_OPTIONS),
          defaultVal: ov?.defaultVal || r.defaultVal,
          isCustom: true
        };
      });

    return [...activeBaseRows, ...activeCustomRows];
  }, [baseRows, customRows, overrides]);

  // Handlers for Editing
  const openEditModal = (row: EarthPitRowDef) => {
    setEditingRow(row);
    setEditLabel(row.label);
    setEditOptions(row.options && row.options.length > 0 ? [...row.options] : [...DEFAULT_OPTIONS]);
    setNewOptionInput('');
  };

  const handleSaveEdit = () => {
    if (!editingRow) return;
    const finalLabel = editLabel.trim() || editingRow.label;
    const finalOptions = editOptions.length > 0 ? editOptions : DEFAULT_OPTIONS;

    if (editingRow.isCustom) {
      setCustomRows((prev) =>
        prev.map((r) =>
          r.key === editingRow.key
            ? { ...r, label: finalLabel, options: finalOptions }
            : r
        )
      );
    } else {
      setOverrides((prev) => ({
        ...prev,
        [editingRow.key]: {
          ...prev[editingRow.key],
          label: finalLabel,
          options: finalOptions
        }
      }));
    }

    // Update active response label if exists
    const currResp = responses[editingRow.key];
    if (currResp) {
      onChangeResponse(editingRow.key, {
        ...currResp,
        fieldLabel: finalLabel
      });
    }

    setEditingRow(null);
  };

  // Handlers for Adding
  const openAddModal = () => {
    setNewRowLabel('');
    setNewRowOptions([...DEFAULT_OPTIONS]);
    setNewRowOptionInput('');
    setIsAddingModalOpen(true);
  };

  const handleSaveAdd = () => {
    const trimmedLabel = newRowLabel.trim();
    if (!trimmedLabel) return;

    const newKey = `earth_pit_custom_${Date.now()}`;
    const newRow: EarthPitRowDef = {
      key: newKey,
      label: trimmedLabel,
      defaultVal: 'Ok / Healthy',
      options: newRowOptions.length > 0 ? newRowOptions : DEFAULT_OPTIONS,
      isCustom: true
    };

    setCustomRows((prev) => [...prev, newRow]);

    // Initialize response
    onChangeResponse(newKey, {
      moduleType: 'Earth_Pit',
      sectionKey: 'earth_pit_log',
      itemNumber: allEarthPitRows.length + 1,
      fieldKey: newKey,
      fieldLabel: trimmedLabel,
      responseValue: 'Ok / Healthy',
      remarks: '',
      photoUrls: []
    });

    setIsAddingModalOpen(false);
  };

  // Handlers for Duplicating
  const handleDuplicateRow = (row: EarthPitRowDef) => {
    const newKey = `earth_pit_custom_${Date.now()}`;
    const newLabel = `${row.label} (Unit 2)`;
    const newRow: EarthPitRowDef = {
      key: newKey,
      label: newLabel,
      defaultVal: row.defaultVal || 'Ok / Healthy',
      options: row.options ? [...row.options] : [...DEFAULT_OPTIONS],
      isCustom: true
    };

    setCustomRows((prev) => [...prev, newRow]);

    const sourceResp = responses[row.key];
    onChangeResponse(newKey, {
      moduleType: 'Earth_Pit',
      sectionKey: 'earth_pit_log',
      itemNumber: allEarthPitRows.length + 1,
      fieldKey: newKey,
      fieldLabel: newLabel,
      responseValue: sourceResp?.responseValue || 'Ok / Healthy',
      remarks: sourceResp?.remarks || '',
      photoUrls: []
    });
  };

  // Handlers for Deleting
  const handleDeleteRow = (key: string, isCustom?: boolean) => {
    if (!confirm('Are you sure you want to remove this earth pit inspection question?')) return;

    if (isCustom) {
      setCustomRows((prev) => prev.filter((r) => r.key !== key));
    } else {
      setOverrides((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          isHidden: true
        }
      }));
    }
  };

  // Reset to default
  const handleResetToDefaults = () => {
    if (confirm('Reset all Earth Pit questions back to system defaults? Custom added questions will be cleared.')) {
      setCustomRows([]);
      setOverrides({});
      localStorage.removeItem(LOCAL_STORAGE_CUSTOM_KEY);
      localStorage.removeItem(LOCAL_STORAGE_OVERRIDES_KEY);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Earth Pit Inspection Log
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-calculated checklist generated dynamically matching site equipment units. Editable & customizable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(customRows.length > 0 || Object.keys(overrides).length > 0) && (
            <button
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Reset all Earth Pit questions to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Earth Pit Question
          </button>

          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
            {allEarthPitRows.length} Earth Pits
          </span>
        </div>
      </div>

      {/* Main Checklist Table */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="bg-slate-50/90 dark:bg-slate-800/80 px-4 py-3 text-xs font-extrabold text-slate-700 dark:text-slate-300 grid grid-cols-12 gap-3 items-center">
          <div className="col-span-5">Earth Pit Description & Actions</div>
          <div className="col-span-3">Status / Condition</div>
          <div className="col-span-4">Remarks & Evidence Photos</div>
        </div>

        {allEarthPitRows.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-medium">No earth pit questions currently active.</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Earth Pit Question
            </button>
          </div>
        ) : (
          allEarthPitRows.map((row, idx) => {
            const currentResp = responses[row.key] || {
              moduleType: 'Earth_Pit',
              sectionKey: 'earth_pit_log',
              itemNumber: idx + 1,
              fieldKey: row.key,
              fieldLabel: row.label,
              responseValue: row.defaultVal || 'Ok / Healthy',
              remarks: '',
              photoUrls: []
            };

            const options = row.options && row.options.length > 0 ? row.options : DEFAULT_OPTIONS;

            return (
              <div
                key={row.key}
                className="px-4 py-3 text-xs grid grid-cols-12 gap-3 items-center hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
              >
                {/* Description Column + Edit / Copy / Delete Buttons */}
                <div className="col-span-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-start gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold shrink-0 mt-0.5">
                        {idx + 1}.
                      </span>
                      <div>
                        <span className="break-words leading-relaxed">{row.label}</span>
                        {row.isCustom && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors"
                        title="Edit question title and options"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(row)}
                        className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                        title="Duplicate for multiple units"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.key, row.isCustom)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status / Condition Dropdown */}
                <div className="col-span-3">
                  <select
                    value={currentResp.responseValue || options[0] || 'Ok / Healthy'}
                    onChange={(e) =>
                      onChangeResponse(row.key, {
                        ...currentResp,
                        responseValue: e.target.value
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  >
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remarks & Photos */}
                <div className="col-span-4 space-y-1.5">
                  <input
                    type="text"
                    placeholder="Add pit remarks..."
                    value={currentResp.remarks || ''}
                    onChange={(e) =>
                      onChangeResponse(row.key, {
                        ...currentResp,
                        remarks: e.target.value
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                  <HTPhotoCaptureWidget
                    photos={currentResp.photoUrls || []}
                    onChange={(photos) =>
                      onChangeResponse(row.key, {
                        ...currentResp,
                        photoUrls: photos
                      })
                    }
                    maxPhotos={2}
                  />
                </div>
              </div>
            );
          })
        )}

        {/* Quick Add Footer Bar */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 border-dashed rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Another Earth Pit Question
          </button>
        </div>
      </div>

      {/* ─── EDIT MODAL ─────────────────────────────────────────────────── */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" /> Edit Earth Pit Question
              </h3>
              <button
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Earth Pit Description / Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Transformer 1 Neutral Earth Pit 1 & 2"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 dark:bg-slate-800 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status / Condition Dropdown Options
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {editOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[idx] = e.target.value;
                          setEditOptions(updated);
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setEditOptions(editOptions.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Delete option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newOptionInput.trim()) {
                          setEditOptions([...editOptions, newOptionInput.trim()]);
                          setNewOptionInput('');
                        }
                      }
                    }}
                    placeholder="Add custom option..."
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newOptionInput.trim()) {
                        setEditOptions([...editOptions, newOptionInput.trim()]);
                        setNewOptionInput('');
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
              >
                <Check className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD QUESTION MODAL ─────────────────────────────────────────── */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Add Earth Pit Question
              </h3>
              <button
                onClick={() => setIsAddingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Earth Pit Question / Description *
                </label>
                <input
                  type="text"
                  value={newRowLabel}
                  onChange={(e) => setNewRowLabel(e.target.value)}
                  placeholder="e.g. DG Set Neutral Earth Pit 1 & 2"
                  autoFocus
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 dark:bg-slate-800 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status Options
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {newRowOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newRowOptions];
                          updated[idx] = e.target.value;
                          setNewRowOptions(updated);
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setNewRowOptions(newRowOptions.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Delete option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newRowOptionInput}
                    onChange={(e) => setNewRowOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newRowOptionInput.trim()) {
                          setNewRowOptions([...newRowOptions, newRowOptionInput.trim()]);
                          setNewRowOptionInput('');
                        }
                      }
                    }}
                    placeholder="Add option..."
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newRowOptionInput.trim()) {
                        setNewRowOptions([...newRowOptions, newRowOptionInput.trim()]);
                        setNewRowOptionInput('');
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddingModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newRowLabel.trim()}
                onClick={handleSaveAdd}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
