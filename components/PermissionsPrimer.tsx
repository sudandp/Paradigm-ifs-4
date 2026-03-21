import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import Logo from './ui/Logo';
import { checkRequiredPermissions, requestAllPermissions } from '../utils/permissionUtils';
import { ShieldCheck, AlertCircle, Settings, Camera, MapPin, Bell, CheckCircle2, Smartphone, Share } from 'lucide-react';

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
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);

  const permissionList = [
    { id: 'Notifications', icon: Bell, label: 'Push Notifications' },
    { id: 'Camera', icon: Camera, label: 'Camera Access' },
    { id: 'Location', icon: MapPin, label: 'Location Services' },
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
    
    if (allGranted && missing.length === 0) {
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
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    setIsMobileBrowser(isMobileUA && !isStandaloneMode && !Capacitor.isNativePlatform());
    setIsIOSBrowser(isIOS && !isStandaloneMode && !Capacitor.isNativePlatform());

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="animate-pulse mb-8">
          <Logo className="h-16" />
        </div>
        <div className="text-gray-500 font-medium">{statusMessage}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100">
        <div className="mb-6 flex justify-center">
          <div className={`${missingPermissions.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'} p-4 rounded-full`}>
             <ShieldCheck className={`h-12 w-12 ${missingPermissions.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isRequesting ? 'Security Bridge Active' : 'Compliance Check'}
        </h2>
        
        <p className="text-gray-500 text-xs mb-6 px-4">
          Paradigm IFS requires these <span className="text-emerald-600 font-bold">3 primary categories</span> to be <span className="text-emerald-600 font-bold">Allowed</span> to operate.
        </p>

        <div className="mb-8 text-left space-y-2">
          {permissionList.map((p) => {
            const isMissing = missingPermissions.includes(p.id);
            const isActive = currentRequesting === p.id;

            return (
              <div 
                key={p.id} 
                className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-emerald-600 border-emerald-600 shadow-lg scale-[1.02] ring-2 ring-emerald-100' 
                    : isMissing 
                      ? 'bg-gray-50 border border-transparent' 
                      : 'bg-emerald-50/50 border border-emerald-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white text-emerald-600'
                      : isMissing 
                        ? 'bg-white text-gray-300' 
                        : 'bg-white text-emerald-600 shadow-sm'
                  }`}>
                    {isActive ? (
                        <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <p.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-[13px] font-semibold transition-colors ${
                    isActive
                      ? 'text-white'
                      : isMissing 
                        ? 'text-gray-500' 
                        : 'text-emerald-800'
                  }`}>
                    {p.id === 'Notifications' && isIOSBrowser ? (
                        <span className="text-[11px] leading-tight">Requires Home Screen App</span>
                    ) : p.label}
                  </span>
                </div>
                {isActive ? (
                   <span className="text-[10px] font-bold text-emerald-50 animate-pulse uppercase">Waiting...</span>
                ) : isMissing ? (
                   isIOSBrowser && p.id === 'Notifications' ? (
                     <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100/50 rounded-full">
                       <AlertCircle className="h-3 w-3 text-amber-600" />
                       <span className="text-[9px] font-bold text-amber-700 uppercase">PWA Only</span>
                     </div>
                   ) : (
                     <AlertCircle className="h-4 w-4 text-amber-500" />
                   )
                ) : (
                   <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>
            );
          })}
        </div>

        {isMobileBrowser && (
          <div className="mb-6 p-4 bg-emerald-900 rounded-2xl text-left border border-emerald-800 shadow-inner">
             <div className="flex items-start gap-3">
               <div className="bg-emerald-800 p-2 rounded-lg mt-1">
                 <Smartphone className="h-4 w-4 text-emerald-400" />
               </div>
               <div>
                 <h3 className="text-[13px] font-bold text-white mb-1">Native App Experience</h3>
                 <p className="text-[11px] text-emerald-300 leading-relaxed">
                   To hide the browser bar and get a full-screen experience, tap <span className="text-white font-bold inline-flex items-center gap-1 mx-0.5"><Share className="h-3 w-3" /> (Share)</span> then <span className="text-white font-bold">"Add to Home Screen"</span>.
                 </p>
               </div>
             </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleStartSetup}
            disabled={isRequesting}
            className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg ${
              isRequesting 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-emerald-200'
            }`}
          >
            {isRequesting ? 'Respond to pop-ups...' : 'Grant All Permissions'}
          </button>

          {missingPermissions.length > 0 && !isRequesting && (
            <button
              onClick={handleOpenSettings}
              className="w-full py-3 rounded-2xl text-sm font-bold text-gray-400 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manual Settings
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-400 mt-6 leading-relaxed uppercase tracking-[0.1em] font-bold">
          Required for App Operation
        </p>
      </div>
    </div>
  );
};

export default PermissionsPrimer;
