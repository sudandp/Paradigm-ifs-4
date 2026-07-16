import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import Logo from './ui/Logo';
import Button from './ui/Button';
import { checkRequiredPermissions, requestAllPermissions } from '../utils/permissionUtils';
import { ShieldCheck, AlertCircle, Settings, Camera, MapPin, Bell, CheckCircle2, Smartphone, Users, Activity } from 'lucide-react';
import './PermissionsPrimer.css';

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
      { id: 'Physical Activity', icon: Activity, label: 'Physical Activity' },
    ];

    if (Capacitor.isNativePlatform()) return fullList;
    
    // For Web, only show the most relevant ones
    return fullList.filter(p => ['Camera', 'Location', 'Notifications'].includes(p.id));
  }, []);

  const verifyPermissions = async () => {
    setIsChecking(true);
    setStatusMessage('Connecting to security bridge...');

    // iOS Web fast-path:
    // The Permissions API is unreliable in iOS Web (both Safari and PWA).
    // If we reached PermissionsPrimer on iOS Web, immediately complete.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS && !Capacitor.isNativePlatform()) {
      console.log('[PermissionsPrimer] iOS Web — immediately completing.');
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
    <div className="permissions-primer-page">
      <div className="permissions-primer-container">
        
        {/* Header with Logo */}
        <header className="permissions-primer-nav">
          <Logo className="h-9" variant="bottle-green" />
          <div className="permissions-primer-nav-badge">
            Security Checkpoint
          </div>
        </header>

        <main className="permissions-primer-grid">
          
          {/* Left Panel: Compliance Info */}
          <section className="permissions-primer-main-panel">
            <div className="permissions-primer-header-section">
              <div className="permissions-primer-shield-wrapper">
                <ShieldCheck size={36} />
              </div>
              
              <h1 className="permissions-primer-main-title">Compliance Check</h1>
              <p className="permissions-primer-main-description">
                Paradigm IFS requires these <strong>{permissionList.length} primary categories</strong> to be Allowed for secure operations.
              </p>
            </div>

            {/* PWA Prompt inside left column on Web */}
            {isMobileBrowser && (
              <div className="pwa-prompt-card">
                <div className="pwa-prompt-icon-wrapper">
                  <Smartphone size={20} />
                </div>
                <div className="pwa-prompt-details">
                  <h3 className="pwa-prompt-title">Native Experience Available</h3>
                  <p className="pwa-prompt-desc">
                    Tap the browser menu button at the bottom/top of your screen, then select <strong>"Add to Home Screen"</strong> for a native application experience.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Right Panel: Permissions List & Actions */}
          <section className="permissions-primer-side-panel">
            <div className="permissions-list-stack">
              {permissionList.map((p) => {
                const isMissing = missingPermissions.includes(p.id);
                const isActive = currentRequesting === p.id;
                
                return (
                  <div 
                    key={p.id} 
                    className={`permission-item-card ${isActive ? 'is-active-requesting' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`permission-item-icon-wrapper ${isActive ? 'is-active-requesting' : ''}`}>
                        <p.icon size={18} />
                        {isActive && <div className="spinner-active-requesting" />}
                      </div>
                      
                      <div className="permission-item-info">
                        <span className={`permission-item-name ${isMissing ? 'is-missing' : ''}`}>
                          {p.id === 'Notifications' && !Capacitor.isNativePlatform() ? 'Push Notifications (Web)' : p.label}
                        </span>
                        {isMissing && !Capacitor.isNativePlatform() && p.id === 'Notifications' && (
                          <span className="permission-item-subtitle">Non-blocking for Web Mode</span>
                        )}
                      </div>
                    </div>

                    {isActive ? (
                      <span className="status-badge-active-request">Active</span>
                    ) : isMissing ? (
                      !Capacitor.isNativePlatform() && p.id === 'Notifications' ? (
                        <div className="status-badge-web-warning">
                          <AlertCircle size={12} />
                          <span>WEB</span>
                        </div>
                      ) : (
                        <AlertCircle size={20} className="status-icon-missing" />
                      )
                    ) : (
                      <CheckCircle2 size={22} className="status-icon-allowed" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Area */}
            <div className="permissions-primer-actions">
              <Button
                variant="primary"
                onClick={handleStartSetup}
                isLoading={isRequesting}
                className="w-full md:w-auto flex-1"
              >
                {isRequesting ? 'Respond to system prompts...' : 'Grant All Permissions'}
              </Button>

              <button
                onClick={handleOpenSettings}
                className="pp-settings-link-btn"
              >
                <Settings size={15} />
                <span>Manual Security Settings</span>
              </button>
            </div>
          </section>

        </main>
        
        {/* Footer info */}
        <footer className="permissions-primer-system-footer">
          <div>Paradigm Protection Engine v4.0</div>
          <div>PROTOCOL V2.2 • SECURE ENVIRONMENT</div>
        </footer>

      </div>
    </div>
  );
};

export default PermissionsPrimer;
