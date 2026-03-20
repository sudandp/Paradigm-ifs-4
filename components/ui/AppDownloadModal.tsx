import React, { useState } from 'react';
import { X, Smartphone, Apple, Monitor, Download, Info, Share, PlusSquare, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import Button from './Button';
import { usePWAStore } from '../../store/pwaStore';

interface AppDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AppDownloadModal: React.FC<AppDownloadModalProps> = ({ isOpen, onClose }) => {
    const { deferredPrompt, clearDeferredPrompt } = usePWAStore();
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleInstall = async (id: string) => {
        setLoadingPlatform(id);

        if (id === 'ios') {
            setShowIosGuide(true);
            setLoadingPlatform(null);
            return;
        }

        if (id === 'android') {
            // Direct APK Download - simulate delay for loading state
            await new Promise(resolve => setTimeout(resolve, 800));
            window.location.href = '/Paradigm IFS.apk';
            setTimeout(() => {
                setLoadingPlatform(null);
                onClose();
            }, 1000);
            return;
        }

        if (deferredPrompt) {
            // Show the install prompt for Web / Desktop
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, clear it
            clearDeferredPrompt();
            setLoadingPlatform(null);
            onClose();
        } else {
            // Fallback: If no prompt is available, it might already be installed 
            // or the browser doesn't support it yet.
            setLoadingPlatform(null);
            window.alert('To install the app, look for the "Install" or "Add to Home Screen" option in your browser menu.');
        }
    };

    const platforms = [
        {
            id: 'android',
            name: 'Android App',
            icon: Smartphone,
            description: 'Install directly on your Android device for a native experience.',
            action: 'Install Now',
            color: 'bg-green-600',
        },
        {
            id: 'ios',
            name: 'iOS App',
            icon: Apple,
            description: 'Add to your iPhone or iPad home screen.',
            action: 'View Guide',
            color: 'bg-zinc-800',
        },
        {
            id: 'windows',
            name: 'Web / Desktop',
            icon: Monitor,
            description: 'Run as a desktop application on Windows or macOS.',
            action: 'Install App',
            color: 'bg-blue-600',
        }
    ];

    if (showIosGuide) {
        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                        <button onClick={() => setShowIosGuide(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">iOS Install Guide</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">1</div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Tap Share icon <Share className="w-4 h-4" />
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Look for the share button in Safari's bottom toolbar.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">2</div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    "Add to Home Screen" <PlusSquare className="w-4 h-4" />
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scroll down the share menu and select the "Add to Home Screen" option.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">3</div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Confirm & Launch</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tap "Add" in the top right corner. The app will appear on your home screen.</p>
                            </div>
                        </div>

                        <Button 
                            variant="primary" 
                            className="w-full !rounded-2xl h-14 !bg-emerald-600 hover:!bg-emerald-700 !border-none !text-lg shadow-lg shadow-emerald-500/20"
                            onClick={onClose}
                        >
                            Got it!
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 md:bg-black/90 backdrop-blur-xl animate-fade-in shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
            <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-200 dark:border-zinc-800/50">
                <div className="absolute inset-0 bg-white dark:bg-zinc-950 -z-10"></div> {/* Extra solid background layer */}
                {/* Header */}
                <div className="relative p-8 lg:p-10 text-center">
                    <button 
                        onClick={onClose}
                        className="absolute right-8 top-8 p-2.5 rounded-2xl bg-gray-100/50 dark:bg-zinc-800/50 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all border border-black/5 dark:border-white/5"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                    
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce-subtle">
                        <Download className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    
                    <h2 className="text-3xl lg:text-4xl font-[900] text-gray-900 dark:text-white tracking-tight">Download Paradigm Office App</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-3 text-lg font-medium opacity-80">Experience the next generation of staff tracking.</p>
                </div>

                {/* Content */}
                <div className="p-8 lg:p-10 pt-0 grid gap-5">
                    {platforms.map((platform) => {
                        const isLoading = loadingPlatform === platform.id;
                        const isDisabled = loadingPlatform !== null && loadingPlatform !== platform.id;
                        
                        return (
                            <div 
                                key={platform.id}
                                onClick={() => !loadingPlatform && handleInstall(platform.id)}
                                className={`group relative flex items-center gap-6 p-6 rounded-[2rem] bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-white/5 transition-all duration-500 ${
                                    isDisabled 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.1] cursor-pointer'
                                }`}
                            >
                                <div className={`flex-shrink-0 w-16 h-16 ${platform.color} rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 ${!isDisabled && 'group-hover:scale-110 group-hover:rotate-3'} transition-all duration-500`}>
                                    <platform.icon className="w-8 h-8" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{platform.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium opacity-70">{platform.description}</p>
                                </div>
                                <div className={`flex items-center gap-2 px-6 py-3 ${isLoading ? 'bg-emerald-700' : 'bg-emerald-600'} ${!isDisabled && 'group-hover:bg-emerald-500'} text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all duration-300`}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="hidden sm:inline">Loading...</span>
                                        </>
                                    ) : (
                                        <>
                                            {platform.id === 'ios' ? <ExternalLink className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                                            <span className="hidden sm:inline">{platform.action}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer/Offline Info */}
                <div className="p-8 lg:mx-10 lg:mb-10 bg-emerald-50/50 dark:bg-emerald-900/5 rounded-3xl flex items-start gap-4 border border-emerald-100/50 dark:border-emerald-500/10">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                        <Info className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white">Smart Offline Sync</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed opacity-80">
                            Our native app keeps you productive even deep in the field. Records are saved locally and synced automatically when signal returns.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppDownloadModal;
