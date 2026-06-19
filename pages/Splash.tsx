import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import Logo from '../components/ui/Logo';
import PermissionsPrimer from '../components/PermissionsPrimer';
import { checkRequiredPermissions } from '../utils/permissionUtils';

/** Returns true when running as an iOS Add-to-Home-Screen PWA. */
const isIosStandalonePWA = (): boolean => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isIOS && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
};

interface SplashProps {
  onComplete: () => void;
}

const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isNative = Capacitor.isNativePlatform();

  const [showPrimer, setShowPrimer] = React.useState<'pending' | 'show' | 'skip'>('pending');

  useEffect(() => {
    // Web browsers: skip permission checks — not required on web.
    // The LoadingScreen component (rendered by App.tsx) handles the visual.
    if (!isNative) {
      onCompleteRef.current();
      return;
    }

    const initializePermissions = async () => {
      // iOS Standalone PWA: Permissions API is unreliable — skip primer.
      if (isIosStandalonePWA()) {
        console.log('[Splash] iOS standalone PWA — skipping permission primer.');
        const timer = setTimeout(() => { onCompleteRef.current(); }, 1800);
        return () => clearTimeout(timer);
      }

      const { allGranted } = await checkRequiredPermissions();

      if (!allGranted) {
        setShowPrimer('show');
      } else {
        setShowPrimer('skip');
        const timer = setTimeout(() => { onCompleteRef.current(); }, 2200);
        return () => clearTimeout(timer);
      }
    };

    initializePermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web: render nothing — onComplete() already fired above
  if (!isNative) return null;

  // Native: permission primer
  if (showPrimer === 'show') {
    return <PermissionsPrimer onComplete={() => onCompleteRef.current()} />;
  }

  // Native: dark brand splash
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#041b0f]">
      <style>{`
        @keyframes sn-prog {
          0% { width: 0%; }
          60% { width: 75%; }
          85% { width: 90%; }
          100% { width: 100%; }
        }
      `}</style>
      <div className="animate-fade-in text-center flex flex-col items-center gap-6">
        <Logo className="h-16 w-auto mx-auto" />
        <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-emerald-500 rounded-full" style={{ animation: 'sn-prog 2.2s ease forwards' }} />
        </div>
        <p className="text-white/40 font-bold uppercase tracking-[0.2em] animate-pulse text-[10px] text-center">
          Initializing system...
        </p>
      </div>
    </div>
  );
};

export default Splash;
