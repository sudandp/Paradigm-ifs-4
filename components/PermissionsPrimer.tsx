import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import Logo from './ui/Logo';
import { checkRequiredPermissions, requestAllPermissions } from '../utils/permissionUtils';
import { ShieldCheck, AlertCircle, Settings, Camera, MapPin, Bell, CheckCircle2, Smartphone, Share, Users, Bluetooth, Image, Music } from 'lucide-react';

interface PermissionsPrimerProps {
  onComplete: () => void;
}

const PermissionsPrimer: React.FC<PermissionsPrimerProps> = ({ onComplete }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [missingPermissions, setMissingPermissions] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('Verifying security requirements...');
  const [currentRequesting, setCurrentRequesting] = useState<string>('');
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  const permissionList = [
    { id: 'Camera', icon: Camera, label: 'Camera Access' },
    { id: 'Location', icon: MapPin, label: 'Location Services' },
    { id: 'Notifications', icon: Bell, label: 'Push Notifications' },
    { id: 'Contacts', icon: Users, label: 'Contacts' },
    { id: 'Bluetooth', icon: Bluetooth, label: 'Nearby Devices' },
    { id: 'Photos/Videos', icon: Image, label: 'Photos & Videos' },
    { id: 'Music', icon: Music, label: 'Music & Audio' },
  ];

  const verifyPermissions = async () => {
    setIsChecking(true);
    setStatusMessage('Connecting to security bridge...');
    
    // Defensive wait: check if Capacitor is ready. On some Android devices,
    // the bridge injection might be delayed.
    let retryCount = 0;
    while (!Capacitor.isNativePlatform() && retryCount < 5) {
      const isAndroidUA = /Android/i.test(navigator.userAgent);
      if (!isAndroidUA) break; // If not even a mobile UA, don't wait indefinitely
      
      console.warn(`[PermissionsPrimer] Bridge not ready, retrying... (${retryCount + 1}/5)`);
      await new Promise(r => setTimeout(r, 800));
      retryCount++;
    }

    setStatusMessage('Verifying status...');
    const { allGranted, missing } = await checkRequiredPermissions();
    setMissingPermissions(missing);
    setIsChecking(false);
    
    if (allGranted) {
      setStatusMessage('Security check passed!');
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  useEffect(() => {
    // Check if running in standalone mode (PWA)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || document.referrer.includes('android-app://');
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobileBrowser(isMobileUA && !isStandaloneMode && !Capacitor.isNativePlatform());

    // Hide splash screen immediately so it doesn't cover system dialogs
    SplashScreen.hide().catch(() => {});
    
    // Start verification
    verifyPermissions();
  }, []);

  const handleStartSetup = async () => {
    setIsRequesting(true);
    setStatusMessage('Preparing security modules...');
    
    await requestAllPermissions((id) => {
        setCurrentRequesting(id);
        if (id) {
            setStatusMessage(`Requesting ${id}...`);
        }
    });

    setCurrentRequesting('');
    setIsRequesting(false);
    await verifyPermissions();
  };

  const handleOpenSettings = () => {
    if (!Capacitor.isNativePlatform()) {
      alert('To manage permissions on Web:\n1. Click the lock/info icon in the browser address bar.\n2. Ensure "Notifications" is set to "Allow".\n3. Reload the page.');
      return;
    }

    const permissions = (window as any).plugins?.permissions;
    if (permissions) {
      permissions.openSettings();
    }
  };

  if (isChecking && missingPermissions.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white p-6 text-center" style={{ backgroundColor: '#ffffff' }}>
        <div className="animate-pulse mb-8">
          <Logo className="h-16" />
        </div>
        <div className="text-gray-500 font-medium">{statusMessage}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-200/50 sm:p-6 text-center overflow-auto" style={{ backgroundColor: Capacitor.isNativePlatform() ? 'transparent' : 'rgba(243, 244, 246, 0.5)' }}>
      {/* Immersive Mobile Content (White) / Centered Desktop Card */}
      {/* We use inline background color #ffffff to bypass global dark mode CSS overrides with !important */}
      <div 
        className="bg-white sm:rounded-[40px] shadow-2xl sm:max-w-md w-full h-full sm:h-auto min-h-screen sm:min-h-0 flex flex-col items-center p-8 sm:p-10 border-none sm:border border-gray-100 overflow-y-auto"
        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
      >
        
        {/* Top Content Area */}
        <div className="w-full flex-1 flex flex-col items-center">
          {/* Logo */}
          <div className="mb-14 mt-4 text-center">
            <Logo className="h-14 mx-auto" />
          </div>

          {/* Shield Icon */}
          <div className="mb-10">
            <div className="bg-orange-50 p-6 rounded-full inline-flex" style={{ backgroundColor: '#fff7ed' }}>
               <ShieldCheck className="h-16 w-16 text-orange-500" />
            </div>
          </div>

          {/* Title & Desc */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ color: '#0f172a' }}>
            Compliance Check
          </h2>
          
          <p className="text-gray-400 text-[14px] leading-relaxed mb-10 px-6" style={{ color: '#9ca3af' }}>
            Paradigm IFS requires these <span className="text-emerald-600 font-bold" style={{ color: '#059669' }}>7 primary categories</span> to<br className="hidden sm:inline" /> be <span className="text-emerald-600 font-bold" style={{ color: '#059669' }}>Allowed</span> to operate effectively.
          </p>

          {/* Permission Items */}
          <div className="w-full space-y-4 mb-10">
            {permissionList.map((p) => {
              const isMissing = missingPermissions.includes(p.id);
              const isActive = currentRequesting === p.id;

              return (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between gap-4 p-5 rounded-3xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-emerald-50 border border-emerald-100 ring-2 ring-emerald-500/10' 
                      : 'bg-gray-50 border border-gray-100'
                  }`}
                  style={{ backgroundColor: isActive ? '#ecfdf5' : '#f9fafb', borderColor: isActive ? '#d1fae5' : '#f3f4f6' }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className={`p-3 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-600 text-white' : 'bg-white text-gray-300 shadow-sm'}`}
                      style={{ backgroundColor: isActive ? '#059669' : '#ffffff', color: isActive ? '#ffffff' : '#d1d5db' }}
                    >
                      <div className="relative h-6 w-6 flex items-center justify-center">
                        <p.icon className={`h-6 w-6 ${isActive ? 'opacity-40' : ''}`} />
                        {isActive && (
                          <div className="absolute inset-0 h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[15px] font-bold" style={{ color: isMissing ? '#9ca3af' : '#374151' }}>
                            {p.id === 'Notifications' && !Capacitor.isNativePlatform() ? (
                                <span className="text-[13px] leading-tight">Push Notifications (Web)</span>
                            ) : p.label}
                        </span>
                        {isMissing && !Capacitor.isNativePlatform() && p.id === 'Notifications' && (
                             <span className="text-[11px] text-amber-600 font-medium" style={{ color: '#d97706' }}>Non-blocking for Web Mode</span>
                        )}
                    </div>
                  </div>
                  
                  {isActive ? (
                     <span className="text-[10px] font-bold text-emerald-600 animate-pulse uppercase tracking-widest" style={{ color: '#059669' }}>Active</span>
                  ) : isMissing ? (
                     !Capacitor.isNativePlatform() && p.id === 'Notifications' ? (
                       <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-100" style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7' }}>
                         <AlertCircle className="h-4 w-4 text-amber-500" />
                         <span className="text-[11px] font-bold text-amber-600 uppercase" style={{ color: '#d97706' }}>WEB</span>
                       </div>
                     ) : (
                       <AlertCircle className="h-5 w-5 text-amber-500" />
                     )
                  ) : (
                     <CheckCircle2 className="h-6 w-6 text-emerald-500" style={{ color: '#10b981' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* PWA Prompt inside card */}
          {isMobileBrowser && (
            <div className="w-full mb-10 p-5 bg-emerald-900 rounded-3xl text-left shadow-lg" style={{ backgroundColor: '#064e3b' }}>
               <div className="flex items-start gap-4">
                 <div className="p-2.5 rounded-xl mt-1" style={{ backgroundColor: '#065f46' }}>
                   <Smartphone className="h-5 w-5 text-emerald-400" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-white mb-1.5 leading-tight" style={{ color: '#ffffff' }}>Native Full Screen Experience</h3>
                   <p className="text-[12px] text-emerald-100/70 leading-relaxed" style={{ color: 'rgba(209, 250, 229, 0.7)' }}>
                     To hide browser bar, tap <span className="text-emerald-300 font-bold inline-flex items-center gap-1 mx-0.5" style={{ color: '#6ee7b7' }}><Share className="h-3.5 w-3.5" /> (Share)</span> then <span className="text-white font-bold" style={{ color: '#ffffff' }}>"Add to Home Screen"</span>.
                   </p>
                 </div>
               </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Area */}
        <div className="w-full space-y-6 pt-2 pb-6">
          <button
            onClick={handleStartSetup}
            disabled={isRequesting}
            className={`w-full py-5 rounded-[22px] font-bold transition-all text-lg shadow-xl ${
              isRequesting 
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
            }`}
            style={{ 
                backgroundColor: isRequesting ? '#f3f4f6' : '#059669', 
                color: isRequesting ? '#d1d5db' : '#ffffff',
                boxShadow: isRequesting ? 'none' : '0 20px 25px -5px rgba(16, 185, 129, 0.2)' 
            }}
          >
            {isRequesting ? 'Respond to system prompts...' : 'Grant All Permissions'}
          </button>

          <button
            onClick={handleOpenSettings}
            className="w-full py-2 flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
            style={{ color: '#9ca3af' }}
          >
            <Settings className="h-4 w-4" />
            Manual Security Settings
          </button>

          <p className="text-[10px] text-gray-300 text-center leading-relaxed uppercase tracking-[0.2em] font-bold mt-4" style={{ color: '#d1d5db' }}>
            PROTOCOL V2.1 • REQUIRED FOR SECURE OPERATION
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPrimer;
