import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Users,
  Plus,
  Share2,
  Bell,
  ArrowRight,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { GateEntry } from '../../types/communityGate';

interface ResidentGatePassViewProps {
  unitId?: string;
  residentName?: string;
  flatNumber?: string;
  towerName?: string;
}

export const ResidentGatePassView: React.FC<ResidentGatePassViewProps> = ({
  unitId = 'default_unit',
  residentName = 'Resident',
  flatNumber = '102',
  towerName = 'Tower A'
}) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'pre_invite' | 'daily_help'>('approvals');
  const [pendingApprovals, setPendingApprovals] = useState<GateEntry[]>([
    {
      id: 'mock_entry_1',
      organization_id: 'kolte_patil_itowers',
      visitor_type: 'delivery',
      visitor_name: 'Zomato Delivery Executive',
      company_name: 'Zomato',
      vehicle_number: 'KA 03 EF 4412',
      entry_gate_name: 'Main Gate',
      entry_time: new Date().toISOString(),
      approval_status: 'pending',
      approval_channel: 'app_push'
    }
  ]);
  const [preInviteName, setPreInviteName] = useState<string>('');
  const [preInvitePhone, setPreInvitePhone] = useState<string>('');
  const [generatedPassCode, setGeneratedPassCode] = useState<string | null>(null);

  const [householdStaff, setHouseholdStaff] = useState<Array<{ name: string; role: string; status: 'inside' | 'outside'; time?: string }>>([
    { name: 'Lakshmi Devi', role: 'Maid', status: 'inside', time: '07:45 AM' },
    { name: 'Murugan R', role: 'Driver', status: 'outside' }
  ]);

  useEffect(() => {
    const channel = supabase
      .channel(`resident_unit_${unitId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gate_entries',
          filter: `unit_id=eq.${unitId}`
        },
        (payload) => {
          const entry = payload.new as GateEntry;
          if (entry.approval_status === 'pending') {
            setPendingApprovals(prev => [entry, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gate_entries',
          filter: `unit_id=eq.${unitId}`
        },
        (payload) => {
          const updated = payload.new as GateEntry;
          setPendingApprovals(prev => prev.filter(e => e.id !== updated.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId]);

  const handleResidentDecision = async (entryId: string, decision: 'approved' | 'denied') => {
    try {
      await supabase
        .from('gate_entries')
        .update({
          approval_status: decision,
          approval_channel: 'app_push',
          approval_timestamp: new Date().toISOString()
        })
        .eq('id', entryId);

      setPendingApprovals(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      console.error('Failed to submit approval:', err);
    }
  };

  const handleGeneratePreInvite = () => {
    if (!preInviteName.trim()) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedPassCode(code);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-8 px-4 flex justify-center items-center font-sans select-none antialiased">
      {/* ── PHONE SHELL CONTAINER (Sleek Simulator for Desktop) ── */}
      <div className="w-full max-w-[420px] bg-white rounded-[36px] border-4 border-slate-300 shadow-2xl overflow-hidden flex flex-col min-h-[720px]">
        {/* Status Bar */}
        <div className="h-8 bg-white flex items-center justify-between px-6 pt-2 text-[11px] font-bold text-slate-800">
          <span>9:41</span>
          <div className="w-16 h-4 bg-slate-900 rounded-full mx-auto" />
          <div className="flex items-center space-x-1.5 text-slate-600">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Header Bar */}
        <header className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#006B3F] flex items-center justify-center text-white shadow-md shadow-emerald-950/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900">{towerName} - {flatNumber}</h1>
              <p className="text-[11px] text-slate-500">{residentName}</p>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-emerald-200 text-[10px] text-[#006B3F] font-bold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006B3F] animate-pulse" />
            <span>Gate Connected</span>
          </div>
        </header>

        {/* ── VISITOR PENDING ALERT (If visitor at gate) ── */}
        {pendingApprovals.length > 0 && (
          <div className="p-4 bg-amber-50/80 border-b border-amber-200 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-amber-800 font-extrabold text-[11px] uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>Visitor Waiting at Main Gate</span>
            </div>

            {pendingApprovals.map((entry) => (
              <div key={entry.id} className="p-3.5 rounded-2xl bg-white border border-amber-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{entry.visitor_name}</h3>
                    <p className="text-[11px] text-slate-500">
                      {entry.company_name} • Gate: {entry.entry_gate_name}
                    </p>
                  </div>
                  {entry.vehicle_number && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                      {entry.vehicle_number}
                    </span>
                  )}
                </div>

                {/* 2 Big Thumb Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => handleResidentDecision(entry.id, 'denied')}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>DENY</span>
                  </button>

                  <button
                    onClick={() => handleResidentDecision(entry.id, 'approved')}
                    className="py-2.5 rounded-xl bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-950/20 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ALLOW ENTRY</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB SELECTOR ── */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex space-x-2">
          {[
            { id: 'approvals', label: 'Activity Logs' },
            { id: 'pre_invite', label: 'Pre-Invite' },
            { id: 'daily_help', label: 'Daily Staff' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? 'bg-[#006B3F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="p-4 flex-1 space-y-4 overflow-y-auto">
          {activeTab === 'pre_invite' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h2 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <QrCode className="w-4 h-4 text-[#006B3F]" />
                <span>Create Guest Entry Passcode</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Guests can show this 6-digit code at the gate for automatic approval without calling you.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Guest Name</label>
                <input
                  type="text"
                  value={preInviteName}
                  onChange={(e) => setPreInviteName(e.target.value)}
                  placeholder="e.g. Anand Sharma"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006B3F]"
                />
              </div>

              <button
                onClick={handleGeneratePreInvite}
                className="w-full py-2.5 bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                GENERATE GATE PASS
              </button>

              {generatedPassCode && (
                <div className="p-3 bg-[#F0FDF4] border border-emerald-300 rounded-xl text-center space-y-1.5 mt-2">
                  <span className="text-[10px] font-bold text-[#006B3F] uppercase">Passcode</span>
                  <div className="font-mono text-2xl font-black text-slate-900 tracking-widest">
                    {generatedPassCode}
                  </div>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Gate Pass for Flat ${flatNumber}`,
                          text: `Hi ${preInviteName}, use Passcode ${generatedPassCode} at security gate.`
                        });
                      } else {
                        alert(`Passcode: ${generatedPassCode}`);
                      }
                    }}
                    className="w-full py-1.5 bg-[#006B3F] text-white font-bold text-[11px] rounded-lg flex items-center justify-center space-x-1"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Share on WhatsApp</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'daily_help' && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-[#006B3F]" />
                <span>Household Domestic Staff</span>
              </h2>
              {householdStaff.map((staff) => (
                <div key={staff.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xl">{staff.role === 'Maid' ? '🧹' : '🚗'}</span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{staff.name}</h4>
                      <p className="text-[10px] text-slate-500">{staff.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    staff.status === 'inside'
                      ? 'bg-[#F0FDF4] border border-emerald-300 text-[#006B3F]'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {staff.status === 'inside' ? 'Inside Society' : 'Outside'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-[#006B3F]" />
                <span>Recent Visitors</span>
              </h2>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No recent entries in past 24 hours.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResidentGatePassView;
