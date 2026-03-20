import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import Button from '../../components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

import { usePWAStore } from '../../store/pwaStore';

const PWAInstallPrompt: React.FC = () => {
    const { deferredPrompt, clearDeferredPrompt } = usePWAStore();
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed (PWA standalone mode)
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://');

        setIsStandalone(isInStandaloneMode);

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Set a timer to show the prompt if it's available
        let timer: NodeJS.Timeout;
        if (deferredPrompt || (isIOS && !isInStandaloneMode)) {
            timer = setTimeout(() => {
                setShowInstallPrompt(true);
            }, 30000); // 30 seconds
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [deferredPrompt, isIOS, isStandalone]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show install prompt
        deferredPrompt.prompt();

        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);

        // Clear the deferred prompt from store
        clearDeferredPrompt();
        setShowInstallPrompt(false);
    };

    const handleDismiss = () => {
        setShowInstallPrompt(false);
        // Show again after 3 days
        const dismissTime = new Date().getTime();
        localStorage.setItem('pwa-install-dismissed', dismissTime.toString());
    };

    // Don't show if already installed
    if (isStandalone) return null;

    // Show iOS instructions if on iOS
    if (isIOS && showInstallPrompt) {
        return (
            <div className="fixed bottom-20 left-4 right-4 bg-gradient-to-r from-[#0d2818] to-[#1f3d2b] rounded-2xl shadow-2xl p-6 z-50 animate-fade-in-scale border border-[#22c55e]/20">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#22c55e]/10 rounded-xl">
                        <Download className="w-6 h-6 text-[#22c55e]" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">Install Paradigm App</h3>
                        <p className="text-sm text-gray-300 mb-4">
                            Install this app on your iPhone: tap <span className="inline-flex items-center mx-1 px-2 py-1 bg-blue-500 rounded text-white text-xs">
                                Share
                            </span> and then "Add to Home Screen".
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show Android/Desktop install prompt
    if (showInstallPrompt && deferredPrompt) {
        return (
            <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-gradient-to-r from-[#0d2818] to-[#1f3d2b] rounded-2xl shadow-2xl p-6 z-50 animate-fade-in-scale border border-[#22c55e]/20">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-[#22c55e]/10 rounded-xl">
                        <Download className="w-6 h-6 text-[#22c55e]" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">Install Paradigm App</h3>
                        <p className="text-sm text-gray-300">
                            Get instant access and offline support by installing our app.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={handleInstallClick}
                        className="flex-1 !bg-[#22c55e] hover:!bg-[#1ea34b] !text-[#0d2818]"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Install Now
                    </Button>
                    <Button
                        onClick={handleDismiss}
                        variant="secondary"
                        className="!bg-transparent !border-gray-600 !text-gray-300"
                    >
                        Later
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};

export default PWAInstallPrompt;
