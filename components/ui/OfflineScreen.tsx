import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Smartphone, CloudLightning, CheckCircle2, AlertCircle } from 'lucide-react';
import { Network } from '@capacitor/network';
import { useDevice } from '../../hooks/useDevice';
import { useAuthStore } from '../../store/authStore';
import { api as apiService } from '../../services/api';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import Logo from './Logo';

const OfflineScreen: React.FC = () => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { isMobile } = useDevice();
  const setIsOffline = useAuthStore(state => state.setIsOffline);
  const { init: initEnrollmentRules } = useEnrollmentRulesStore();
  const { initRoles } = usePermissionsStore();
  const { initSettings } = useSettingsStore();

  // Mount / Unmount logging + entrance trigger
  useEffect(() => {
    console.log('[FLICKER_DEBUG] OfflineScreen MOUNTED');
    const t = setTimeout(() => setMounted(true), 50);
    return () => {
      clearTimeout(t);
      console.log('[FLICKER_DEBUG] OfflineScreen UNMOUNTED');
    };
  }, []);

  const handleRetry = async () => {
    console.log('[FLICKER_DEBUG] handleRetry started');
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryFailed(false);
    try {
      const status = await Network.getStatus();
      if (!status.connected) {
        setRetryFailed(true);
        setIsRetrying(false);
        return;
      }

      // Active Ping check — Android status.connected can report true without real internet
      try {
        await fetch('https://app.paradigmfms.com/version.json?_=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(4000)
        });
      } catch (pingErr) {
        setRetryFailed(true);
        setIsRetrying(false);
        return;
      }

      // Reconnected — resync all app data
      try {
        const appData = await apiService.getInitialAppData().catch(() => null);
        if (appData) {
          const { settings, roles, holidays } = appData;
          const recurringHolidays = await apiService.getRecurringHolidays().catch(() => []);
          if (settings?.enrollmentRules) initEnrollmentRules(settings.enrollmentRules);
          if (roles) initRoles(roles);
          if (settings?.attendanceSettings && holidays) {
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
        }
        await useAuthStore.getState().checkAttendanceStatus().catch(() => {});
        setIsOffline(false);
      } catch {
        // Even if background sync fails, network is back — remove offline lock
        setIsOffline(false);
      }
    } catch (err) {
      console.warn('[OfflineScreen] Network check error:', err);
      setRetryFailed(true);
    } finally {
      setIsRetrying(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  // Framer-motion variants — used on web; native falls back to CSS keyframe animations
  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 85, damping: 13 },
    },
  };

  if (isDismissed) {
    return (
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto select-none transition-all duration-300"
        style={{
          marginTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] text-white text-xs max-w-[92vw] sm:max-w-md">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-extrabold text-amber-400 uppercase tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap">
              ⚡ Offline Mode
            </span>
          </div>
          <span className="hidden sm:inline text-slate-300 text-[11px] font-medium truncate">
            Saving to local device storage
          </span>
          <button
            onClick={() => setIsDismissed(false)}
            className="flex-shrink-0 ml-auto px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1"
          >
            <WifiOff className="w-3 h-3" />
            <span>Status</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Shared sub-components ───────────────────────────────────────────────────

  // Scoped CSS styles to override global `html.dark` !important rules that turn text white on light background
  const DarkModeOverrideStyles = () => (
    <style>{`
      .offline-screen-root h1.offline-heading-dark {
        color: #0f172a !important;
      }
      .offline-screen-root h1.offline-heading-green,
      .offline-screen-root p.offline-sub-green {
        color: #006b3f !important;
      }
      .offline-screen-root .offline-card-bg {
        background-color: #ffffff !important;
        border-color: rgba(226, 232, 240, 0.9) !important;
      }
      .offline-screen-root .offline-label-text {
        color: #64748b !important;
      }
      .offline-screen-root .offline-[#006b3f]-text {
        color: #006b3f !important;
      }
      @keyframes offlinePulse {
        0%   { transform: scale(0.85); opacity: 0.8; }
        60%  { transform: scale(1.05); opacity: 0.4; }
        100% { transform: scale(1.15); opacity: 0; }
      }
      @keyframes offlineSweep {
        0%, 70% { left: -100%; }
        100%    { left: 150%; }
      }
      @keyframes offlineFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
  );

  // Radar pulse rings behind the cloud card
  const RadarSignal = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
      <div
        className="absolute rounded-full border border-emerald-500/25"
        style={{
          width: 180, height: 180,
          animation: isNative ? 'none' : 'offlinePulse 3s ease-out infinite',
          animationDelay: '0s',
        }}
      />
      <div
        className="absolute rounded-full border border-emerald-500/15"
        style={{
          width: 260, height: 260,
          animation: isNative ? 'none' : 'offlinePulse 3s ease-out infinite',
          animationDelay: '0.6s',
        }}
      />
      <div
        className="absolute rounded-full border border-emerald-500/10"
        style={{
          width: 340, height: 340,
          animation: isNative ? 'none' : 'offlinePulse 3s ease-out infinite',
          animationDelay: '1.2s',
        }}
      />
    </div>
  );

  // Cloud graphic card
  const CloudCard = () => (
    <div
      className="w-36 h-36 rounded-[2.5rem] border border-white/90 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_25px_60px_rgba(0,107,63,0.08)] relative z-10 offline-card-bg"
      style={{ backgroundColor: '#ffffff' }}
    >
      <svg className="w-16 h-16 text-[#006b3f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.05-1.23.15A5.5 5.5 0 0 0 5 13c0 2.21 1.79 4 4 4" />
        <path className="text-amber-500" d="m13 14-3 4.5h5l-3 4.5" strokeWidth="1.5" fill="currentColor" />
      </svg>

      {/* WifiOff badge */}
      {isNative ? (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-2.5 shadow-md border-2 border-white">
          <WifiOff className="w-4 h-4" strokeWidth={2.5} />
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0, rotate: -35 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.25 }}
          className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-2.5 shadow-md border-2 border-white"
        >
          <WifiOff className="w-4 h-4" strokeWidth={2.5} />
        </motion.div>
      )}
    </div>
  );

  // Diagnostics status card
  const DiagnosticsCard = () => (
    <div
      className="w-full max-w-[320px] border rounded-[20px] p-5 text-left flex flex-col gap-4 shadow-lg shadow-emerald-950/5 select-none z-10 offline-card-bg"
      style={{ backgroundColor: '#ffffff', borderColor: 'rgba(226, 232, 240, 0.9)' }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2.5 font-semibold offline-label-text" style={{ color: '#475569' }}>
          <Smartphone className="w-4 h-4 text-emerald-600" /> Local Network
        </span>
        <span className="flex items-center gap-1 font-extrabold" style={{ color: '#006b3f' }}>
          <CheckCircle2 className="w-4 h-4" /> Checked
        </span>
      </div>
      <div className="h-px bg-slate-200/60" />
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2.5 font-semibold offline-label-text" style={{ color: '#475569' }}>
          <CloudLightning className="w-4 h-4 text-amber-600" /> Paradigm Cloud
        </span>
        <span className="flex items-center gap-2 font-extrabold" style={{ color: '#d97706' }}>
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Connecting...
        </span>
      </div>
    </div>
  );

  // Subtle background blobs
  const AnimatedBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-100/60" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-teal-100/60" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, #006b3f 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px',
        }}
      />
    </div>
  );

  // ── Mobile / Small-screen layout ────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[9999999] flex flex-col select-none overflow-hidden font-sans offline-screen-root"
        style={{
          backgroundColor: '#f3faf6',
          color: '#0f172a',
          zIndex: 9999999,
          paddingTop: 'calc(1.25rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          willChange: 'auto',
          animation: mounted ? 'none' : 'offlineFadeIn 0.3s ease forwards',
        }}
      >
        <DarkModeOverrideStyles />
        <AnimatedBackground />

        {/* ── TOP: Branding ────────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center gap-1.5 relative z-10 pb-2"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}
        >
          {/* Responsive logo: scales smoothly with viewport height/width */}
          <Logo
            className="h-[5.5vh] min-h-[38px] max-h-[58px] w-auto max-w-[80vw] mx-auto object-contain"
            variant="bottle-green"
          />
          <div className="h-[2px] w-10 bg-[#006b3f]/25 rounded-full mt-0.5" />
        </div>

        {/* ── CENTER: Cloud graphic + Status text ─────────── */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10 gap-5 py-2">

          {/* Cloud card with radar */}
          <div
            className="relative flex items-center justify-center w-full"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'scale(1)' : 'scale(0.88)',
              transition: 'opacity 0.5s ease 0.1s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s',
            }}
          >
            <RadarSignal />
            <CloudCard />
          </div>

          {/* Headline — explicit inline styles + classes override html.dark rules */}
          <div
            className="flex flex-col items-center gap-1"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.45s ease 0.22s, transform 0.45s ease 0.22s',
            }}
          >
            <h1
              className="text-4xl font-extrabold tracking-tight leading-none font-outfit offline-heading-dark"
              style={{ color: '#0f172a' }}
            >
              Ooops!
            </h1>
            <h1
              className="text-3xl font-extrabold tracking-tight leading-none font-outfit mt-0.5 offline-heading-green"
              style={{ color: '#006b3f' }}
            >
              You're Offline
            </h1>
            <p
              className="font-bold text-[10px] uppercase tracking-[0.2em] mt-1.5 offline-sub-green"
              style={{ color: '#006b3f' }}
            >
              Service Disconnected
            </p>
          </div>

          {/* Diagnostics card */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.45s ease 0.34s, transform 0.45s ease 0.34s',
            }}
          >
            <DiagnosticsCard />
          </div>
        </div>

        {/* ── BOTTOM: Try Again button — ALWAYS VISIBLE ─── */}
        <div
          className="w-full flex flex-col items-center relative z-10 px-5 gap-3"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.4s ease 0.45s, transform 0.4s ease 0.45s',
          }}
        >
          <AnimatePresence>
            {retryFailed && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-amber-600 text-xs font-semibold animate-pulse flex items-center gap-1.5 text-center"
                style={{ color: '#d97706' }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Still offline. Check your internet connection.
              </motion.p>
            )}
          </AnimatePresence>

          <div className="w-full max-w-sm flex flex-row items-center gap-2.5">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 bg-[#006b3f] hover:bg-[#005632] disabled:opacity-50 font-bold py-3.5 px-2.5 rounded-2xl shadow-[0_8px_20px_rgba(0,107,63,0.22)] transition-all duration-200 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-wider border border-[#006b3f]/10 cursor-pointer active:scale-[0.97] relative overflow-hidden"
              style={{ color: '#ffffff', backgroundColor: '#006b3f' }}
            >
              {/* Sweep shimmer */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div
                  className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  style={{ animation: 'offlineSweep 5s ease-in-out infinite' }}
                />
              </div>
              <RefreshCw className={`w-3.5 h-3.5 relative z-10 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="relative z-10 whitespace-nowrap" style={{ color: '#ffffff' }}>
                {isRetrying ? 'Checking…' : 'Try Again'}
              </span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="flex-1 bg-slate-800/90 hover:bg-slate-800 text-slate-200 font-bold py-3.5 px-2.5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-wider border border-slate-700/50 cursor-pointer active:scale-[0.97] shadow-sm whitespace-nowrap"
            >
              <span>⚡ Work Offline</span>
            </button>
          </div>

          <p className="text-[8px] font-bold tracking-widest uppercase select-none mt-1" style={{ color: '#94a3b8' }}>
            Paradigm FMS v1.8.0
          </p>
        </div>
      </div>
    );
  }

  // ── Web / Desktop layout ────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9999999] flex flex-col justify-between select-none overflow-y-auto font-sans offline-screen-root"
      style={{
        backgroundColor: '#f3faf6',
        color: '#0f172a',
        zIndex: 9999999,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <DarkModeOverrideStyles />
      <AnimatedBackground />

      {/* Top Branding Header */}
      <div className="w-full flex items-center justify-between p-6 md:px-16 border-b border-slate-200/50 relative z-10 bg-white/20">
        <div className="flex items-center">
          <Logo className="h-8 md:h-9 w-auto max-w-[240px] object-contain" variant="original" />
        </div>
        <div className="text-[9px] font-bold tracking-widest uppercase font-outfit" style={{ color: '#94a3b8' }}>
          System Portal
        </div>
      </div>

      {/* Main Split Content Panel */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col md:flex-row items-center justify-center gap-16 md:gap-28 px-6 md:px-16 py-12 max-w-6xl w-full mx-auto relative z-10"
      >
        {/* Left Column */}
        <div className="flex-1 flex flex-col items-start text-left max-w-xl">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 bg-[#e6f4ed] border border-[#b2dfc8] rounded-full px-3.5 py-1 mb-6 text-[10px] font-bold uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: '#e6f4ed', borderColor: '#b2dfc8', color: '#006b3f' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Service Status Alert
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 leading-none font-outfit offline-heading-dark"
            style={{ color: '#0f172a' }}
          >
            Ooops! <br />
            <span style={{ color: '#006b3f' }}>You're Offline</span>
          </motion.h1>

          <motion.h2
            variants={itemVariants}
            className="font-extrabold text-[11px] uppercase tracking-[0.2em] mb-4 offline-sub-green"
            style={{ color: '#006b3f' }}
          >
            Service Disconnected
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="text-sm md:text-base leading-relaxed mb-8 max-w-md font-medium"
            style={{ color: '#64748b' }}
          >
            We couldn't establish a secure connection with our servers. Please check your local network cables, Wi-Fi connectivity, or router configuration and try again.
          </motion.p>

          <motion.div variants={itemVariants} className="w-full max-w-lg">
            <AnimatePresence>
              {retryFailed && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-xs font-semibold mb-4 animate-pulse flex items-center gap-1.5"
                  style={{ color: '#d97706' }}
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Still offline. Check your internet access.
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <motion.button
                onClick={handleRetry}
                disabled={isRetrying}
                whileHover={{ scale: 1.02, boxShadow: '0 20px 45px rgba(0, 107, 63, 0.25)' }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 w-full min-h-[48px] bg-[#006b3f] hover:bg-[#005632] disabled:opacity-60 font-bold px-5 py-3.5 rounded-2xl transition-colors duration-200 text-xs tracking-wider uppercase border border-[#006b3f]/10 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden shadow-sm"
                style={{ color: '#ffffff', backgroundColor: '#006b3f' }}
              >
                {/* Shiny sweeping shimmer */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                  <div
                    className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    style={{ animation: 'offlineSweep 5s ease-in-out infinite' }}
                  />
                </div>

                <RefreshCw className={`w-4 h-4 relative z-10 ${isRetrying ? 'animate-spin' : ''}`} />
                <span className="relative z-10 whitespace-nowrap" style={{ color: '#ffffff' }}>
                  {isRetrying ? 'CHECKING...' : 'TRY AGAIN'}
                </span>
              </motion.button>

              <motion.button
                onClick={() => setIsDismissed(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 w-full min-h-[48px] bg-slate-800 hover:bg-slate-900 text-slate-200 font-bold px-5 py-3.5 rounded-2xl transition-all duration-200 text-xs tracking-wider uppercase border border-slate-700/50 flex items-center justify-center gap-2 cursor-pointer shadow-md whitespace-nowrap"
              >
                <span>⚡ Continue Working Offline</span>
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="w-full md:w-auto flex-1 max-w-sm flex flex-col items-center gap-8 relative">
          <motion.div
            variants={itemVariants}
            className="relative flex items-center justify-center w-full min-h-[220px]"
          >
            <RadarSignal />
            <CloudCard />
          </motion.div>
          <motion.div variants={itemVariants} className="w-full flex justify-center">
            <DiagnosticsCard />
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <div
        className="w-full text-center py-6 border-t border-slate-200/50 text-[8px] font-bold tracking-[0.25em] uppercase relative z-10 bg-white/10"
        style={{ color: '#94a3b8' }}
      >
        Paradigm FMS Terminal &bull; All Systems Monitored
      </div>
    </motion.div>
  );
};

export default OfflineScreen;
