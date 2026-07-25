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
  const { isMobile } = useDevice();
  const setIsOffline = useAuthStore(state => state.setIsOffline);
  const { init: initEnrollmentRules } = useEnrollmentRulesStore();
  const { initRoles } = usePermissionsStore();
  const { initSettings } = useSettingsStore();

  // Mount / Unmount logging
  useEffect(() => {
    console.log('[FLICKER_DEBUG] OfflineScreen MOUNTED');
    return () => {
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
      console.log(`[FLICKER_DEBUG] handleRetry Network.getStatus: ${status.connected}`);
      if (!status.connected) {
        console.log('[FLICKER_DEBUG] handleRetry status.connected is false, setting retryFailed');
        setRetryFailed(true);
        setIsRetrying(false);
        return;
      }

      // Active Ping check because Android's status.connected can falsely report true 
      // when connected to a router/network without actual internet access.
      try {
        console.log('[FLICKER_DEBUG] handleRetry starting active ping...');
        await fetch('https://app.paradigmfms.com/version.json?_=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(4000)
        });
        console.log('[FLICKER_DEBUG] handleRetry active ping SUCCESS');
      } catch (pingErr) {
        console.log('[FLICKER_DEBUG] handleRetry active ping FAILED', pingErr);
        setRetryFailed(true);
        setIsRetrying(false);
        return;
      }

      // Reconnected and internet verified — resync all app data safely
      try {
        console.log('[FLICKER_DEBUG] handleRetry syncing data...');
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
        console.log('[FLICKER_DEBUG] Calling setIsOffline(false) from handleRetry success');
        setIsOffline(false);
      } catch (dataErr) {
        console.warn('[OfflineScreen] Resync warning:', dataErr);
        console.log('[FLICKER_DEBUG] Calling setIsOffline(false) from handleRetry catch block');
        // Even if background sync fails, network is connected - remove offline lock
        setIsOffline(false);
      }
    } catch (err) {
      console.warn('[OfflineScreen] Network check error:', err);
      console.log('[FLICKER_DEBUG] handleRetry outer catch block triggered');
      setRetryFailed(true);
    } finally {
      setIsRetrying(false);
    }
  };

  // Entrance animation variants for staggering items
  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 90,
        damping: 14,
      },
    },
  };

  const isNative = Capacitor.isNativePlatform();

  // Sonar radar pulse animation component (Static lightweight GPU rings)
  const RadarSignal = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
      <div className="absolute w-[200px] h-[200px] rounded-full border border-emerald-500/20 bg-emerald-500/[0.01]" />
      <div className="absolute w-[280px] h-[280px] rounded-full border border-emerald-500/15 bg-emerald-500/[0.01]" />
      <div className="absolute w-[360px] h-[360px] rounded-full border border-emerald-500/10 bg-emerald-500/[0.01]" />
    </div>
  );

  // Cloud Card
  const CloudCard = () => (
    <div
      className="w-38 h-38 rounded-[2.5rem] border border-white/90 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_25px_60px_rgba(0,107,63,0.06)] relative z-10"
      style={{ backgroundColor: '#ffffff', opacity: 1 }}
    >
      <svg className="w-18 h-18 text-[#006b3f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.05-1.23.15A5.5 5.5 0 0 0 5 13c0 2.21 1.79 4 4 4" />
        <path className="text-amber-500" d="m13 14-3 4.5h5l-3 4.5" strokeWidth="1.5" fill="currentColor" />
      </svg>
      
      {/* Wifi Off Badge Indicator — static on native to avoid animation overhead */}
      {isNative ? (
        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-2.5 shadow-md border-2 border-white">
          <WifiOff className="w-4 h-4" strokeWidth={2.5} />
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0, rotate: -35 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.2 }}
          className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-2.5 shadow-md border-2 border-white"
        >
          <WifiOff className="w-4 h-4" strokeWidth={2.5} />
        </motion.div>
      )}
    </div>
  );

  // Diagnostics Card
  const DiagnosticsCard = () => (
    <motion.div
      variants={itemVariants}
      className="w-full max-w-[340px] border border-slate-200/80 rounded-[24px] p-6 text-left flex flex-col gap-4.5 shadow-lg shadow-emerald-950/5 select-none z-10"
      style={{ backgroundColor: '#ffffff', opacity: 1 }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-3 font-semibold">
          <Smartphone className="w-4.5 h-4.5 text-emerald-600" /> Local Network
        </span>
        <span className="text-[#006b3f] flex items-center gap-1 font-extrabold">
          <CheckCircle2 className="w-4 h-4" /> Checked
        </span>
      </div>
      <div className="h-[1px] bg-slate-200/50" />
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-3 font-semibold">
          <CloudLightning className="w-4.5 h-4.5 text-amber-600" /> Paradigm Cloud
        </span>
        <span className="text-amber-600 flex items-center gap-2 font-extrabold">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Connecting...</span>
        </span>
      </div>
    </motion.div>
  );

  // Static background with zero filter blur overhead
  const AnimatedBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Soft background gradient circles without blur filters */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-emerald-100/60" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-teal-100/60" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04]" 
        style={{
          backgroundImage: 'radial-gradient(circle, #006b3f 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px',
        }} 
      />
    </div>
  );

  if (isMobile) {
    // On native Android, use a plain div instead of motion.div to prevent
    // framer-motion entrance/exit animations from causing visual flickering
    // when the component rapidly mounts/unmounts during network state changes.
    const Container = isNative ? 'div' : motion.div;
    const containerProps = isNative ? {} : {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3 },
    };

    return (
      <Container
        {...containerProps as any}
        className="fixed inset-0 z-[9999999] flex flex-col justify-between p-6 select-none text-slate-800 overflow-hidden font-sans"
        style={{ 
          backgroundColor: '#f3faf6',
          opacity: 1,
          zIndex: 9999999,
          paddingTop: 'calc(2.5rem + env(safe-area-inset-top))', 
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          willChange: 'auto',
        }}
      >
        <AnimatedBackground />

        {/* Top Header */}
        <div className="flex flex-col items-center justify-center gap-1 relative z-10">
          <Logo className="h-7 w-auto mx-auto" variant="bottle-green" />
          <div className="h-[2px] w-8 bg-[#006b3f]/30 rounded-full mt-1" />
        </div>

        {/* Center content */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center px-2 relative z-10 gap-6"
        >
          <div className="relative flex items-center justify-center w-full">
            <RadarSignal />
            <CloudCard />
          </div>

          <div className="flex flex-col items-center">
            <motion.h1 
              variants={itemVariants} 
              className="text-4xl font-extrabold tracking-tight text-slate-900 mb-1 leading-none font-outfit"
            >
              Ooops!
            </motion.h1>
            <motion.h1 
              variants={itemVariants} 
              className="text-3xl font-extrabold tracking-tight text-[#006b3f] mb-2 leading-none font-outfit"
            >
              You're Offline
            </motion.h1>
            <motion.h2 
              variants={itemVariants} 
              className="text-[#006b3f] font-bold text-[10px] uppercase tracking-[0.2em] mb-2"
            >
              Service Disconnected
            </motion.h2>
          </div>

          <DiagnosticsCard />
        </motion.div>

        {/* Bottom Button Action */}
        <div className="w-full flex flex-col items-center relative z-10 px-2 gap-3">
          <AnimatePresence>
            {retryFailed && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-amber-600 text-xs font-semibold animate-pulse flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" /> Still offline. Check your internet connection.
              </motion.p>
            )}
          </AnimatePresence>

        {/* Mobile: Use a plain button — framer-motion whileHover/whileTap cause 
             continuous JS-driven frame updates on Android WebView */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full max-w-[320px] bg-[#006b3f] hover:bg-[#005632] disabled:opacity-50 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_10px_25px_rgba(0,107,63,0.18)] transition-all duration-200 flex items-center justify-center gap-2.5 text-xs uppercase tracking-wider border border-[#006b3f]/10 cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking Network...' : 'TRY AGAIN'}
          </button>
          
          <p className="text-slate-400 text-[8px] font-bold tracking-widest uppercase select-none">
            Paradigm FMS v1.8.0
          </p>
        </div>
      </Container>
    );
  }

  // ─── Web / Desktop Design (Full-screen Immersive Light Overlay) ──────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9999999] flex flex-col justify-between text-slate-800 select-none overflow-y-auto font-sans"
      style={{ 
        backgroundColor: '#f3faf6', 
        opacity: 1, 
        zIndex: 9999999,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <AnimatedBackground />

      {/* Top Branding Header */}
      <div className="w-full flex items-center justify-between p-6 md:px-16 border-b border-slate-200/50 backdrop-blur-md relative z-10 bg-white/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200/80 flex items-center justify-center shadow-sm">
            <span className="text-[#006b3f] font-black text-sm font-outfit">P</span>
          </div>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#006b3f] font-outfit">
            Paradigm Services
          </p>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase font-outfit">
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
        
        {/* Left Column - Large Warning Editorial */}
        <div className="flex-1 flex flex-col items-start text-left max-w-xl">
          <motion.div 
            variants={itemVariants}
            className="inline-flex items-center gap-2 bg-[#e6f4ed] border border-[#b2dfc8] rounded-full px-3.5 py-1 mb-6 text-[10px] text-[#006b3f] font-bold uppercase tracking-wider shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Service Status Alert
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-950 mb-4 leading-none font-outfit"
          >
            Ooops! <br />
            <span className="text-[#006b3f]">You're Offline</span>
          </motion.h1>

          <motion.h2 
            variants={itemVariants}
            className="text-[#006b3f] font-extrabold text-[11px] uppercase tracking-[0.2em] mb-4"
          >
            Service Disconnected
          </motion.h2>

          <motion.p 
            variants={itemVariants}
            className="text-slate-500 text-sm md:text-base leading-relaxed mb-8 max-w-md font-medium"
          >
            We couldn't establish a secure connection with our servers. Please check your local network cables, Wi-Fi connectivity, or router configuration and try again.
          </motion.p>

          <motion.div variants={itemVariants} className="w-full max-w-sm">
            <AnimatePresence>
              {retryFailed && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-amber-600 text-xs font-semibold mb-4 animate-pulse flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Still offline. Check your internet access.
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleRetry}
              disabled={isRetrying}
              whileHover={{ scale: 1.02, boxShadow: '0 20px 45px rgba(0, 107, 63, 0.25)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-[#006b3f] hover:bg-[#005632] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors duration-200 text-xs tracking-wider uppercase border border-[#006b3f]/10 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden"
            >
              {/* Shiny sweeping light — CSS animation instead of framer-motion repeat:Infinity
                   to avoid continuous JS-driven WebView redraws on Android */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                <div
                  className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  style={{
                    animation: 'offlineSweep 5s ease-in-out infinite',
                  }}
                />
                <style>{`
                  @keyframes offlineSweep {
                    0%, 70% { left: -100%; }
                    100% { left: 150%; }
                  }
                `}</style>
              </div>

              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'CHECKING CONNECTION...' : 'TRY AGAIN'}
            </motion.button>
          </motion.div>
        </div>

        {/* Right Column - Diagnostics & Custom Graphics */}
        <div className="w-full md:w-auto flex-1 max-w-sm flex flex-col items-center gap-8 relative">
          <div className="relative flex items-center justify-center w-full min-h-[220px]">
            <RadarSignal />
            <CloudCard />
          </div>
          <DiagnosticsCard />
        </div>

      </motion.div>

      {/* Bottom Footer Info */}
      <div className="w-full text-center py-6 border-t border-slate-200/50 text-slate-400 text-[8px] font-bold tracking-[0.25em] uppercase relative z-10 bg-white/10">
        Paradigm FMS Terminal &bull; All Systems Monitored
      </div>

    </motion.div>
  );
};

export default OfflineScreen;
