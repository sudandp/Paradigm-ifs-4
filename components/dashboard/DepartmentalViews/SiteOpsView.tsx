import React from 'react';
import { 
  Building2, 
  Wrench, 
  QrCode, 
  Activity, 
  Droplet, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

export const SiteOpsView: React.FC<{
  siteFilter: string;
}> = () => {
  // 1. Live On-Ground Team Radar
  const onGroundTeam = [
    { name: 'Santosh Patil', role: 'Sr. MEP Engineer', site: 'iTowers Exente', status: 'On-Site', location: 'STP Plant Room', phone: '9845012345' },
    { name: 'Manoj Sharma', role: 'Technical Supervisor', site: 'Southwall Residency', status: 'On-Site', location: 'DG Set Substation', phone: '9880198765' },
    { name: 'Kishore M.', role: 'Electrical Specialist', site: 'Sobha Silicon Oasis', status: 'In-Transit', location: 'En route to HT Yard', phone: '9740234567' },
    { name: 'Praveen Kumar', role: 'Security Field Officer', site: 'Brigade Gateway', status: 'On-Site', location: 'Main Gate Kiosk', phone: '9900345678' }
  ];

  // 2. Today's PPM Schedule
  const ppmTasks = [
    { equip: 'DG Set 500 kVA (DG-01)', site: 'iTowers Exente', checkType: 'Weekly B-Check (Lubricant & Filter)', status: 'In Progress', tech: 'Santosh Patil' },
    { equip: 'Fire Jockey Pump #2', site: 'Southwall', checkType: 'Monthly Pressure Run Test', status: 'Completed', tech: 'Manoj Sharma' },
    { equip: 'STP Aeration Blower #1', site: 'Sobha Silicon', checkType: 'Bi-Weekly Belt & Oil Inspection', status: 'Pending', tech: 'Kishore M.' }
  ];

  // 3. STP / WTP Water Quality Metrics
  const waterTelemetry = [
    { site: 'iTowers Exente', stpPh: '7.4 pH', turbidity: '3.8 NTU', residualChlorine: '1.2 ppm', domesticTank: '85% Full', fireReserve: '100% Full', status: 'Optimal' },
    { site: 'Southwall Residency', stpPh: '7.8 pH', turbidity: '4.2 NTU', residualChlorine: '0.9 ppm', domesticTank: '68% Full', fireReserve: '100% Full', status: 'Optimal' }
  ];

  // 4. Critical Open Snags (Asset QR)
  const openSnags = [
    { id: 'SNG-412', site: 'iTowers Exente', title: 'Basement 1 drainage non-return valve leaking', priority: 'High', daysOpen: 1, assignee: 'Apex Plumbing' },
    { id: 'SNG-419', site: 'Sobha Silicon', title: 'Clubhouse emergency exit push-bar latch jammed', priority: 'Critical', daysOpen: 2, assignee: 'In-House Carpentry' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Site Ops KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: On-Site Personnel */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Field Technical Crew
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              18 Engineers
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Active On-Site
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>MEP & Supervisors</span>
            <span className="font-semibold text-slate-700">4 In-Transit</span>
          </div>
        </div>

        {/* Card 2: PPM Execution Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              PPM Execution Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              94.8%
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              On Schedule
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>DG, STP, Elevators</span>
            <span className="text-emerald-700 font-semibold">14 Done Today</span>
          </div>
        </div>

        {/* Card 3: Asset QR Scans */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Asset QR Compliance
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              96.2%
            </span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              Verified
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Checkpoints Tagged</span>
            <span className="text-slate-700 font-semibold">188 Checkpoints</span>
          </div>
        </div>

        {/* Card 4: Water Treatment Plant Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              STP / WTP Compliance
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              100%
            </span>
            <span className="text-xs font-semibold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              PCB Standard
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>pH 7.4 • 3.8 NTU</span>
            <span className="text-emerald-700 font-semibold">Zero Odour</span>
          </div>
        </div>
      </div>

      {/* Row 2: Live Team Radar & PPM Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Team On-Ground Radar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Technical & Supervisory Radar
                </h3>
                <p className="text-[11px] text-slate-500">Active engineers and area officers deployed on-site.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Field GPS
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {onGroundTeam.map((member, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{member.name}</h4>
                    <span className="text-[11px] text-slate-500">({member.role})</span>
                  </div>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <strong>{member.site}</strong> • {member.location}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    member.status === 'On-Site' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {member.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-1">
                    {member.phone}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's PPM Execution Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Today's Preventive Maintenance (PPM)
                </h3>
                <p className="text-[11px] text-slate-500">Daily, weekly, and monthly machinery check execution.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {ppmTasks.length} Scheduled
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {ppmTasks.map((task, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/70 transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{task.equip}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {task.site}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    task.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : task.status === 'In Progress'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{task.checkType}</p>
                <div className="text-[11px] text-slate-400 pt-0.5">
                  Technician: <strong className="text-slate-600">{task.tech}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
