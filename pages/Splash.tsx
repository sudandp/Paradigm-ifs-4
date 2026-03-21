import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Logo from '../components/ui/Logo';
import PermissionsPrimer from '../components/PermissionsPrimer';

import { checkRequiredPermissions } from '../utils/permissionUtils';

interface SplashProps {
  onComplete: () => void;
}

const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [showPrimer, setShowPrimer] = useState(false);

  useEffect(() => {
    const initializePermissions = async () => {
      // Check all required permissions (Camera, Location, Notifications)
      const { allGranted } = await checkRequiredPermissions();
      
      if (!allGranted) {
        // Show the permission bridge if anything is missing
        setShowPrimer(true);
      } else {
        // All set, complete splash after a short animation time
        const timer = setTimeout(() => {
          onComplete();
        }, 2200);
        return () => clearTimeout(timer);
      }
    };

    initializePermissions();
  }, [onComplete]);

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
