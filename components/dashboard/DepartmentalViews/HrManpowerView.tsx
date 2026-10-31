import React from 'react';
import { 
  Users, 
  Cpu, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  UserPlus, 
  FileCheck, 
  CheckCircle2, 
  Shirt, 
  RefreshCw 
} from 'lucide-react';

export const HrManpowerView: React.FC<{
  siteFilter: string;
}> = () => {
  // Shift Muster Stats
  const shiftMuster = {
    shiftA: { name: 'Shift A (Morning 07:00-15:00)', present: 48, required: 50 },
    shiftB: { name: 'Shift B (Afternoon 14:00-22:00)', present: 36, required: 36 },
    shiftC: { name: 'Shift C (Night 21:00-07:00)', present: 22, required: 22 },
    generalShift: { name: 'General Shift (09:00-18:00)', present: 18, required: 19 },
    totalPresent: 124,
    totalSanctioned: 127
  };

  // Biometric Device Telemetry
  const bioDevices = [
    { name: 'iTowers Exente - Main Gate eSSL #1', ip: '192.168.1.102', lastSync: '2 mins ago', status: 'Online' },
    { name: 'iTowers Exente - Service Entry Biometric #2', ip: '192.168.1.103', lastSync: '3 mins ago', status: 'Online' },
    { name: 'Southwall Residency - Clubhouse Device #1', ip: '192.168.2.14', lastSync: '1 min ago', status: 'Online' },
    { name: 'Sobha Silicon - Basement 1 Maintenance Punch', ip: '192.168.3.45', lastSync: '28 mins ago', status: 'Sync Delayed' }
  ];

  // Double Duty (2.0x) Watch & Overtime Exposure
  const doubleDutyWatch = [
    { staff: 'Raju Nayak', role: 'Security Guard', site: 'Southwall Residency', combination: 'A+B (14.5 Hours)', multiplier: '2.0x', needsRelief: true },
    { staff: 'Sunil Verma', role: 'MEP Shift Technician', site: 'iTowers Exente', combination: 'B+C (15 Hours)', multiplier: '2.0x', needsRelief: true }
  ];

  // Expiring Guard Verifications / Documents
  const expiringDocs = [
    { staff: 'Ramesh Naik', site: 'iTowers Exente', docType: 'Police Verification Certificate', expires: 'In 6 days', action: 'Renewal Initiated' },
    { staff: 'Dinesh Kumar', site: 'Sobha Silicon', docType: 'Medical Fitness Certificate', expires: 'In 12 days', action: 'Appointment Scheduled' }
  ];

  return (
    <div className="space-y-6">
      {/* Top HR KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Shift Muster */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Field Headcount
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {shiftMuster.totalPresent}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              / {shiftMuster.totalSanctioned} Sanctioned
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Shift A, B, C & GS</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
              97.6% Punctuality
            </span>
          </div>
        </div>

        {/* Card 2: Biometric Sync Health */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Biometric Hardware Sync
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              11 / 12
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Online
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>eSSL & Face Logs</span>
            <span className="text-amber-700 font-semibold text-[11px]">1 Delayed</span>
          </div>
        </div>

        {/* Card 3: Double Duty Exposure */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Double Duty (2.0x) Watch
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {doubleDutyWatch.length} Duties
            </span>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Fatigue Watch
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>A+B & B+C Combinations</span>
            <span className="font-semibold text-slate-700">Relief Queued</span>
          </div>
        </div>

        {/* Card 4: Weekly Off Compliance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Weekly Off (1 W/O) Rule
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              100%
            </span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              Compliant
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>6-Day Cycle Enforced</span>
            <span className="text-emerald-700 font-semibold">Zero Violations</span>
          </div>
        </div>
      </div>

      {/* Row 2: Shift Breakdown & Double Duty Relief Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shift Muster Roster */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daily Shift Deployment Muster
                </h3>
                <p className="text-[11px] text-slate-500">Live headcount across morning, afternoon, and night shifts.</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 p-2">
            {Object.values(shiftMuster).filter((v: any) => v.name).map((shift: any, idx) => (
              <div key={idx} className="p-3 hover:bg-slate-50/70 transition-colors flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{shift.name}</h4>
                  <p className="text-[11px] text-slate-400">Required: {shift.required} staff</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">{shift.present} Present</span>
                  <span className={`text-[10px] font-bold block ${shift.present >= shift.required ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {shift.present >= shift.required ? 'Full Roster' : `-${shift.required - shift.present} Shortfall`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Double Duty & Overtime Fatigue Watch */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Double Duty (2.0x Multiplier) & Fatigue Watch
                </h3>
                <p className="text-[11px] text-slate-500">Staff exceeding 14 hours continuous operational duty.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
              Mandatory Relief
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {doubleDutyWatch.map((dd, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/70 transition-colors space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{dd.staff}</span>
                    <span className="text-[11px] text-slate-500">({dd.role})</span>
                  </div>
                  <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {dd.multiplier} Rate
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Site: <strong className="text-slate-800">{dd.site}</strong></span>
                  <span className="font-mono font-semibold text-slate-700">{dd.combination}</span>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
                    Relief Staff Dispatched for Shift C
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
