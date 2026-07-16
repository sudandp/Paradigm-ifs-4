import React, { useState } from 'react';
import { WifiOff, RefreshCw, Smartphone, CloudLightning, CheckCircle2, AlertCircle } from 'lucide-react';
import { Network } from '@capacitor/network';
import { useDevice } from '../../hooks/useDevice';
import { useAuthStore } from '../../store/authStore';
import { api as apiService } from '../../services/api';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useSettingsStore } from '../../store/settingsStore';

const OfflineScreen: React.FC = () => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const { isMobile } = useDevice();
  const setIsOffline = useAuthStore(state => state.setIsOffline);
  const { init: initEnrollmentRules } = useEnrollmentRulesStore();
  const { initRoles } = usePermissionsStore();
  const { initSettings } = useSettingsStore();

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryFailed(false);
    try {
      const status = await Network.getStatus();
      if (!status.connected) {
        setRetryFailed(true);
        return;
      }
      // Reconnected — resync all app data
      const { settings, roles, holidays } = await apiService.getInitialAppData();
      const recurringHolidays = await apiService.getRecurringHolidays();
      if (settings.enrollmentRules) initEnrollmentRules(settings.enrollmentRules);
      if (roles) initRoles(roles);
      if (settings.attendanceSettings && holidays) {
        initSettings({
          holidays,
          attendanceSettings: settings.attendanceSettings,
          recurringHolidays: recurringHolidays || [],
          apiSettings: settings.apiSettings,
          addressSettings: settings.addressSettings,
          geminiApiSettings: settings.geminiApiSettings,
          kycApiSettings: settings.kycApiSettings,
          esignApiSettings: settings.esignApiSettings,
          offlineOcrSettings: settings.offlineOcrSettings,
          perfiosApiSettings: settings.perfiosApiSettings,
          otpSettings: settings.otpSettings,
          siteManagementSettings: settings.siteManagementSettings,
          notificationSettings: settings.notificationSettings,
          voipSettings: settings.voipSettings,
        });
      }
      await useAuthStore.getState().checkAttendanceStatus();
      setIsOffline(false);
    } catch (err) {
      console.warn('[OfflineScreen] Retry failed:', err);
      setRetryFailed(true);
    } finally {
      setIsRetrying(false);
    }
  };

  if (isMobile) {
    // ─── Immersive Android / Mobile Design (High-Fidelity) ───────────────────
    return (
      <div
        className="fixed inset-0 z-[99999] flex flex-col justify-between bg-[#02120a] p-8 select-none text-white overflow-hidden"
        style={{ 
          paddingTop: 'calc(4rem + env(safe-area-inset-top))', 
          paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' 
        }}
      >
        {/* Dynamic background mesh glows */}
        <div className="absolute top-[20%] left-[-10%] w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[100px] animate-pulse delay-1000" />
        
        {/* Radial background grids */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }} />

        {/* Top Branding Header */}
        <div className="flex flex-col items-center justify-center gap-1 opacity-45 relative z-10">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-emerald-400">
            Paradigm Services
          </p>
          <div className="h-[2px] w-8 bg-emerald-500/30 rounded-full" />
        </div>

        {/* Center content (Graphic & Copy) */}
        <div className="flex flex-col items-center text-center px-4 relative z-10">
          {/* Custom Illustrated Icon Anchor */}
          <div className="relative mb-10">
            {/* Outer animated halo rings */}
            <div className="absolute -inset-4 rounded-full border border-emerald-500/10 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
            <div className="absolute -inset-8 rounded-full border border-emerald-400/5 animate-pulse opacity-45" />

            <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-b from-[#0a2f1c] to-[#041a0f] border border-emerald-500/20 flex items-center justify-center shadow-[0_15px_35px_rgba(2,18,10,0.8)] relative">
              <svg className="w-16 h-16 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.05-1.23.15A5.5 5.5 0 0 0 5 13c0 2.21 1.79 4 4 4" />
                <path className="animate-pulse text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" d="m13 14-3 4.5h5l-3 4.5" strokeWidth="1.5" fill="currentColor" />
              </svg>
              {/* Disconnected Badge indicator */}
              <div className="absolute -top-1 -right-1 bg-amber-500 text-[#02120a] rounded-full p-1.5 shadow-md border-2 border-[#02120a]">
                <WifiOff className="w-3.5 h-3.5" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white mb-2 leading-none font-outfit">
            Ooops!
          </h1>
          
          <h2 className="text-emerald-400 font-extrabold text-[11px] uppercase tracking-[0.2em] mb-6">
            Connection Lost
          </h2>

          {/* Frosted Glass Diagnostic card */}
          <div className="w-full max-w-[280px] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl rounded-2xl p-4 text-left flex flex-col gap-2.5 shadow-lg">
            <p className="text-[11px] text-white/50 leading-relaxed font-medium mb-1">
              It seems there is something wrong with your connection. Please verify your mobile data or Wi-Fi settings.
            </p>
            <div className="h-[1px] bg-white/[0.06]" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 flex items-center gap-1.5 font-medium">
                <Smartphone className="w-3.5 h-3.5 opacity-60" /> Device Network
              </span>
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Checked
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 flex items-center gap-1.5 font-medium">
                <CloudLightning className="w-3.5 h-3.5 opacity-60" /> Paradigm Cloud
              </span>
              <span className="text-amber-400 flex items-center gap-1.5 font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Connecting
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Button Action */}
        <div className="w-full flex flex-col items-center relative z-10 px-4">
          {retryFailed && (
            <p className="text-orange-400 text-xs font-semibold mb-4 animate-pulse flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Still offline. Check your internet.
            </p>
          )}

          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full max-w-[320px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50 text-white font-black py-4 px-6 rounded-2xl shadow-[0_12px_24px_rgba(16,185,129,0.2)] transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-emerald-400/20"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking Network...' : 'TRY AGAIN'}
          </button>
          
          <p className="text-white/20 text-[8px] font-bold tracking-widest uppercase mt-8 select-none">
            Paradigm FMS v1.8.0
          </p>
        </div>
      </div>
    );
  }

  // ─── Web / Desktop Design (Refined Editorial Card) ───────────────────────
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-tr from-gray-100 to-emerald-50/20 select-none">
      {/* Editorial background pattern */}
      <div className="absolute inset-0 opacity-[0.2] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, #b1b5bb 1.5px, transparent 1.5px)',
        backgroundSize: '36px 36px',
      }} />

      <div className="relative bg-white/90 backdrop-blur-2xl rounded-[32px] p-12 max-w-lg w-full mx-4 flex flex-col items-center text-center border border-white/60 shadow-[0_30px_80px_rgba(4,27,15,0.06)] animate-in zoom-in-95 duration-300">
        
        {/* Customized illustration circles layout */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-emerald-50/80 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shadow-inner">
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.05-1.23.15A5.5 5.5 0 0 0 5 13c0 2.21 1.79 4 4 4" />
              <path className="text-amber-500 animate-pulse" d="m13 14-3 4.5h5l-3 4.5" strokeWidth="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white p-2 rounded-full shadow-md border border-gray-50 flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-amber-500" strokeWidth={2.25} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Ooops! You're Offline</h1>
        <h2 className="text-[#006b3f] font-black text-xs tracking-[0.15em] uppercase mb-4">
          Service Disconnected
        </h2>

        <p className="text-gray-500 text-sm leading-relaxed px-4 mb-8">
          We couldn't establish a connection with our services. Please check your local network cables or router settings and try again.
        </p>

        {/* Diagnostic checklist panel */}
        <div className="w-full bg-gray-50 rounded-2xl p-5 mb-8 text-left border border-gray-100/80 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-semibold">Local Connection</span>
            <span className="text-[#006b3f] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Active
            </span>
          </div>
          <div className="h-[1px] bg-gray-200/60" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-semibold">Paradigm Cloud Connection</span>
            <span className="text-amber-600 font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Connecting...
            </span>
          </div>
        </div>

        {retryFailed && (
          <p className="text-red-500 text-xs font-semibold mb-4 animate-pulse flex items-center gap-1.5">
            ⚠️ Connection failed. Please verify internet availability.
          </p>
        )}

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full flex items-center justify-center gap-2 bg-[#006b3f] hover:bg-[#005530] active:scale-[0.98] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-950/10 text-sm tracking-wider uppercase border border-emerald-800/10"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'CHECKING...' : 'TRY AGAIN'}
        </button>
      </div>
    </div>
  );
};

export default OfflineScreen;
