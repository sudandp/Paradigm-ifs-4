import React, { useState, useRef, useEffect } from 'react';
import { KeyRound, ShieldCheck, Phone, Home, User, X, Clock, RefreshCw, CheckCircle2, ChevronUp, AlertCircle, Wrench } from 'lucide-react';
import type { OpsTicket } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';

interface TechnicianMobileOtpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketResolved?: () => void;
}

export const TechnicianMobileOtpSheet: React.FC<TechnicianMobileOtpSheetProps> = ({
  isOpen,
  onClose,
  onTicketResolved
}) => {
  const { tickets, requestClosureOtp, verifyClosureOtp } = useOpsStore();

  // Find active in-progress or open tickets
  const activeTickets = tickets.filter(t => t.status === 'In Progress' || t.status === 'Open');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (activeTickets.length > 0 && !selectedTicketId) {
      setSelectedTicketId(activeTickets[0].id);
    }
  }, [activeTickets, selectedTicketId]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setStatusMsg(null);
      setDemoCode(null);
      setOtpSent(false);
    }
  }, [isOpen, selectedTicketId]);

  if (!isOpen) return null;

  const currentTicket = activeTickets.find(t => t.id === selectedTicketId);

  const handleSendOtp = async () => {
    if (!currentTicket) return;
    setIsRequesting(true);
    setStatusMsg(null);
    try {
      const res = await requestClosureOtp(currentTicket.id);
      setOtpSent(true);
      setDemoCode(res.demoOtp);
      setStatusMsg({ text: 'OTP sent to resident phone', type: 'success' });
      setTimeout(() => inputRefs[0].current?.focus(), 150);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to dispatch OTP', type: 'error' });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const nextDigits = [...digits];
    nextDigits[index] = val.slice(-1);
    setDigits(nextDigits);

    if (val && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const fullOtp = digits.join('');

  const handleVerify = async () => {
    if (!currentTicket || fullOtp.length < 4) return;
    setIsVerifying(true);
    setStatusMsg(null);
    try {
      await verifyClosureOtp(currentTicket.id, fullOtp);
      setStatusMsg({ text: 'Verified! Work order marked Resolved.', type: 'success' });
      setTimeout(() => {
        onTicketResolved?.();
        onClose();
      }, 1100);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Invalid OTP entered', type: 'error' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Top Handle / Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400">Technician Fast-Close</h3>
              <p className="text-[11px] text-slate-300">Collect 4-Digit Resident OTP</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {activeTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-gray-800">No Pending Work Orders</p>
              <p className="text-gray-500 mt-1">All assigned tickets are currently resolved or closed.</p>
            </div>
          ) : (
            <>
              {/* Select Ticket Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Select Active Work Order
                </label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {activeTickets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.ticketNumber} • {t.unitNumber || 'Unit'} • {t.title.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Ticket Details Card */}
              {currentTicket && (
                <div className="p-3 bg-slate-50 border border-gray-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 text-xs">{currentTicket.ticketNumber}</span>
                    <span className="font-bold text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {currentTicket.priority} Priority
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-xs">{currentTicket.title}</h4>
                  <div className="flex items-center gap-3 text-gray-500 text-[11px] pt-1">
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Home className="w-3.5 h-3.5 text-gray-400" />
                      {currentTicket.unitNumber || 'Common Area'}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {currentTicket.residentName || 'Resident'}
                    </span>
                    {currentTicket.residentPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {currentTicket.residentPhone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Status Message */}
              {statusMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMsg.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {/* OTP Action Area */}
              {!otpSent ? (
                <button
                  onClick={handleSendOtp}
                  disabled={isRequesting || !currentTicket}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
                >
                  {isRequesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 text-emerald-400" />}
                  Request 4-Digit Resident OTP
                </button>
              ) : (
                <div className="space-y-4">
                  {demoCode && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                      <span className="text-[11px] font-medium">Resident OTP:</span>
                      <span className="font-mono font-black text-sm tracking-widest bg-blue-100 px-2 py-0.5 rounded">
                        {demoCode}
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-2">
                      Enter Resident's 4 Digits
                    </label>
                    <div className="flex justify-center gap-2.5">
                      {digits.map((d, i) => (
                        <input
                          key={i}
                          ref={inputRefs[i]}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleDigitChange(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          className="w-12 h-14 text-center font-mono font-bold text-2xl bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={isVerifying || fullOtp.length < 4}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Confirm OTP & Complete Ticket
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
