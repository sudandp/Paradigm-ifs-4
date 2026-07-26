import React, { useMemo } from 'react';
import { HTEquipmentInstance, HTAuditResponse } from '../../types/htYard';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget.tsx';
import { ShieldCheck, Activity } from 'lucide-react';

interface HTEarthPitRegisterProps {
  equipmentInstances: HTEquipmentInstance[];
  responses: Record<string, HTAuditResponse>;
  onChangeResponse: (key: string, val: Partial<HTAuditResponse>) => void;
}

export const HTEarthPitRegister: React.FC<HTEarthPitRegisterProps> = ({
  equipmentInstances = [],
  responses,
  onChangeResponse
}) => {
  const earthPitRows = useMemo(() => {
    const rows: { key: string; label: string; defaultVal: string }[] = [];

    equipmentInstances.forEach((inst) => {
      if (inst.moduleType === 'RMU') {
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit 1 & 2`,
          defaultVal: 'Ok'
        });
      } else if (inst.moduleType === 'Transformer') {
        rows.push({
          key: `earth_pit_${inst.id}_neutral`,
          label: `${inst.instanceName} Neutral Earth Pit 1 & 2`,
          defaultVal: 'Ok'
        });
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit 1 & 2`,
          defaultVal: 'Ok'
        });
      } else if (inst.moduleType === 'LT_Kiosk') {
        rows.push({
          key: `earth_pit_${inst.id}_body`,
          label: `${inst.instanceName} Body Earth Pit`,
          defaultVal: 'Ok'
        });
      }
    });

    rows.push({
      key: 'earth_pit_fencing',
      label: 'Yard Fencing Earth Pit',
      defaultVal: 'Ok'
    });

    return rows;
  }, [equipmentInstances]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Earth Pit Inspection Log
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-calculated checklist generated dynamically matching site equipment units.
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
          {earthPitRows.length} Earth Pits Registered
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3 text-xs font-extrabold text-slate-700 dark:text-slate-300 grid grid-cols-12 gap-3">
          <div className="col-span-5">Earth Pit Description</div>
          <div className="col-span-3">Status / Condition</div>
          <div className="col-span-4">Remarks & Evidence Photos</div>
        </div>

        {earthPitRows.map((row, idx) => {
          const currentResp = responses[row.key] || {
            moduleType: 'Earth_Pit',
            sectionKey: 'earth_pit_log',
            itemNumber: idx + 1,
            fieldKey: row.key,
            fieldLabel: row.label,
            responseValue: row.defaultVal,
            remarks: '',
            photoUrls: []
          };

          return (
            <div key={row.key} className="px-4 py-3.5 text-xs grid grid-cols-12 gap-3 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="col-span-5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-slate-400 dark:text-slate-500 font-normal">{idx + 1}.</span>
                {row.label}
              </div>

              <div className="col-span-3">
                <select
                  value={currentResp.responseValue || 'Ok'}
                  onChange={(e) =>
                    onChangeResponse(row.key, {
                      ...currentResp,
                      responseValue: e.target.value
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                >
                  <option value="Ok">Ok / Healthy</option>
                  <option value="Maintenance Needed">Maintenance Needed</option>
                  <option value="High Resistance">High Resistance</option>
                  <option value="Not Visible">Not Visible</option>
                </select>
              </div>

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
        })}
      </div>
    </div>
  );
};
