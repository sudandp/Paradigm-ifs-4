import React, { useState, useRef, useEffect } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, Phone, Home, User, Clock, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { OpsTicket } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';

interface ClosureOtpModalProps {
  ticket: OpsTicket;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClosureOtpModal: React.FC<ClosureOtpModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { requestClosureOtp, verifyClosureOtp, adminOverrideClosure } = useOpsStore();

  const [mode, setMode] = useState<'otp' | 'override'>('otp');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Override form
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setErrorMessage(null);
      setSuccessMessage(null);
      setDemoCode(null);
      setOtpSent(false);
      setOverrideReason('');
      setMode('otp');
    }
  }, [isOpen, ticket.id]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setIsRequestingOtp(true);
    setErrorMessage(null);
    try {
      const res = await requestClosureOtp(ticket.id);
      setOtpSent(true);
      setDemoCode(res.demoOtp);
      setSuccessMessage('OTP sent to resident via SMS/Notification');
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch closure OTP');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    // Take the last character typed
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setErrorMessage(null);

    // Auto-advance
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().slice(0, 4);
    if (/^\d{4}$/.test(pasteData)) {
      setDigits(pasteData.split(''));
      inputRefs[3].current?.focus();
    }
  };

  const fullOtp = digits.join('');

  const handleVerify = async () => {
    if (fullOtp.length < 4) {
      setErrorMessage('Please enter the full 4-digit OTP provided by the resident');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    try {
      await verifyClosureOtp(ticket.id, fullOtp);
      setSuccessMessage('Closure verified successfully! Ticket marked Resolved.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminOverride = async () => {
    if (!overrideReason || overrideReason.trim().length < 5) {
      setErrorMessage('Please provide a valid reason (min 5 characters) for the audit log');
      return;
    }

    setIsOverriding(true);
    setErrorMessage(null);
    try {
      await adminOverrideClosure(ticket.id, overrideReason.trim());
      setSuccessMessage('Admin override executed. Ticket marked Resolved with audit entry.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Admin override failed');
    } finally {
      setIsOverriding(false);
    }
  };

  const residentName = ticket.residentName || ticket.reportedByName || 'Resident';
  const unitNumber = ticket.unitNumber || 'Assigned Flat/Villa';
  const residentPhone = ticket.residentPhone || ticket.reportedByPhone || '+91 ••••• •••••';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Resident Closure Verification</h3>
              <p className="text-[11px] text-slate-300">Tamper-Proof Anti-Self-Closure Protocol</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resident & Ticket Context Badge */}
        <div className="px-6 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-gray-800">
              <Home className="w-3.5 h-3.5 text-gray-500" />
              <span>{unitNumber}</span>
              <span className="text-gray-300">•</span>
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>{residentName}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500 text-[11px]">
              <Phone className="w-3 h-3" />
              <span>{residentPhone}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono font-bold text-slate-700 bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px]">
              {ticket.ticketNumber || ticket.id.slice(0, 8)}
            </span>
            <p className="text-[10px] text-gray-500 mt-0.5 max-w-[120px] truncate">{ticket.title}</p>
          </div>
        </div>

        {/* Tab switch: Resident OTP vs Admin Override */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setMode('otp')}
            className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'otp'
                ? 'border-b-2 border-emerald-600 text-emerald-800 bg-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Resident 4-Digit OTP
          </button>
          <button
            onClick={() => setMode('override')}
            className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'override'
                ? 'border-b-2 border-amber-600 text-amber-800 bg-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Manager Override
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'otp' ? (
            <div className="space-y-4 text-center">
              {!otpSent ? (
                <div className="py-4 space-y-3">
                  <p className="text-xs text-gray-600">
                    To prevent unverified resolutions, a 4-digit code must be collected from the resident after completing work on-site.
                  </p>

                  <button
                    onClick={handleSendOtp}
                    disabled={isRequestingOtp}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    {isRequestingOtp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                    )}
                    Generate & Send Resident OTP
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Demo test helper */}
                  {demoCode && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
                      <span className="font-medium text-[11px]">Resident Received OTP:</span>
                      <span className="font-mono font-black text-sm tracking-widest bg-blue-100 px-2 py-0.5 rounded text-blue-900">
                        {demoCode}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Enter 4-Digit Code Given by Resident
                    </label>
                    <div className="flex justify-center gap-3" onPaste={handlePaste}>
                      {digits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={inputRefs[idx]}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          className="w-12 h-14 text-center font-mono font-bold text-2xl bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" /> Valid for 15 min
                    </span>
                    <button
                      onClick={handleSendOtp}
                      disabled={isRequestingOtp}
                      className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRequestingOtp ? 'animate-spin' : ''}`} />
                      Resend OTP
                    </button>
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={isVerifying || fullOtp.length < 4}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    Verify OTP & Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Manager Override Form */
            <div className="space-y-3">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                  Management Exception Log
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Use when resident is unreachable, vacated flat, or emergency common-area repair. This action is permanently stamped in audit logs with your user ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Justification / Operational Reason *
                </label>
                <textarea
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                  rows={3}
                  placeholder="e.g. Resident tenant vacated; checked and approved by Society Manager on-site..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>

              <button
                onClick={handleAdminOverride}
                disabled={isOverriding || overrideReason.trim().length < 5}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isOverriding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Authorize Admin Closure
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
