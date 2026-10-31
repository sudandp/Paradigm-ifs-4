import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Truck,
  Car,
  Coffee,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Clock,
  Camera,
  QrCode,
  ArrowRight,
  PackageCheck,
  Flame,
  PhoneForwarded,
  ShieldAlert,
  Building,
  Key,
  ChevronRight
} from 'lucide-react';
import { GateKioskService } from '../../services/offline/gateKioskService';
import type {
  GateUnit,
  GateResident,
  GateDailyHelper,
  GateEntry,
  GateVisitorType,
  GateEmergencyType
} from '../../types/communityGate';
import { supabase } from '../../services/supabase';

// Quick Brand presets for high-frequency gate arrivals
const DELIVERY_PRESETS = [
  { name: 'Swiggy', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: '🍕' },
  { name: 'Zomato', color: 'bg-red-50 border-red-200 text-red-700', icon: '🍔' },
  { name: 'Amazon', color: 'bg-amber-50 border-amber-200 text-amber-800', icon: '📦' },
  { name: 'Blinkit', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚡' },
  { name: 'Uber / Ola', color: 'bg-slate-100 border-slate-300 text-slate-800', icon: '🚕' },
  { name: 'Urban Company', color: 'bg-blue-50 border-blue-200 text-blue-700', icon: '🔧' },
];

export const CommunityGateKiosk: React.FC = () => {
  // Active Society Context
  const [selectedOrgId, setSelectedOrgId] = useState<string>('kolte_patil_itowers');
  const [gateName, setGateName] = useState<string>('Main Gate');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [activeTab, setActiveTab] = useState<'visitor' | 'daily_help' | 'material' | 'patrol'>('visitor');

  // Directory Cache
  const [units, setUnits] = useState<GateUnit[]>([]);
  const [helpers, setHelpers] = useState<GateDailyHelper[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<GateUnit | null>(null);

  // Visitor Form State
  const [visitorType, setVisitorType] = useState<GateVisitorType>('guest');
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorPhone, setVisitorPhone] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Active Pending Verification State
  const [activePendingEntry, setActivePendingEntry] = useState<GateEntry | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(45);

  // Daily Staff Passcode Lookup
  const [helperSearchCode, setHelperSearchCode] = useState<string>('');
  const [matchedHelper, setMatchedHelper] = useState<GateDailyHelper | null>(null);

  // Emergency Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      GateKioskService.syncPendingEntries().then(({ syncedCount }) => {
        if (syncedCount > 0) setPendingSyncCount(0);
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    GateKioskService.prefetchGateData(selectedOrgId).then(cache => {
      setUnits(cache.units);
      setHelpers(cache.helpers);
    });

    try {
      const raw = localStorage.getItem('paradigm_gate_pending_entries');
      if (raw) setPendingSyncCount(JSON.parse(raw).length);
    } catch (e) {}
  }, [selectedOrgId]);

  useEffect(() => {
    const sub = GateKioskService.subscribeToGateApprovals(selectedOrgId, (updated) => {
      if (activePendingEntry && activePendingEntry.id === updated.id) {
        setActivePendingEntry(updated);
      }
    });

    return () => {
      supabase.removeChannel(sub);
    };
  }, [selectedOrgId, activePendingEntry]);

  useEffect(() => {
    if (!activePendingEntry || activePendingEntry.approval_status !== 'pending') return;

    setCountdownSeconds(45);
    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activePendingEntry?.id, activePendingEntry?.approval_status]);

  const filteredUnits = useMemo(() => {
    return GateKioskService.searchUnits(selectedOrgId, searchQuery);
  }, [selectedOrgId, searchQuery]);

  const handleCheckInVisitor = async () => {
    if (!selectedUnit && visitorType !== 'service_technician') {
      alert('Please search and select the destination flat/unit.');
      return;
    }
    if (!visitorName.trim()) {
      alert('Please enter visitor name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await GateKioskService.logVisitorEntry({
        organization_id: selectedOrgId,
        unit_id: selectedUnit?.id,
        visitor_type: visitorType,
        visitor_name: visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        company_name: companyName.trim(),
        entry_gate_name: gateName,
        entry_time: new Date().toISOString(),
        approval_status: 'pending',
        approval_channel: 'app_push'
      });

      if (res.success) {
        setActivePendingEntry(res.entry);
        setVisitorName('');
        setVisitorPhone('');
        setVehicleNumber('');
        setCompanyName('');
        setSelectedUnit(null);
        setSearchQuery('');
      }
    } catch (err: any) {
      alert('Failed to log visitor: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelperCodeSearch = (code: string) => {
    setHelperSearchCode(code);
    if (code.length >= 2) {
      const found = GateKioskService.searchHelperByCode(selectedOrgId, code);
      setMatchedHelper(found);
    } else {
      setMatchedHelper(null);
    }
  };

  const handleTriggerEmergency = async (type: GateEmergencyType) => {
    await GateKioskService.triggerEmergencyAlert(selectedOrgId, type, `${gateName} Security Station`);
    setShowEmergencyModal(false);
    alert(`🚨 Emergency Alert for [${type.toUpperCase()}] broadcasted to all residents and management!`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* ── 1. CLEAN ENTERPRISE TOPBAR ── */}
      <header className="h-18 bg-white border-b border-slate-200/90 px-8 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-[#006B3F] flex items-center justify-center shadow-md shadow-emerald-950/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-black tracking-tight text-slate-900">PARADIGM GATE & COMMUNITY OS</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F0FDF4] text-[#006B3F] border border-emerald-200 uppercase">
                Gate Kiosk v4.2
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Site: <span className="text-[#006B3F] font-bold">Kolte Patil iTowers Exente (437 Flats)</span> • Gate: <span className="text-slate-800 font-semibold">{gateName}</span>
            </p>
          </div>
        </div>

        {/* Live Status, Clock & Sync Controls */}
        <div className="flex items-center space-x-3.5">
          {/* Network Badge */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            isOnline 
              ? 'bg-[#F0FDF4] border-emerald-200 text-[#006B3F]' 
              : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-[#006B3F]" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
            <span>{isOnline ? 'Online Synced' : 'Offline Mode (Local Cache)'}</span>
          </div>

          {/* Pending Sync Button */}
          {pendingSyncCount > 0 && (
            <button
              onClick={() => GateKioskService.syncPendingEntries().then(() => setPendingSyncCount(0))}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync ({pendingSyncCount})</span>
            </button>
          )}

          {/* Clock */}
          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs font-bold">
            {currentTime || '--:--:--'}
          </div>

          {/* SOS Panic Button */}
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm active:scale-95 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>SOS PANIC</span>
          </button>
        </div>
      </header>

      {/* ── 2. DUAL INTERFACE BODY ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Menu */}
        <aside className="w-64 bg-white border-r border-slate-200/80 p-4 flex flex-col justify-between shrink-0 shadow-xs">
          <div className="space-y-1.5">
            {[
              { id: 'visitor', label: 'Visitor & Delivery', icon: UserCheck },
              { id: 'daily_help', label: 'Daily Staff (Maid/Driver)', icon: Users },
              { id: 'material', label: 'Material Gate Pass', icon: PackageCheck },
              { id: 'patrol', label: 'Guard Patrol QR', icon: QrCode }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#F0FDF4] text-[#006B3F] font-bold border border-emerald-200 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#006B3F]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Station Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Duty Roster:</span>
              <span className="text-[#006B3F]">DAY-12 (07:00-19:00)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Station ID:</span>
              <span className="font-mono">KIOSK-GATE-01</span>
            </div>
          </div>
        </aside>

        {/* Center Main Stage (Crisp White Canvas) */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'visitor' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Active Approval Banner if waiting */}
              {activePendingEntry && (
                <div className={`p-5 rounded-2xl border transition-all ${
                  activePendingEntry.approval_status === 'approved'
                    ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                    : activePendingEntry.approval_status === 'denied'
                    ? 'bg-red-50 border-red-300 shadow-sm'
                    : 'bg-amber-50 border-amber-300 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {activePendingEntry.approval_status === 'approved' ? (
                        <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                      ) : activePendingEntry.approval_status === 'denied' ? (
                        <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white">
                          <XCircle className="w-7 h-7" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 font-bold font-mono text-lg">
                          {countdownSeconds}s
                        </div>
                      )}

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-bold text-slate-900">{activePendingEntry.visitor_name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase">
                            {activePendingEntry.visitor_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {activePendingEntry.approval_status === 'approved'
                            ? '✅ RESIDENT APPROVED ENTRY! Allow visitor inside.'
                            : activePendingEntry.approval_status === 'denied'
                            ? '❌ ENTRY DENIED BY RESIDENT. Do not permit entry.'
                            : countdownSeconds > 0
                            ? `Waiting for Resident App Approval... (${countdownSeconds}s remaining before IVR call)`
                            : `45s elapsed! Exotel Automated IVR Call Triggered to Resident...`}
                        </p>
                      </div>
                    </div>

                    {activePendingEntry.approval_status !== 'pending' && (
                      <button
                        onClick={() => setActivePendingEntry(null)}
                        className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                      >
                        Clear Screen
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 1. Quick Presets Bar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  1. Quick Preset / Delivery Partner
                </label>
                <div className="grid grid-cols-6 gap-3">
                  {DELIVERY_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setCompanyName(preset.name);
                        setVisitorType('delivery');
                        setVisitorName(`${preset.name} Executive`);
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition active:scale-95 shadow-2xs ${
                        companyName === preset.name
                          ? 'border-[#006B3F] bg-[#F0FDF4] ring-2 ring-emerald-300'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className="text-xl">{preset.icon}</span>
                      <span className="text-[11px] font-bold text-slate-800">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Flat Search & Selector */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  2. Select Destination Flat / Unit
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Flat (e.g. 102, 903, Tower A)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white text-sm"
                  />
                </div>

                {/* Suggestions List */}
                {searchQuery.trim() && (
                  <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 grid grid-cols-4 gap-2">
                    {filteredUnits.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUnit(u);
                          setSearchQuery(`${u.block_tower} - ${u.unit_number}`);
                        }}
                        className={`p-2.5 rounded-lg text-left border transition ${
                          selectedUnit?.id === u.id
                            ? 'bg-[#F0FDF4] border-[#006B3F] text-[#006B3F]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold text-xs text-slate-900">{u.unit_number}</div>
                        <div className="text-[10px] text-slate-500">{u.block_tower}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Visitor Inputs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  3. Visitor Information
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Visitor / Driver Name</label>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Vehicle Plate Number</label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. KA 03 AB 1234"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Entry Category</label>
                    <select
                      value={visitorType}
                      onChange={(e) => setVisitorType(e.target.value as GateVisitorType)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white"
                    >
                      <option value="guest">Guest / Personal Visitor</option>
                      <option value="delivery">E-Commerce / Food Delivery</option>
                      <option value="cab">Taxi / Cab Entry</option>
                      <option value="service_technician">Technician / Maintenance</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleCheckInVisitor}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#006B3F] hover:bg-[#005632] active:scale-[0.99] text-white font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>SEND APPROVAL REQUEST (APP + IVR)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'daily_help' && (
            <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
              <h2 className="text-base font-bold text-slate-900">Daily Staff (Domestic Help) Check-In</h2>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Enter 4-Digit Helper Code</label>
                <input
                  type="text"
                  value={helperSearchCode}
                  onChange={(e) => handleHelperCodeSearch(e.target.value)}
                  placeholder="e.g. 1002 or DH-1002"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006B3F] focus:bg-white"
                />
              </div>

              {matchedHelper && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{matchedHelper.full_name}</h3>
                    <p className="text-xs text-[#006B3F] font-semibold">{matchedHelper.helper_type} • {matchedHelper.helper_code}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Status: <span className="font-bold uppercase text-slate-800">{matchedHelper.current_status}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      alert(`${matchedHelper.full_name} status updated!`);
                      setMatchedHelper(null);
                      setHelperSearchCode('');
                    }}
                    className="px-4 py-2 bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    TOGGLE STATUS
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'material' && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-3">
              <PackageCheck className="w-10 h-10 text-[#006B3F] mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Material Gate Pass & Move-In NOC</h3>
              <p className="text-xs text-slate-500">Scan QR Code on the material pass or enter pass number.</p>
              <button
                onClick={() => alert('Pass scanner ready')}
                className="px-5 py-2.5 bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                OPEN PASS SCANNER
              </button>
            </div>
          )}

          {activeTab === 'patrol' && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-3">
              <QrCode className="w-10 h-10 text-[#006B3F] mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Security Guard Patrol Scanner</h3>
              <p className="text-xs text-slate-500">Scan perimeter checkpoint tags during rounds.</p>
              <button
                onClick={() => alert('Patrol scanner ready')}
                className="px-5 py-2.5 bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                SCAN CHECKPOINT
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── 3. EMERGENCY SOS MODAL ── */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white border border-red-300 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-600">
              <Flame className="w-6 h-6 animate-pulse" />
              <h2 className="text-lg font-black tracking-tight text-slate-900">EMERGENCY BROADCAST</h2>
            </div>
            <p className="text-xs text-slate-600">
              Broadcasting an emergency alerts all residents and facility management immediately.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'fire', label: 'FIRE ALARM', icon: Flame },
                { type: 'medical', label: 'MEDICAL SOS', icon: AlertTriangle },
                { type: 'lift_entrapment', label: 'LIFT ENTRAPMENT', icon: Building },
                { type: 'security_threat', label: 'SECURITY THREAT', icon: ShieldAlert }
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleTriggerEmergency(item.type as any)}
                  className="p-3.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition"
                >
                  <item.icon className="w-5 h-5 text-red-600" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityGateKiosk;
