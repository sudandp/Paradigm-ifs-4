import React from 'react';
import { 
  Briefcase, 
  LifeBuoy, 
  FileCheck, 
  Package, 
  Key, 
  Truck, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';

export const BackOfficeView: React.FC<{
  siteFilter: string;
}> = () => {
  // Helpdesk Tickets
  const ticketSummary = {
    openTotal: 24,
    electrical: 9,
    plumbing: 7,
    hvacLifts: 5,
    civilSecurity: 3,
    avgResponseMinutes: 14
  };

  // Material Requisitions (PO Approvals)
  const pendingPOs = [
    { id: 'PO-4481', site: 'iTowers Exente', item: 'Kirloskar 5HP Submersible Drainage Pump', amount: '₹34,500', vendor: 'Apex Pumps & Motors', status: 'Pending Approval' },
    { id: 'PO-4482', site: 'Southwall Residency', item: '40x Philips 36W LED Batten Light Fixtures', amount: '₹18,400', vendor: 'Bajaj Electricals Dist.', status: 'Pending Approval' },
    { id: 'PO-4483', site: 'Sobha Silicon', item: '200L Diversey Restroom Cleaning Chemicals', amount: '₹22,800', vendor: 'CleanTech Facility Supply', status: 'Approved - Dispatched' }
  ];

  // Central Warehouse Critical Spares
  const criticalSpares = [
    { name: 'Portable 5kW Emergency Generator', stock: '2 Units', location: 'Central Warehouse B-2', condition: 'Tested Ready' },
    { name: 'Submersible Dewatering Pump 3HP', stock: '4 Units', location: 'Central Warehouse A-1', condition: 'Tested Ready' },
    { name: 'Full Body Fall Arrest Safety Harnesses', stock: '12 Sets', location: 'Safety Locker 4', condition: 'Certified 2026' },
    { name: 'Infrared Thermal Imaging Gun (HT Panel)', stock: '3 Units', location: 'Technical Testing Lab', condition: 'Calibrated' }
  ];

  // Key & Access Card Checkout
  const activeKeyLogs = [
    { keyName: 'HT Electrical Substation Master Key', site: 'iTowers Exente', holder: 'Kishore M. (Sr. MEP)', timeOut: 'Today 09:15 AM', status: 'Active' },
    { keyName: 'B-Block Elevator Motor Room Key', site: 'Southwall', holder: 'Otis Technician (Ramesh)', timeOut: 'Today 11:30 AM', status: 'Active' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Helpdesk Load */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Central Helpdesk Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {ticketSummary.openTotal}
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Active Queue
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Avg Response: {ticketSummary.avgResponseMinutes}m</span>
            <span className="font-semibold text-emerald-700">98% SLA Met</span>
          </div>
        </div>

        {/* PO Approvals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending PO Approvals
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹75,700
            </span>
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              3 Requisitions
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Spares & Consumables</span>
            <span className="text-slate-600 font-semibold">Immediate Review</span>
          </div>
        </div>

        {/* Warehouse Spares */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Emergency Backup Inventory
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              21 Assets
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              100% Tested
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Pumps & Gensets</span>
            <span className="text-slate-600 font-medium">Ready for Dispatch</span>
          </div>
        </div>

        {/* Master Key Register */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Facility Keys Checked Out
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006B3F] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {activeKeyLogs.length} Keys
            </span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              Logged & Tracked
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Substations & Lift Rooms</span>
            <span className="text-emerald-700 font-semibold">Active Authorized</span>
          </div>
        </div>
      </div>

      {/* Row 2: Material PO Approvals & Central Warehouse Spares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material Requisition & PO Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Site Material Requisitions & PO Approvals
                </h3>
                <p className="text-[11px] text-slate-500">Spare parts and consumable replenishment sign-offs.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              {pendingPOs.length} Requisitions
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingPOs.map(po => (
              <div key={po.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-[#006B3F] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {po.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{po.site}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{po.amount}</span>
                </div>

                <h4 className="text-sm font-semibold text-slate-800">{po.item}</h4>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Vendor: <strong className="text-slate-600">{po.vendor}</strong></span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${
                    po.status.includes('Approved') 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {po.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Central Warehouse Critical Spares */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Central Warehouse Emergency Backup Equipment
                </h3>
                <p className="text-[11px] text-slate-500">Standby pumps, portable gensets, and high-altitude safety kits.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              Audit Verified
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {criticalSpares.map((spare, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">{spare.name}</h4>
                  <p className="text-[11px] text-slate-400">Bay: {spare.location}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-900 block">{spare.stock}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {spare.condition}
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
