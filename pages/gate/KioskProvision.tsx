import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { KioskPlugin } from '../../plugins/KioskPlugin';
import { Capacitor } from '@capacitor/core';
import { 
  UserCheck, 
  LogIn, 
  ArrowRight, 
  Shield, 
  KeyRound, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Clock, 
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { useGateStore } from '../../store/gateStore';

const KioskProvision: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [showKioskSetup, setShowKioskSetup] = useState(false);
  const navigate = useNavigate();
  const { setKioskMode, setKioskSkipped } = useGateStore();

  useEffect(() => {
    // Fetch the correct admin PIN from Supabase config table
    const fetchAdminPin = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('config_value')
          .eq('config_key', 'kiosk_admin_pin')
          .maybeSingle();

        if (!error && data) {
          setAdminPin(data.config_value);
        } else {
          console.warn('[KioskProvision] Could not fetch kiosk_admin_pin. Using fallback 1234');
          setAdminPin('1234'); // Fallback if table doesn't exist
        }
      } catch (err) {
        setAdminPin('1234');
      }
    };
    fetchAdminPin();
  }, []);

  const handleProvision = async () => {
    if (!pin) {
      setError('Please enter the Admin PIN');
      return;
    }

    if (adminPin && pin !== adminPin) {
      setError('Invalid PIN. Please try again.');
      setPin('');
      return;
    }

    setIsLoading(true);
    try {
      // Activate kiosk mode natively (screen-pin the app)
      if (Capacitor.isNativePlatform()) {
        try {
          await KioskPlugin.startLockTask();
        } catch (err) {
          console.warn('[KioskProvision] KioskPlugin.startLockTask failed:', err);
        }
      }
      
      // Update global state
      setKioskMode(true);

      // Navigate directly to the gate interface
      navigate('/gate', { replace: true });
    } catch (err: any) {
      setError('Failed to enable kiosk mode on device.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-gradient-to-b from-[#02130a] via-[#041b0f] to-[#010c06] text-white p-6 overflow-y-auto">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[340px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header Branding */}
      <div className="flex flex-col items-center text-center mt-2 sm:mt-4 mb-2 z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Paradigm Workspace</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Welcome to Paradigm
        </h1>
        <p className="text-emerald-300/70 text-xs sm:text-sm mt-1 max-w-xs">
          Select how you wish to access this device to continue
        </p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4 my-auto z-10">
        {/* HERO CARD: Employee Login (Primary Focus) */}
        <div className="w-full rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-2 border-emerald-500/40 p-6 flex flex-col items-center text-center shadow-2xl shadow-emerald-950/60 backdrop-blur-md relative overflow-hidden group">
          {/* Subtle decorative glow */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />

          {/* Large Hero Icon Badge */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500/25 to-teal-400/20 border border-emerald-400/50 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
            <UserCheck className="w-10 h-10 text-emerald-400" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-400/30 mb-2">
            Primary Access
          </span>

          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Employee Login
          </h2>
          
          <p className="text-emerald-200/70 text-xs sm:text-sm mt-1.5 mb-5 px-1 leading-relaxed">
            Sign in with your employee account to punch in/out, view payslips, and manage daily attendance.
          </p>

          {/* Feature Badges with Icons */}
          <div className="grid grid-cols-3 gap-2 w-full mb-6">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <Clock className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[10px] text-white/80 font-medium">Clock-In</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <Smartphone className="w-4 h-4 text-teal-400 mb-1" />
              <span className="text-[10px] text-white/80 font-medium">Mobile App</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[10px] text-white/80 font-medium">Self Service</span>
            </div>
          </div>

          {/* Prominent Hero CTA Button */}
          <button
            type="button"
            onClick={() => {
              setKioskSkipped(true);
            }}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-base transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3 cursor-pointer group/btn"
          >
            <LogIn className="w-5 h-5 text-slate-950" />
            <span>Continue to Employee Login</span>
            <ArrowRight className="w-5 h-5 text-slate-950 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>

        {/* SECONDARY CARD: Gate Kiosk Setup (Admin / Provisioning) */}
        <div className="w-full rounded-2xl bg-white/[0.03] border border-emerald-500/15 overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setShowKioskSetup(prev => !prev)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-semibold text-white/90 flex items-center gap-2">
                  <span>Gate Kiosk Terminal Setup</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-300/80">Admin</span>
                </div>
                <p className="text-[11px] text-emerald-300/50">
                  Lock device for unattended QR / biometric gate scanning
                </p>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 ml-2">
              {showKioskSetup ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-emerald-400/60" />
              )}
            </div>
          </button>

          {showKioskSetup && (
            <div className="px-4 pb-4 pt-2 border-t border-white/5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[11px] text-emerald-300/60 text-center">
                Enter the 4-digit Admin PIN to lock this device into permanent Kiosk Mode.
              </p>

              <div className="w-full relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError(null);
                  }}
                  placeholder="Admin PIN"
                  className="w-full text-center text-xl tracking-[0.4em] py-3 rounded-xl bg-black/40 border border-emerald-500/20 text-white placeholder-emerald-500/30 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
                />
              </div>

              {error && <p className="text-red-400 text-xs font-semibold text-center">{error}</p>}

              <button
                type="button"
                onClick={handleProvision}
                disabled={isLoading || !adminPin}
                className="w-full py-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Activate Gate Kiosk</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-[10px] text-emerald-400/40 my-2 z-10">
        Paradigm Integrated Facility Services • v4.0
      </div>
    </div>
  );
};

export default KioskProvision;
