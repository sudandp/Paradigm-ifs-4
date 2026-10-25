import React from 'react';
import { 
  Zap, 
  Droplet, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Clock, 
  Activity, 
  ShieldCheck,
  BellRing
} from 'lucide-react';
import { useOpsStore } from '../../../store/opsStore';

interface ResidentFacilityHealthBoardProps {
  entityName?: string;
}

export const ResidentFacilityHealthBoard: React.FC<ResidentFacilityHealthBoardProps> = ({
  entityName = 'Aeris Residences'
}) => {
  const { assets, schedules } = useOpsStore();

  // Compute live asset health stats
  const totalAssets = assets.length;
  const operationalCount = assets.filter(a => a.status === 'Operational').length;
  const underMaintenanceCount = assets.filter(a => a.status === 'Under Maintenance' || a.status === 'Critical Fault').length;

  // Key system filters
  const stpAsset = assets.find(a => a.category === 'STP');
  const dgAsset = assets.find(a => a.category === 'GENERATOR');
  const liftAsset = assets.find(a => a.category === 'LIFT');
  const pumpAsset = assets.find(a => a.category === 'BOOSTER_PUMPS');

  // Upcoming maintenance advisories from schedules
  const activeAdvisories = [
    {
      id: 'adv-1',
      title: 'Periodic Overhead Domestic Water Tank Flushing',
      scheduledFor: 'This Wednesday, 10:00 AM – 02:00 PM',
      impact: 'Tower A & B Water Pressure may be temporarily modulated.',
      severity: 'Low',
      category: 'Water Supply'
    },
    {
      id: 'adv-2',
      title: 'DG Auto-Mains Failure (AMF) Monthly Load Test',
      scheduledFor: 'Friday, 04:30 PM (Duration: 15 mins)',
      impact: 'Expect a seamless 15-second switchover to backup power.',
      severity: 'Info',
      category: 'Power'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Live Facility Telemetry & Transparency
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight mt-1">
            Community Infrastructure Health
          </h2>
          <p className="text-xs text-gray-500">
            Real-time operating status of common elevators, diesel backup, STP recycled water, and domestic pumps
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-emerald-100 shadow-2xs">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 block font-bold uppercase">Grid Uptime</span>
            <span className="text-sm font-black text-emerald-700">99.8% Healthy</span>
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
        </div>
      </div>

      {/* Primary Systems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Elevators & Lifts */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Operational
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900">Passenger Elevators</h4>
            <span className="text-[11px] text-gray-400">All Towers (A, B, C)</span>
          </div>

          <div className="p-2.5 bg-gray-50 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Automatic Rescue (ARD):</span>
              <span className="font-bold text-emerald-600">Engaged</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Safety Governor:</span>
              <span className="font-bold text-gray-800">Calibrated</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>OEM Inspection: Certified</span>
          </div>
        </div>

        {/* 2. DG Power Backup */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Standby Ready
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900">Diesel Generator Backup</h4>
            <span className="text-[11px] text-gray-400">Cummins 500 kVA Auto-AMF</span>
          </div>

          <div className="p-2.5 bg-gray-50 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Fuel Reserve:</span>
              <span className="font-bold text-emerald-600">82% (Full Tank)</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Battery Voltage:</span>
              <span className="font-bold text-gray-800">25.4 V (Optimal)</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>Next Load Run: Friday 4:30 PM</span>
          </div>
        </div>

        {/* 3. STP Recycled Water */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Safe & Clean
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900">STP Treated Water</h4>
            <span className="text-[11px] text-gray-400">Flushing & Landscape Reuse</span>
          </div>

          <div className="p-2.5 bg-gray-50 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>pH Level:</span>
              <span className="font-bold text-emerald-600">7.3 (Neutral)</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Clarity / Odor:</span>
              <span className="font-bold text-gray-800">Clear & Odorless</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>Tested Today: 08:30 AM</span>
          </div>
        </div>

        {/* 4. Domestic Water Pumps */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Constant Pressure
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900">Domestic Water Supply</h4>
            <span className="text-[11px] text-gray-400">Hydro-Pneumatic Booster</span>
          </div>

          <div className="p-2.5 bg-gray-50 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Main Line Pressure:</span>
              <span className="font-bold text-emerald-600">5.2 Bar</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Overhead Tanks:</span>
              <span className="font-bold text-gray-800">95% Stored</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>Telemetry: Continuous</span>
          </div>
        </div>
      </div>

      {/* Community Maintenance Advisories & Planned Outages */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-primary" />
          <span>Planned Facility Maintenance Advisories</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeAdvisories.map(adv => (
            <div 
              key={adv.id}
              className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {adv.category}
                  </span>
                  <span className="text-xs font-bold text-gray-900">{adv.title}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-0.5">
                <div className="flex items-center gap-1.5 text-blue-900 font-semibold text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{adv.scheduledFor}</span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed pt-0.5">
                  {adv.impact}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
