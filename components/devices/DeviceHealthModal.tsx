import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Battery,
  Bell,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Smartphone,
  RefreshCw,
  X,
  Sparkles,
  ChevronRight,
  Info,
  Check,
  ArrowRight,
  Zap,
  Sliders
} from 'lucide-react';
import { deviceHealthService, DeviceHealthReport } from '../../services/deviceHealthService';

interface DeviceHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceHealthModal: React.FC<DeviceHealthModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DeviceHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedStep, setCopiedStep] = useState(false);

  const runAudit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deviceHealthService.auditDevice();
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen, runAudit]);

  if (!isOpen) return null;

  const mfg = (report?.manufacturer || 'android').toLowerCase();
  const isSamsung = mfg.includes('samsung');
  const isXiaomi = mfg.includes('xiaomi') || mfg.includes('redmi') || mfg.includes('poco');
  const isVivo = mfg.includes('vivo') || mfg.includes('iqoo');
  const isOppo = mfg.includes('oppo') || mfg.includes('realme') || mfg.includes('oneplus');

  const isOptimal = (report?.reliabilityScore || 0) >= 90;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in transition-all">
      <div 
        className="bg-[#0A3D2E] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-slide-up sm:animate-scale-in text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 bg-[#06241a]">
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Executive Header with Ambient Glow */}
        <div className="bg-gradient-to-br from-[#06241a] via-[#0a3d2e] to-[#0f543f] text-white p-5 sm:p-6 relative overflow-hidden border-b border-white/10">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-teal-400/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/15 shadow-inner">
                  <ShieldCheck className="w-6 h-6 text-emerald-300" />
                </div>
                {isOptimal ? (
                  <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#06241a]"></span>
                  </span>
                ) : (
                  <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border-2 border-[#06241a]"></span>
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                    Device Reliability
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-emerald-200 border border-white/10">
                    Live Audit
                  </span>
                </div>
                <p className="text-xs text-emerald-200/90 mt-0.5">
                  Keep break alarms, GPS pings & approvals instantly active
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-emerald-100 bg-[#072B1F] custom-scrollbar">

          {/* Health Score Summary Card */}
          <div className="p-4 rounded-2xl border border-white/10 bg-[#0C3829] shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center font-black p-2 border transition-all ${
                isOptimal
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-sm shadow-amber-500/10'
              }`}>
                <span className="text-base leading-none font-black">{report?.reliabilityScore ?? '--'}%</span>
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">Score</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-sm sm:text-base">
                    {isOptimal ? 'Background Delivery: Optimal' : 'Optimization Required'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-200/70 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-medium text-white capitalize">
                    {report?.manufacturer} {report?.model}
                  </span>
                  <span className="text-emerald-400/40">•</span>
                  <span>Android {report?.osVersion}</span>
                </div>
              </div>
            </div>

            <button
              onClick={runAudit}
              disabled={loading}
              className="p-2.5 rounded-xl border border-white/10 text-emerald-300 hover:text-white hover:border-emerald-400/40 hover:bg-white/10 active:scale-95 transition-all shrink-0"
              title="Re-run live hardware audit"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* CARD 1: Background & Battery Whitelist (Hero Problem Area) */}
          <div className={`rounded-2xl border transition-all overflow-hidden ${
            report?.batteryWhitelisted
              ? 'border-white/10 bg-[#0C3829] shadow-sm'
              : 'border-amber-400/50 bg-[#0C3829] shadow-md shadow-amber-500/5 ring-1 ring-amber-400/30'
          }`}>
            <div className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    report?.batteryWhitelisted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    <Battery className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm sm:text-base">
                        Background Battery Whitelist
                      </h4>
                      {report?.batteryWhitelisted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> Action Needed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-200/70 mt-1 leading-relaxed">
                      {report?.batteryWhitelisted
                        ? 'Paradigm is whitelisted from OS sleep. Field break alarms & duty timers will ring reliably while phone is locked.'
                        : 'Android Doze mode is active. Your phone will put Paradigm to sleep after a few minutes in pocket or lock screen.'}
                    </p>
                  </div>
                </div>
              </div>

              {!report?.batteryWhitelisted && (
                <div className="space-y-3 pt-1">
                  {/* Step Guide Banner */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-300">
                        Quick 2-Step Configuration:
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 text-xs text-amber-100 font-medium pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/20 font-semibold shadow-2xs text-white">
                          1. Tap "Battery"
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400 text-emerald-200 font-bold shadow-2xs">
                          2. Select "Unrestricted"
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {/* Primary Instant 1-Tap Trigger */}
                    <button
                      onClick={async () => {
                        await deviceHealthService.requestBackgroundAllowance();
                        setTimeout(runAudit, 1500);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#041a13] font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/40 active:scale-[0.98] transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-[#041a13]" />
                      <span>Allow in Background (1-Tap)</span>
                    </button>

                    {/* Direct App Settings */}
                    <button
                      onClick={() => deviceHealthService.openBatterySettings()}
                      className="w-full py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all"
                    >
                      <Sliders className="w-4 h-4 text-emerald-300" />
                      <span>Manage Battery Usage</span>
                      <ExternalLink className="w-3 h-3 text-emerald-300/70" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: Push Notifications & High-Priority Sound */}
          <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-[#0C3829] shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  report?.notificationsGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm sm:text-base">
                      Push Notifications & Sound
                    </h4>
                    {report?.notificationsGranted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Check className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">
                        <XCircle className="w-3 h-3 text-rose-400" /> Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-200/70 mt-1 leading-relaxed">
                    {report?.notificationsGranted
                      ? 'Priority channels active: Approvals, break countdowns, and leave updates ring with sound and heads-up banner.'
                      : 'Push notifications are turned off in system settings. You will miss critical field alerts and approvals.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              <span className="text-[11px] text-emerald-200/70 font-medium">Sound channels, vibration & banners:</span>
              <button
                onClick={() => deviceHealthService.openNotificationSettings()}
                className="py-1.5 px-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Notification Settings</span>
                <ExternalLink className="w-3 h-3 text-emerald-300/70" />
              </button>
            </div>
          </div>

          {/* CARD 3: Phone-Specific Whitelist Guide (Samsung / Xiaomi / Vivo / Oppo) */}
          <div className="rounded-2xl border border-white/10 bg-[#0C3829] overflow-hidden shadow-sm transition-all">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-4 text-left flex items-center justify-between bg-transparent hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-white">
                    {isSamsung ? 'Samsung One UI' : isXiaomi ? 'Xiaomi / MIUI' : isVivo ? 'Vivo / Funtouch' : isOppo ? 'Oppo / ColorOS' : 'Device'} Smart Assist
                  </div>
                  <div className="text-[11px] text-emerald-200/70 mt-0.5">
                    {isSamsung ? 'Prevent Samsung from putting Paradigm to deep sleep' : 'Manufacturer-tailored background setup guide'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                <span>{showGuide ? 'Hide' : 'View Steps'}</span>
                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showGuide ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {showGuide && (
              <div className="p-4 sm:p-5 border-t border-white/10 space-y-3.5 text-xs text-emerald-100 animate-fade-in bg-[#092D21]/95">
                <div className="space-y-2">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    Recommended Steps for {isSamsung ? 'Samsung Galaxy' : 'Your Phone'}:
                  </div>
                  
                  {isSamsung ? (
                    <div className="space-y-2.5 pl-1">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">1</span>
                        <div className="leading-snug">
                          Tap <strong className="text-white font-bold">"Manage Battery Usage"</strong> above to jump straight to Paradigm's App Info.
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">2</span>
                        <div className="leading-snug">
                          Scroll to <strong className="text-white font-bold">"Battery"</strong> and choose <strong className="text-white font-bold">"Unrestricted"</strong>.
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">3</span>
                        <div className="leading-snug">
                          <span className="text-emerald-300/80 font-medium">Prevent Deep Sleep:</span> In phone <strong className="text-white font-bold">Settings &gt; Battery &gt; Background usage limits &gt; Never sleeping apps</strong>, tap <strong className="text-white font-bold">+</strong> and add <strong className="text-white font-bold">Paradigm FMS</strong>.
                        </div>
                      </div>
                    </div>
                  ) : isXiaomi ? (
                    <div className="space-y-2.5 pl-1">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">1</span>
                        <div className="leading-snug">Open <strong className="text-white font-bold">Settings &gt; Apps &gt; Manage apps &gt; Paradigm FMS</strong>.</div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">2</span>
                        <div className="leading-snug">Turn ON <strong className="text-white font-bold">Autostart</strong>.</div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">3</span>
                        <div className="leading-snug">Under <strong className="text-white font-bold">Battery saver</strong>, select <strong className="text-white font-bold">No restrictions</strong>.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pl-1">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">1</span>
                        <div className="leading-snug">Tap <strong className="text-white font-bold">"Manage Battery Usage"</strong> above.</div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">2</span>
                        <div className="leading-snug">Tap <strong className="text-white font-bold">Battery</strong> and select <strong className="text-white font-bold">Unrestricted</strong>.</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => deviceHealthService.openAppSettings()}
                    className="w-full py-2.5 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Open Paradigm App Info Directly</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0A3D2E] flex items-center justify-between gap-3">
          <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Paradigm System Guardian</span>
          </div>
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#041a13] font-black text-xs transition-all shadow-md"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeviceHealthModal;

