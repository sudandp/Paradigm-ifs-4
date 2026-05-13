import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { KioskPlugin } from '../../plugins/KioskPlugin';
import { Capacitor } from '@capacitor/core';
import { Lock, Shield, Loader2 } from 'lucide-react';
import { useGateStore } from '../../store/gateStore';

const KioskProvision: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminPin, setAdminPin] = useState<string | null>(null);
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
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#041b0f] text-white">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
          <Shield className="w-10 h-10 text-emerald-400" />
        </div>
        
        <h1 className="text-3xl font-bold">Device Provisioning</h1>
        <p className="text-emerald-300/60 text-sm mb-4">
          This device is not yet provisioned. Enter the Admin PIN to activate permanent Kiosk Mode.
        </p>

        <div className="w-full relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500/50" />
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(null);
            }}
            placeholder="Admin PIN"
            className="w-full text-center text-2xl tracking-[0.5em] py-4 rounded-2xl bg-white/5 border border-emerald-500/20 text-white placeholder-emerald-500/30 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}

        <button
          onClick={handleProvision}
          disabled={isLoading || !adminPin}
          className="w-full py-4 mt-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold text-lg transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Activate Kiosk'}
        </button>

        <button
          onClick={() => {
            setKioskSkipped(true);
          }}
          className="w-full py-3 mt-2 rounded-2xl bg-white/5 hover:bg-white/10 text-emerald-400 font-black uppercase tracking-widest text-xs transition-all border border-emerald-500/20"
        >
          Login as Employee
        </button>
      </div>
    </div>
  );
};

export default KioskProvision;
