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
  // Use a ref so we never re-run the splash init effect when the parent
  // re-renders and recreates the onComplete inline arrow function.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // showPrimer is either 'yes', 'no', or 'pending'
  const [showPrimer, setShowPrimer] = React.useState<'pending' | 'show' | 'skip'>('pending');

  useEffect(() => {
    const initializePermissions = async () => {
      // iOS Standalone PWA fast-path:
      // The Permissions API is unreliable/unsupported on iOS Safari PWA.
      // Showing PermissionsPrimer there causes an infinite loop.
      // Skip directly to app launch — iOS will prompt for permissions on demand.
      if (isIosStandalonePWA()) {
        console.log('[Splash] iOS standalone PWA detected — skipping permission primer.');
        const timer = setTimeout(() => { onCompleteRef.current(); }, 1800);
        return () => clearTimeout(timer);
      }

      // Non-iOS-PWA path: check permissions normally
      const { allGranted } = await checkRequiredPermissions();
      
      if (!allGranted && !Capacitor.isNativePlatform()) {
        // Web browser (non-iOS-PWA): show the permission bridge
        setShowPrimer('show');
      } else if (!allGranted && Capacitor.isNativePlatform()) {
        // Native mobile: show permission primer
        setShowPrimer('show');
      } else {
        // All permissions already granted — skip primer
        setShowPrimer('skip');
        const timer = setTimeout(() => { onCompleteRef.current(); }, 2200);
        return () => clearTimeout(timer);
      }
    };

    initializePermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — only run once on mount

  if (showPrimer === 'show') {
    return <PermissionsPrimer onComplete={() => onCompleteRef.current()} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#041b0f]">
      <div className="animate-fade-in text-center">
        <Logo className="h-16 w-auto mx-auto" />
      </div>
      <div className="mt-8">
        <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-emerald-500 animate-loading-bar rounded-full" />
        </div>
      </div>
      <p className="mt-4 text-white/40 font-bold uppercase tracking-[0.2em] animate-pulse text-[10px] text-center">
        Initializing system...
      </p>
    </div>
  );
};

export default Splash;
