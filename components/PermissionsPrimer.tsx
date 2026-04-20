import React, { useState, useEffect, useMemo } from 'react';
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

  const permissionList = useMemo(() => {
    const fullList = [
      { id: 'Camera', icon: Camera, label: 'Camera Access' },
      { id: 'Location', icon: MapPin, label: 'Location Services' },
      { id: 'Notifications', icon: Bell, label: 'Push Notifications' },
      { id: 'Contacts', icon: Users, label: 'Contacts' },
    ];

    if (Capacitor.isNativePlatform()) return fullList;
    
    // For Web, only show the most relevant ones
    return fullList.filter(p => ['Camera', 'Location', 'Notifications'].includes(p.id));
  }, []);

  const verifyPermissions = async () => {
    setIsChecking(true);
    setStatusMessage('Connecting to security bridge...');

    // iOS Standalone PWA fast-path:
    // The Permissions API is unreliable in iOS Safari PWA mode.
    // If we somehow reached PermissionsPrimer on iOS PWA, immediately complete.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandaloneIOS = isIOS && (
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
    if (isStandaloneIOS && !Capacitor.isNativePlatform()) {
      console.log('[PermissionsPrimer] iOS standalone — immediately completing.');
      setIsChecking(false);
      setTimeout(() => { onComplete(); }, 500);
      return;
    }
    
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

  // Auto-trigger setup after 3 seconds if permissions are still missing
  useEffect(() => {
    if (!isChecking && missingPermissions.length > 0 && !isRequesting) {
        const timer = setTimeout(() => {
             console.log('[PermissionsPrimer] Auto-triggering permission requests...');
             handleStartSetup();
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [isChecking, missingPermissions.length, isRequesting]);

  const handleStartSetup = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setStatusMessage('Preparing security modules...');
    
    await requestAllPermissions((id, missing) => {
        setCurrentRequesting(id);
        setMissingPermissions(missing);
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
      <div 
        className={`bg-white sm:rounded-[40px] shadow-2xl w-full h-full sm:h-auto min-h-screen sm:min-h-0 flex flex-col items-center p-8 sm:p-10 border-none sm:border border-gray-100 overflow-y-auto transition-all duration-500 ${
          Capacitor.isNativePlatform() ? 'sm:max-w-md' : 'sm:max-w-md lg:max-w-5xl'
        }`}
        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
      >
        
        <div className={`w-full flex-1 flex flex-col ${Capacitor.isNativePlatform() ? 'items-center' : 'lg:flex-row lg:items-start lg:gap-16'}`}>
          
          {/* Left Column (Logo & Intro) - Static on Native, Flexible on Web */}
          <div className={`${Capacitor.isNativePlatform() ? 'w-full flex flex-col items-center' : 'w-full lg:w-2/5 flex flex-col items-center lg:items-start lg:text-left'}`}>
            {/* Logo */}
            <div className="mb-10 mt-4 lg:mt-8">
              <Logo className="h-14 lg:h-16" />
            </div>

            {/* Shield Icon */}
            <div className="mb-8">
              <div className="bg-orange-50 p-6 lg:p-8 rounded-[35px] inline-flex shadow-inner" style={{ backgroundColor: '#fff7ed' }}>
                 <ShieldCheck className="h-16 w-16 lg:h-20 lg:w-20 text-orange-500" />
              </div>
            </div>

            {/* Title & Desc */}
            <h2 className="text-2xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight" style={{ color: '#0f172a' }}>
              Compliance Check
            </h2>
            
            <p className="text-gray-400 text-[14px] lg:text-[16px] leading-relaxed mb-10 px-6 lg:px-0" style={{ color: '#9ca3af' }}>
              Paradigm IFS requires these <span className="text-emerald-600 font-bold" style={{ color: '#059669' }}>{permissionList.length} primary categories</span> to be <span className="text-emerald-600 font-bold" style={{ color: '#059669' }}>Allowed</span> for secure operations.
            </p>

            {/* PWA Prompt inside left column on Web */}
            {isMobileBrowser && (
              <div className="w-full mb-10 p-5 bg-emerald-900 rounded-3xl text-left shadow-lg" style={{ backgroundColor: '#064e3b' }}>
                 <div className="flex items-start gap-4">
                   <div className="p-2.5 rounded-xl mt-1" style={{ backgroundColor: '#065f46' }}>
                     <Smartphone className="h-5 w-5 text-emerald-400" />
                   </div>
                   <div>
                     <h3 className="text-sm font-bold text-white mb-1.5 leading-tight">Native Experience</h3>
                     <p className="text-[12px] text-emerald-100/70 leading-relaxed">
                       Tap <span className="text-emerald-300 font-bold inline-flex items-center gap-1 mx-0.5"><Share className="h-3.5 w-3.5" /> (Share)</span> then <span className="text-white font-bold">"Add to Home Screen"</span>.
                     </p>
                   </div>
                 </div>
              </div>
            )}
          </div>

          {/* Right Column (List & Actions) */}
          <div className="w-full lg:flex-1 flex flex-col justify-center">
            {/* Permission Items */}
            <div className="w-full space-y-4 mb-8">
              {permissionList.map((p) => {
                const isMissing = missingPermissions.includes(p.id);
                const isActive = currentRequesting === p.id;

                return (
                  <div 
                    key={p.id} 
                    className={`flex items-center justify-between gap-4 p-5 rounded-3xl transition-all duration-300 ${
                      isActive 
                        ? 'bg-emerald-50 border border-emerald-100 ring-4 ring-emerald-500/10' 
                        : 'bg-gray-50 border border-gray-100 hover:bg-gray-100/50'
                    }`}
                    style={{ backgroundColor: isActive ? '#ecfdf5' : '#f9fafb', borderColor: isActive ? '#d1fae5' : '#f3f4f6' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className={`p-3 rounded-full flex items-center justify-center shadow-sm ${isActive ? 'bg-emerald-600 text-white' : 'bg-white text-gray-300'}`}
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
                       <span className="text-[10px] font-bold text-emerald-600 animate-pulse uppercase tracking-[0.2em]" style={{ color: '#059669' }}>Active</span>
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
                       <CheckCircle2 className="h-6 w-6 text-emerald-500 animate-in zoom-in-50 duration-300" style={{ color: '#10b981' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Area */}
            <div className="w-full space-y-5 pt-2">
              <button
                onClick={handleStartSetup}
                disabled={isRequesting}
                className={`w-full py-5 lg:py-6 rounded-[24px] font-bold transition-all text-lg shadow-xl ${
                  isRequesting 
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98] hover:shadow-emerald-500/20'
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
                PROTOCOL V2.2 • SECURE ENVIRONMENT
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPrimer;
