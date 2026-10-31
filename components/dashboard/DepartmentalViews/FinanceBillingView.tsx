import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Flame, 
  Zap, 
  Receipt, 
  AlertTriangle, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';

export const FinanceBillingView: React.FC<{
  siteFilter: string;
}> = () => {
  // Monthly Invoicing Status
  const invoicePipeline = [
    { site: 'iTowers Exente', invoiceNo: 'INV-2026-1001', amount: '₹14,25,000', status: 'Paid', date: '22 Oct 2026' },
    { site: 'Southwall Residency', invoiceNo: 'INV-2026-1002', amount: '₹8,90,000', status: 'Sent to Client', date: '24 Oct 2026' },
    { site: 'Sobha Silicon Oasis', invoiceNo: 'INV-2026-1003', amount: '₹12,40,000', status: 'Approved - Pending Dispatch', date: '25 Oct 2026' },
    { site: 'Green Valley Villas', invoiceNo: 'INV-2026-1004', amount: '₹5,80,000', status: 'Draft Verification', date: '26 Oct 2026' }
  ];

  // AR Aging Buckets
  const arAging = [
    { bucket: 'Current (0-30 Days)', amount: '₹28,50,000', count: 18, risk: 'low' },
    { bucket: '31 - 60 Days', amount: '₹6,40,000', count: 4, risk: 'medium' },
    { bucket: '61 - 90 Days', amount: '₹3,10,000', count: 2, risk: 'high' },
    { bucket: '90+ Days (Delinquent)', amount: '₹1,80,000', count: 1, risk: 'critical' }
  ];

  // DG Fuel vs EB Energy Cost Reconciliation
  const energyRecon = [
    { site: 'iTowers Exente', ebUnits: '42,500 kWh', ebCost: '₹3,82,500', dgFuelLiters: '850 L', dgGenKwh: '2,890 kWh', dgCostPerUnit: '₹26.4/unit', status: 'Normal' },
    { site: 'Sobha Silicon Oasis', ebUnits: '31,200 kWh', ebCost: '₹2,80,800', dgFuelLiters: '1,200 L', dgGenKwh: '3,480 kWh', dgCostPerUnit: '₹31.0/unit', status: 'High DG Burn' }
  ];

  // Chemical & Consumables Burn Rate
  const consumableBudget = {
    totalBudget: '₹4,50,000',
    spentToDate: '₹3,20,000',
    remainingBudget: '₹1,30,000',
    burnPercentage: '71%'
  };

  return (
    <div className="space-y-6">
      {/* Top Finance KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Invoiced Amount */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Invoiced (Oct)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹41.35L
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              88% Generated
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Fixed Fee & Cost Plus</span>
            <span className="text-slate-700 font-semibold">24 Invoices</span>
          </div>
        </div>

        {/* Card 2: Accounts Receivable */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding Receivables
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹11.30L
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              AR Balance
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>DSO: 28 Days</span>
            <span className="text-rose-600 font-semibold text-[11px]">₹1.8L &gt;90d</span>
          </div>
        </div>

        {/* Card 3: Energy & DG Cost */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              DG Diesel & EB Utility
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹6.63L
            </span>
            <span className="text-xs font-semibold text-slate-600">
              October Run
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>2,050L Fuel Burned</span>
            <span className="text-amber-700 font-semibold text-[11px]">1 High Site</span>
          </div>
        </div>

        {/* Card 4: Consumables Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chemical & Consumable Cap
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {consumableBudget.burnPercentage}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Within Cap
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Spent: {consumableBudget.spentToDate}</span>
            <span className="text-slate-600 font-medium">Rem: {consumableBudget.remainingBudget}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Invoicing Pipeline & AR Aging Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Invoicing Status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Monthly Facility Invoicing Pipeline
                </h3>
                <p className="text-[11px] text-slate-500">Draft, verification, client submission, and collection status.</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {invoicePipeline.map(inv => (
              <div key={inv.invoiceNo} className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{inv.site}</span>
                    <span className="text-[11px] font-mono text-slate-400">({inv.invoiceNo})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Date: {inv.date}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900 block">{inv.amount}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inv.status === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : inv.status.includes('Sent')
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AR Aging Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Accounts Receivable (AR) Aging Matrix
                </h3>
                <p className="text-[11px] text-slate-500">Breakdown of delinquent accounts by aging interval.</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {arAging.map((ar, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{ar.bucket}</h4>
                  <p className="text-[11px] text-slate-400">{ar.count} Invoices in bucket</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900 block">{ar.amount}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    ar.risk === 'low'
                      ? 'bg-emerald-50 text-emerald-700'
                      : ar.risk === 'medium'
                      ? 'bg-blue-50 text-blue-700'
                      : ar.risk === 'high'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-rose-100 text-rose-800 font-black'
                  }`}>
                    {ar.risk} risk
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
