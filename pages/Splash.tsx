import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Logo from '../components/ui/Logo';
import PermissionsPrimer from '../components/PermissionsPrimer';

interface SplashProps {
  onComplete: () => void;
}

const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [showPrimer, setShowPrimer] = useState(false);
  const isWeb = !Capacitor.isNativePlatform();

  useEffect(() => {
    // Check if we should show the primer on web
    if (isWeb) {
      const permission = (window as any).Notification?.permission;
      if (permission === 'default') {
        // Wait a bit for the splash animation before showing primer
        const primerTimer = setTimeout(() => {
          setShowPrimer(true);
        }, 2000);
        return () => clearTimeout(primerTimer);
      }
    }

    // Default flow: Complete automatically after timeout (for Native or granted Web)
    const timer = setTimeout(() => {
      onComplete();
    }, 2800);

    return () => clearTimeout(timer);
  }, [onComplete, isWeb]);

  if (showPrimer) {
    return <PermissionsPrimer onComplete={onComplete} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="animate-fade-in text-center">
        <Logo className="h-16 w-auto mx-auto" />
      </div>
      <div className="mt-8">
        <div className="h-1 w-48 bg-gray-100 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-emerald-500 animate-loading-bar rounded-full" />
        </div>
      </div>
      <p className="mt-4 text-gray-500 font-medium animate-pulse text-center">
        Initializing system...
      </p>
    </div>
  );
};

export default Splash;
