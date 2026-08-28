import React, { useState, useEffect } from 'react';
import { HTAuditResponse } from '../../types/htYard';
import { 
  Cpu, Copy, Plus, Trash2, Pencil, Check, X, 
  Layers, Zap, Sparkles, ChevronDown, ChevronUp, Image, 
  CheckCircle2, AlertTriangle, ShieldCheck, Table, LayoutGrid
} from 'lucide-react';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget';
import toast from 'react-hot-toast';

interface HTFeederRepeaterProps {
  moduleType: string;
  feederCount: number;
  equipmentInstanceId: string;
  responses: Record<string, HTAuditResponse>;
  onChangeResponse: (key: string, val: Partial<HTAuditResponse>) => void;
  onUpdateFeederCount?: (newCount: number) => void;
  onLogAction?: (entry: { actionType: 'CREATE' | 'EDIT' | 'DELETE' | 'DUPLICATE' | 'SAVE'; target: string; details: string }) => void;
}

const MCCB_MAKE_OPTIONS = [
  'Schneider',
  'ABB',
  'L & T',
  'Siemens',
  'Legrand',
  'C & S',
  'HPL',
  'Socomec',
  'Mitsubishi Electric',
  'Indo Asia',
  'Havell\'s',
  'Other — Specify in Remarks'
];

const CAPACITY_OPTIONS = [
  '1600 A',
  '1250 A',
  '1000 A',
  '800 A',
  '630 A',
  '500 A',
  '400 A',
  '320 A',
  '250 A',
  '200 A',
  '160 A',
  '125 A',
  '100 A',
  '63 A',
  '32 A',
  'Details not available'
];

const CABLE_RATING_OPTIONS = [
  '3C x 300 sq.mm XLPE Al',
  '3C x 240 sq.mm XLPE Al',
  '3C x 185 sq.mm XLPE Al',
  '3C x 95 sq.mm XLPE Al',
  '3.5C x 400 sq.mm XLPE Al',
  '3.5C x 300 sq.mm XLPE Al',
  '3.5C x 240 sq.mm XLPE Al',
  '3.5C x 185 sq.mm XLPE Al',
  '4C x 70 sq.mm Cu',
  '4C x 50 sq.mm Cu',
  '4C x 35 sq.mm Cu',
  '4C x 16 sq.mm Cu',
  'Other — Specify in Remarks'
];

const DESTINATION_SUGGESTIONS = [
  'To Transformer 1',
  'To Transformer 2',
  'To Main LT Panel 1',
  'To Main LT Panel 2',
  'To Capacitor Bank APFC Panel',
  'To DG Synchronizing Bus',
  'To Fire Fighting Pump Panel',
  'To Main Water Pump House',
  'To Admin Block Distribution Panel',
  'To Production Plant Floor 1',
  'To Production Plant Floor 2',
  'To HVAC Chiller Plant',
  'To Street Lighting Feeder',
  'Spare Outgoing Way'
];

const POWER_INDICATOR_OPTIONS = [
  'Working / Glows Normal',
  'Dim / Flickering',
  'Not Glowing / Blown',
  'Lamp Missing / Broken',
  'N/A'
];

const FAULT_INDICATOR_OPTIONS = [
  'Normal / Reset',
  'Tripped / Flag Indicated',
  'Defective / Sensor Fault',
  'N/A'
];

const RELAY_STATUS_OPTIONS = [
  'Healthy / Normal (LED Solid)',
  'Tripped / Alarm Active',
  'Flag Up / Needs Manual Reset',
  'DC Supply Fail / Auxiliary Down',
  'Faulty / Display Inactive',
  'Not Provided',
  'N/A'
];

const SF6_STATUS_OPTIONS = [
  'Safe Zone (Green)',
  'Low Pressure (Amber)',
  'Danger / Refill Required (Red)',
  'Vacuum Interrupter (Non-SF6)',
  'N/A'
];

export const HTFeederRepeater: React.FC<HTFeederRepeaterProps> = ({
  moduleType,
  feederCount = 4,
  equipmentInstanceId,
  responses,
  onChangeResponse,
  onUpdateFeederCount,
  onLogAction
}) => {
  const [currentCount, setCurrentCount] = useState<number>(feederCount || 4);
  const [viewMode, setViewMode] = useState<'structured' | 'cards'>('structured');
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);
  const [editingTitleVal, setEditingTitleVal] = useState<string>('');
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (feederCount && feederCount !== currentCount) {
      setCurrentCount(feederCount);
    }
  }, [feederCount]);

  const updateCount = (newCount: number) => {
    const validCount = Math.max(1, newCount);
    setCurrentCount(validCount);
    if (onUpdateFeederCount) {
      onUpdateFeederCount(validCount);
    }
  };

  const toggleDetails = (idx: number) => {
    setExpandedDetails(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // 1-Click duplicate sample Outgoing Feeder (O/G) to next Way
  const handleDuplicateFeeder = (sourceIdx: number) => {
    const newIdx = currentCount + 1;
    const sourcePrefix = `feeder_${equipmentInstanceId}_${sourceIdx}`;
    const targetPrefix = `feeder_${equipmentInstanceId}_${newIdx}`;

    const keysToCopy = [
      'mccb_make',
      'capacity',
      'cable_rating',
      'destination',
      'power_indicator',
      'fault_indicator',
      'protection_relay',
      'sf6_status',
      'remarks'
    ];

    keysToCopy.forEach((suffix) => {
      const srcKey = `${sourcePrefix}_${suffix}`;
      const tgtKey = `${targetPrefix}_${suffix}`;
      const srcVal = responses[srcKey];

      if (srcVal) {
        onChangeResponse(tgtKey, {
          ...srcVal,
          sectionKey: `feeder_${newIdx}`,
          itemNumber: newIdx,
          fieldKey: tgtKey,
          fieldLabel: srcVal.fieldLabel
        });
      }
    });

    // Also copy custom title if set
    const srcTitleKey = `${sourcePrefix}_custom_title`;
    const tgtTitleKey = `${targetPrefix}_custom_title`;
    if (responses[srcTitleKey]?.responseValue) {
      onChangeResponse(tgtTitleKey, {
        moduleType,
        sectionKey: `feeder_${newIdx}`,
        itemNumber: newIdx,
        fieldKey: tgtTitleKey,
        fieldLabel: 'Custom Feeder Title',
        responseValue: `${responses[srcTitleKey].responseValue} (Copy)`
      });
    }

    updateCount(newIdx);

    if (onLogAction) {
      onLogAction({
        actionType: 'DUPLICATE',
        target: `Outgoing ${sourceIdx}`,
        details: `Duplicated Outgoing ${sourceIdx} parameters to Way ${newIdx}`
      });
    }

    toast.success(`Duplicated Outgoing ${sourceIdx} to Outgoing ${newIdx}!`);
  };

  // Add a brand new empty Outgoing Feeder
  const handleAddFeeder = () => {
    const newIdx = currentCount + 1;
    updateCount(newIdx);

    if (onLogAction) {
      onLogAction({
        actionType: 'CREATE',
        target: `Outgoing ${newIdx}`,
        details: `Added Outgoing Way ${newIdx}`
      });
    }

    toast.success(`Added Outgoing Way ${newIdx}`);
  };

  // Remove specific Outgoing Feeder
  const handleRemoveFeeder = (targetIdx: number) => {
    if (currentCount <= 1) {
      toast.error('At least one Outgoing Feeder must remain.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove Outgoing ${targetIdx}?`)) {
      return;
    }

    const newCount = currentCount - 1;
    updateCount(newCount);

    if (onLogAction) {
      onLogAction({
        actionType: 'DELETE',
        target: `Outgoing ${targetIdx}`,
        details: `Removed Outgoing Way ${targetIdx}`
      });
    }

    toast.success(`Removed Outgoing Way ${targetIdx}`);
  };

  // Helper to fetch/initialize a response object for a sub-field
  const getSubFieldData = (feederIdx: number, fieldSuffix: string, label: string) => {
    const prefixKey = `feeder_${equipmentInstanceId}_${feederIdx}`;
    const key = `${prefixKey}_${fieldSuffix}`;
    return {
      key,
      res: responses[key] || {
        moduleType,
        sectionKey: `feeder_${feederIdx}`,
        itemNumber: feederIdx,
        fieldKey: key,
        fieldLabel: label,
        responseValue: '',
        remarks: '',
        photoUrls: []
      }
    };
  };

  // 1. Structured 3-Tier Row (Red Heading | Yellow Sub-Menu | Green Sub-Questions)
  const renderStructuredRow = (feederIdx: number) => {
    const prefixKey = `feeder_${equipmentInstanceId}_${feederIdx}`;
    const customTitleKey = `${prefixKey}_custom_title`;
    const customTitle = responses[customTitleKey]?.responseValue;
    const displayName = customTitle || `Outgoing ${feederIdx}`;
    const isExpanded = expandedDetails[feederIdx] || false;

    const mccbData = getSubFieldData(feederIdx, 'mccb_make', 'MCCB Make');
    const capacityData = getSubFieldData(feederIdx, 'capacity', 'Capacity');
    const cableData = getSubFieldData(feederIdx, 'cable_rating', 'Cable ratings');
    const toData = getSubFieldData(feederIdx, 'destination', 'To');
    const powerData = getSubFieldData(feederIdx, 'power_indicator', 'Power Line Indicator');
    const faultData = getSubFieldData(feederIdx, 'fault_indicator', 'Line Fault Indicator');
    const relayData = getSubFieldData(feederIdx, 'protection_relay', 'Protection Relay Status');
    const sf6Data = getSubFieldData(feederIdx, 'sf6_status', 'SF-6 Gas Status');
    const remarksData = getSubFieldData(feederIdx, 'remarks', 'Remarks');

    return (
      <div 
        key={feederIdx} 
        className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden hover:shadow-md transition-all"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* 🔴 RED BOX: Outgoing Heading & Way Identifier */}
          <div className="md:col-span-3 p-5 bg-gradient-to-br from-rose-50/50 via-white to-slate-50 dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300/40">
                  Way {feederIdx}
                </span>
                <span className="text-[10px] font-bold text-slate-400">O/G Unit</span>
              </div>

              {editingTitleIdx === feederIdx ? (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={editingTitleVal}
                    onChange={(e) => setEditingTitleVal(e.target.value)}
                    placeholder="e.g. Outgoing 1 (Transformer 2)..."
                    className="w-full px-2.5 py-1 text-xs font-bold border border-rose-400 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/30"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onChangeResponse(customTitleKey, {
                          moduleType,
                          sectionKey: `feeder_${feederIdx}`,
                          itemNumber: feederIdx,
                          fieldKey: customTitleKey,
                          fieldLabel: 'Custom Feeder Title',
                          responseValue: editingTitleVal.trim()
                        });
                        setEditingTitleIdx(null);
                      } else if (e.key === 'Escape') {
                        setEditingTitleIdx(null);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeResponse(customTitleKey, {
                          moduleType,
                          sectionKey: `feeder_${feederIdx}`,
                          itemNumber: feederIdx,
                          fieldKey: customTitleKey,
                          fieldLabel: 'Custom Feeder Title',
                          responseValue: editingTitleVal.trim()
                        });
                        setEditingTitleIdx(null);
                      }}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTitleIdx(null)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight border-b-2 border-rose-500/40 pb-0.5">
                    {displayName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTitleIdx(feederIdx);
                      setEditingTitleVal(customTitle || `Outgoing ${feederIdx}`);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                    title="Rename Heading"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400 leading-tight">
                Standard feeder parameters & observation measurements.
              </p>
            </div>

            {/* Actions for this Outgoing unit */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => handleDuplicateFeeder(feederIdx)}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Duplicate / Clone Outgoing specifications to next Way"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Duplicate Outgoing</span>
              </button>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleDetails(feederIdx)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Fewer Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> More Details (Relays/Gas)
                    </>
                  )}
                </button>

                {currentCount > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFeeder(feederIdx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                    title={`Delete Outgoing ${feederIdx}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 🟡 YELLOW BOX: Sub Menu Items & 🟢 GREEN BOX: Sub Question Inputs */}
          <div className="md:col-span-9 p-5 space-y-4">
            <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
              
              {/* 1. MCCB Make */}
              <div className="py-2.5 first:pt-0 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    MCCB Make
                  </label>
                </div>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <input
                      type="text"
                      list={`mccb-list-${feederIdx}`}
                      placeholder="Select or enter MCCB Make (e.g. Schneider, ABB)..."
                      value={mccbData.res.responseValue || ''}
                      onChange={(e) =>
                        onChangeResponse(mccbData.key, {
                          ...mccbData.res,
                          responseValue: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <datalist id={`mccb-list-${feederIdx}`}>
                      {MCCB_MAKE_OPTIONS.map((opt, i) => (
                        <option key={i} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* 2. Capacity */}
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Capacity
                  </label>
                </div>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <input
                      type="text"
                      list={`capacity-list-${feederIdx}`}
                      placeholder="Select or enter capacity (e.g. 630 A, 400 A)..."
                      value={capacityData.res.responseValue || ''}
                      onChange={(e) =>
                        onChangeResponse(capacityData.key, {
                          ...capacityData.res,
                          responseValue: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <datalist id={`capacity-list-${feederIdx}`}>
                      {CAPACITY_OPTIONS.map((opt, i) => (
                        <option key={i} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* 3. Cable ratings */}
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Cable ratings
                  </label>
                </div>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <input
                      type="text"
                      list={`cable-list-${feederIdx}`}
                      placeholder="Select or enter cable size (e.g. 3.5C x 300 sq.mm XLPE Al)..."
                      value={cableData.res.responseValue || ''}
                      onChange={(e) =>
                        onChangeResponse(cableData.key, {
                          ...cableData.res,
                          responseValue: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <datalist id={`cable-list-${feederIdx}`}>
                      {CABLE_RATING_OPTIONS.map((opt, i) => (
                        <option key={i} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* 4. To (Destination) */}
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-amber-50/30 dark:bg-amber-950/10 rounded-xl px-2 -mx-2">
                <div className="sm:col-span-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <label className="text-xs font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                    To (Destination)
                  </label>
                </div>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <input
                      type="text"
                      list={`to-list-${feederIdx}`}
                      placeholder="Enter destination (e.g. To Main LT Panel, To TR-1)..."
                      value={toData.res.responseValue || ''}
                      onChange={(e) =>
                        onChangeResponse(toData.key, {
                          ...toData.res,
                          responseValue: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 border border-amber-300 dark:border-amber-700/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 transition-all"
                    />
                    <datalist id={`to-list-${feederIdx}`}>
                      {DESTINATION_SUGGESTIONS.map((opt, i) => (
                        <option key={i} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Extended Feeder Indicators & Relays (Expandable) */}
              {isExpanded && (
                <>
                  {/* Power Line Indicator */}
                  <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Power Line Indicator
                      </label>
                    </div>
                    <div className="sm:col-span-8">
                      <select
                        value={powerData.res.responseValue || ''}
                        onChange={(e) =>
                          onChangeResponse(powerData.key, {
                            ...powerData.res,
                            responseValue: e.target.value
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      >
                        <option value="">Select indicator status...</option>
                        {POWER_INDICATOR_OPTIONS.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Line Fault Indicator */}
                  <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Line Fault Indicator
                      </label>
                    </div>
                    <div className="sm:col-span-8">
                      <select
                        value={faultData.res.responseValue || ''}
                        onChange={(e) =>
                          onChangeResponse(faultData.key, {
                            ...faultData.res,
                            responseValue: e.target.value
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      >
                        <option value="">Select fault indicator...</option>
                        {FAULT_INDICATOR_OPTIONS.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Protection Relay Status */}
                  <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Protection Relay Status
                      </label>
                    </div>
                    <div className="sm:col-span-8">
                      <select
                        value={relayData.res.responseValue || ''}
                        onChange={(e) =>
                          onChangeResponse(relayData.key, {
                            ...relayData.res,
                            responseValue: e.target.value
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      >
                        <option value="">Select relay status...</option>
                        {RELAY_STATUS_OPTIONS.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* SF-6 Gas Status */}
                  <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        SF-6 Gas Status
                      </label>
                    </div>
                    <div className="sm:col-span-8">
                      <select
                        value={sf6Data.res.responseValue || ''}
                        onChange={(e) =>
                          onChangeResponse(sf6Data.key, {
                            ...sf6Data.res,
                            responseValue: e.target.value
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      >
                        <option value="">Select SF-6 status...</option>
                        {SF6_STATUS_OPTIONS.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Remarks & Photo Capture for this Outgoing */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  placeholder={`Specific remarks for ${displayName}...`}
                  value={remarksData.res.remarks || remarksData.res.responseValue || ''}
                  onChange={(e) =>
                    onChangeResponse(remarksData.key, {
                      ...remarksData.res,
                      remarks: e.target.value,
                      responseValue: e.target.value
                    })
                  }
                  className="w-full px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="shrink-0">
                <HTPhotoCaptureWidget
                  photos={remarksData.res.photoUrls || []}
                  onChange={(photos) =>
                    onChangeResponse(remarksData.key, {
                      ...remarksData.res,
                      photoUrls: photos
                    })
                  }
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-Way Duplicator Tool */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-lg border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold tracking-wide uppercase text-emerald-300">
                Outgoing Feeders & Section Blocks
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                {currentCount} {currentCount === 1 ? 'Outgoing Configured' : 'Outgoings Configured'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Structured 3-tier layout: <strong>Outgoing Heading</strong> → <strong>Sub-Menu (MCCB, Capacity, Cable, To)</strong> → <strong>Values / Observations</strong>. Duplicate easily across all ways.
            </p>
          </div>
        </div>

        {/* Quick O/G Count Presets & Add Button */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-[11px] font-bold text-slate-300">Quick Ways:</span>
          {[1, 2, 3, 4, 6, 8, 12].map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => {
                updateCount(cnt);
                toast.success(`Configured ${cnt} Outgoing Feeders`);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                currentCount === cnt
                  ? 'bg-emerald-500 text-slate-950 shadow-sm ring-2 ring-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {cnt} O/G
            </button>
          ))}

          <button
            type="button"
            onClick={handleAddFeeder}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ml-1"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Outgoing</span>
          </button>
        </div>
      </div>

      {/* Rendered Outgoing Structured Rows */}
      <div className="space-y-4">
        {Array.from({ length: currentCount }).map((_, idx) => renderStructuredRow(idx + 1))}
      </div>

      {/* Bottom Add Feeder Card */}
      <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold shrink-0 border border-emerald-200/50">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              Need another outgoing circuit or feeder section?
            </h4>
            <p className="text-[11px] text-slate-400">
              Add individual outgoing ways or click "Duplicate Outgoing" on any sample above to copy MCCB Make, Capacity, and Cable specs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddFeeder}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Outgoing {currentCount + 1}</span>
        </button>
      </div>
    </div>
  );
};
