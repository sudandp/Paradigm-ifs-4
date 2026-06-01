import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Smartphone, Download, QrCode, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConnectedDevice {
  id: string;
  device_name: string;
  last_seen_at: string;
  is_connected: boolean;
  pairing_token: string;
  expires_at: string;
}

export const DeviceSetup: React.FC = () => {
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pairingToken, setPairingToken] = useState<string | null>(null);

  useEffect(() => {
    fetchDeviceStatus();
    
    // Subscribe to realtime updates for this user's devices
    const channel = supabase.channel('device_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connected_devices' }, () => {
        fetchDeviceStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDeviceStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('connected_devices')
        .select('*')
        .eq('hr_user_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setDevice(data || null);
    } catch (err) {
      console.error('Error fetching device:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const token = array[0].toString(36).substring(0, 8).toUpperCase().padStart(8, '0');
      
      // Upsert into connected_devices as disconnected, waiting for agent
      const { error } = await supabase
        .from('connected_devices')
        .upsert({
          hr_user_id: user.id,
          device_name: 'Pending Connection...',
          is_connected: false,
          pairing_token: token,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'hr_user_id' });

      if (error) throw error;
      
      setPairingToken(token);
      fetchDeviceStatus();
    } catch (err) {
      toast.error('Failed to generate pairing token');
    }
  };

  const handleDisconnect = async () => {
    if (!device) return;
    try {
      const { error } = await supabase
        .from('connected_devices')
        .delete()
        .eq('id', device.id);

      if (error) throw error;
      setDevice(null);
      setPairingToken(null);
      toast.success('Device disconnected');
    } catch (err) {
      toast.error('Failed to disconnect device');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mr-2" />
        <span className="text-slate-500 text-sm">Loading device status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-500" />
            Hardware Agent Setup
          </h2>
          <p className="text-sm text-slate-500 mt-1">Connect your Android phone to automatically record and transcribe HR calls.</p>
        </div>
      </div>

      <div className="p-6 space-y-6 bg-slate-50/30">
        {!device ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-slate-800 font-bold mb-2">No device connected</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              To get started, install the Desktop Agent on your computer and plug your Android phone in via USB.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a 
                href={
                  navigator.platform.toUpperCase().indexOf('MAC') >= 0
                    ? (import.meta.env as any).VITE_AGENT_DOWNLOAD_MAC || '#'
                    : (import.meta.env as any).VITE_AGENT_DOWNLOAD_WIN || '#'
                } 
                download
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Agent
              </a>
              <button 
                onClick={handleGenerateToken}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-md"
              >
                <QrCode className="w-4 h-4" />
                Generate Pairing Token
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${device.is_connected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <h4 className="font-bold text-slate-800">{device.device_name || 'Unknown Device'}</h4>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  device.is_connected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  {device.is_connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-500">Last Seen</span>
                  <span className="font-medium text-slate-700">
                    {new Date(device.last_seen_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-500">Token</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    {device.pairing_token}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-500">Expiry</span>
                  {device.expires_at ? (() => {
                    const expiry = new Date(device.expires_at);
                    const isExpiringSoon = (expiry.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;
                    return (
                      <span className={`font-medium ${isExpiringSoon ? 'text-red-600' : 'text-slate-700'}`}>
                        Expires {expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isExpiringSoon && ' (Expiring Soon)'}
                      </span>
                    );
                  })() : <span className="text-slate-500">N/A</span>}
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100">
                <button 
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Device
                </button>
              </div>
            </div>

            {/* Setup Instructions Box */}
            <div className="flex-1 bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 w-full">
              <h4 className="font-bold text-indigo-900 mb-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                Connection Guide
              </h4>
              <ol className="space-y-3 text-sm text-indigo-800/80 list-decimal list-inside marker:text-indigo-400">
                <li>Ensure the Desktop Agent is running.</li>
                <li>Connect your Android phone via USB.</li>
                <li>Enter your Pairing Token in the Agent tray menu.</li>
                <li>When the dot turns green, you're ready to make calls!</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
