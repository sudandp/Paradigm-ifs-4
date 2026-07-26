import React from 'react';
import { HTAuditResponse } from '../../types/htYard';
import { Cpu } from 'lucide-react';

interface HTFeederRepeaterProps {
  moduleType: string;
  feederCount: number;
  equipmentInstanceId: string;
  responses: Record<string, HTAuditResponse>;
  onChangeResponse: (key: string, val: Partial<HTAuditResponse>) => void;
}

export const HTFeederRepeater: React.FC<HTFeederRepeaterProps> = ({
  moduleType,
  feederCount = 4,
  equipmentInstanceId,
  responses,
  onChangeResponse
}) => {
  const renderFeederBlock = (feederIdx: number) => {
    const feederName = `Outgoing Feeder / Section ${feederIdx}`;
    const prefixKey = `feeder_${equipmentInstanceId}_${feederIdx}`;

    const fields = [
      { key: `${prefixKey}_cable_rating`, label: 'Cable Rating', type: 'text' },
      { key: `${prefixKey}_destination`, label: 'To / Destination', type: 'text' },
      { key: `${prefixKey}_power_indicator`, label: 'Power Line Indicator', type: 'text' },
      { key: `${prefixKey}_fault_indicator`, label: 'Line Fault Indicator', type: 'text' },
      { key: `${prefixKey}_protection_relay`, label: 'Protection Relay Status', type: 'text' },
      { key: `${prefixKey}_sf6_status`, label: 'SF-6 Gas Status', type: 'text' }
    ];

    return (
      <div key={feederIdx} className="p-5 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <h4 className="font-extrabold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-emerald-600" /> {feederName}
          </h4>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Way {feederIdx}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {fields.map((f) => {
            const current = responses[f.key] || {
              moduleType,
              sectionKey: `feeder_${feederIdx}`,
              itemNumber: feederIdx,
              fieldKey: f.key,
              fieldLabel: f.label,
              responseValue: '',
              remarks: '',
              photoUrls: []
            };

            return (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {f.label}
                </label>
                <input
                  type="text"
                  placeholder="Enter details..."
                  value={current.responseValue || ''}
                  onChange={(e) =>
                    onChangeResponse(f.key, {
                      ...current,
                      responseValue: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {Array.from({ length: feederCount }).map((_, idx) => renderFeederBlock(idx + 1))}
      </div>
    </div>
  );
};
