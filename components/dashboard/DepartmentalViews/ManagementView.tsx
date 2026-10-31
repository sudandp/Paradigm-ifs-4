import React, { useMemo } from 'react';
import { 
  Building2, 
  TrendingUp, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  ShieldCheck, 
  Award, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  Layers, 
  FileText, 
  Flame, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export const ManagementView: React.FC<{
  siteFilter: string;
}> = ({ siteFilter }) => {
  // 1. Portfolio Health Index
  const portfolioHealth = {
    overallScore: 92,
    ppmScore: 94,
    manpowerFulfillment: 96,
    snagResolutionVelocity: 88,
    csatScore: 4.8
  };

  // 2. Contracts & Run Rate
  const contractStats = {
    activeContracts: 28,
    totalManagedSqFt: '14.2M sq.ft',
    mrr: '₹48.6 Lakhs',
    expiringIn30Days: 2,
    expiringIn60Days: 4
  };

  // 3. Manpower Deployment Deficit Heatmap
  const siteDeficits = [
    { site: 'Sobha Silicon Oasis', sanctioned: 24, deployed: 21, deficit: 3, criticalDept: 'Technical MEP' },
    { site: 'Brigade Gateway Commercial', sanctioned: 18, deployed: 16, deficit: 2, criticalDept: 'Security Guards' },
    { site: 'Southwall Residency', sanctioned: 14, deployed: 14, deficit: 0, criticalDept: 'Fully Staffed' },
    { site: 'iTowers Exente', sanctioned: 32, deployed: 31, deficit: 1, criticalDept: 'Housekeeping' },
  ];

  // 4. P0 Escalations
  const criticalEscalations = [
    {
      id: 'ESC-901',
      site: 'iTowers Exente',
      title: 'Tower B Passenger Lift #1 Inverter Drive Trip',
      raisedBy: 'Johnson Lifts AMC',
      time: '42 mins ago',
      severity: 'Critical P0',
      actionNeeded: 'Vendor technician on site, awaiting parts clearance.'
    },
    {
      id: 'ESC-902',
      site: 'Sobha Silicon Oasis',
      title: 'DG Set 2 Diesel Level Below 20% Reserve',
      raisedBy: 'MEP Shift Supervisor',
      time: '1h 15m ago',
      severity: 'High P1',
      actionNeeded: 'Emergency 1,000L diesel tanker dispatched from BPCL outlet.'
    }
  ];

  // 5. Consolidated Billing & Collections
  const billingStats = {
    billedOctober: '₹52,40,000',
    collectedToDate: '₹39,80,000',
    collectionRate: '76%',
    overdue45Days: '₹4,20,000'
  };

  return (
    <div className="space-y-6">
      {/* Top Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Property Portfolio Health */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Portfolio Health Index
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {portfolioHealth.overallScore}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Optimal Grade
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3 text-[11px]">
            <div>
              <span className="text-slate-400 block">PPM Rate</span>
              <strong className="text-slate-700">{portfolioHealth.ppmScore}%</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Manpower</span>
              <strong className="text-slate-700">{portfolioHealth.manpowerFulfillment}%</strong>
            </div>
            <div>
              <span className="text-slate-400 block">CSAT</span>
              <strong className="text-emerald-700 font-bold">{portfolioHealth.csatScore}/5</strong>
            </div>
          </div>
        </div>

        {/* Card 2: MRR & Contracts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Run Rate (MRR)
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {contractStats.mrr}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              / month
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{contractStats.activeContracts} Active Contracts</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
              {contractStats.expiringIn30Days} Renewals Due
            </span>
          </div>
        </div>

        {/* Card 3: Billing vs Collections */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              October Collections
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {billingStats.collectedToDate}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              ({billingStats.collectionRate})
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Billed: {billingStats.billedOctober}</span>
            <span className="text-rose-600 font-semibold text-[11px]">
              {billingStats.overdue45Days} Delinquent
            </span>
          </div>
        </div>

        {/* Card 4: Managed Area & Properties */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Managed Space
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {contractStats.totalManagedSqFt}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Commercial & High-Rise</span>
            <span className="font-semibold text-emerald-700 text-[11px]">
              100% Retained
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: P0 Incident Queue & Manpower Deficit Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P0 Incident Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Executive P0 / P1 Incident Escalations
                </h3>
                <p className="text-[11px] text-slate-500">Unresolved high-impact events requiring senior attention.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
              {criticalEscalations.length} Active
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {criticalEscalations.map(esc => (
              <div key={esc.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                      {esc.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{esc.site}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{esc.time}</span>
                </div>

                <h4 className="text-sm font-semibold text-slate-900">
                  {esc.title}
                </h4>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <strong className="text-slate-700">Directive Status:</strong> {esc.actionNeeded}
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>Logged by: {esc.raisedBy}</span>
                  <button className="text-[#006B3F] font-semibold hover:underline flex items-center gap-1">
                    <span>Incident Room</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manpower Deficit Heatmap */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Site Manpower Deployment Fulfillment
                </h3>
                <p className="text-[11px] text-slate-500">Approved sanctioned vs deployed staff across properties.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              96.2% Deployed
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {siteDeficits.map(site => {
              const percentage = Math.round((site.deployed / site.sanctioned) * 100);
              const hasDeficit = site.deficit > 0;

              return (
                <div key={site.site} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">{site.site}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">
                        {site.deployed}/{site.sanctioned} staff
                      </span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        hasDeficit 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {hasDeficit ? `-${site.deficit} Deficit` : '100% Filled'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        hasDeficit ? 'bg-amber-500' : 'bg-[#006B3F]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span>Deficit Department: <strong className="text-slate-600">{site.criticalDept}</strong></span>
                    <span className="font-semibold text-slate-700">{percentage}% deployment</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
