import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { useLoadingScreenStore } from '../../store/loadingScreenStore';

interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...', fullScreen = true }) => {
    const setFullScreenLoading = useLoadingScreenStore((s) => s.setFullScreenLoading);

    // Signal MobileLayout to hide header/footer during fullscreen loading
    useEffect(() => {
        if (fullScreen) {
            setFullScreenLoading(true);
            return () => setFullScreenLoading(false);
        }
    }, [fullScreen, setFullScreenLoading]);

    const isNative = Capacitor.isNativePlatform();

    // Web: white/light radial gradient. Native: dark brand radial gradient.
    const bgGradient = isNative
        ? 'radial-gradient(circle at center, #0a331c 0%, #03130a 100%)'
        : 'radial-gradient(circle at center, #ffffff 0%, #f3f8f5 100%)';
    const textPrimary = isNative ? 'text-white' : 'text-[#1A4331]';
    const textSub = isNative ? 'text-gray-400' : 'text-[#2f6a42]';
    const statusText = isNative ? 'text-[#22c55e]' : 'text-[#006b3f]';
    const barBg = isNative ? 'bg-[#1f3d2b]' : 'bg-[#e2ede7]';
    const barFill = isNative
        ? 'bg-gradient-to-r from-[#22c55e] via-[#4ade80] to-[#22c55e]'
        : 'bg-gradient-to-r from-[#006b3f] via-[#22c55e] to-[#006b3f]';

    const containerClass = fullScreen
        ? `fixed inset-0 overflow-hidden flex items-center justify-center font-['Inter',_sans-serif] desktop-scaled ls-container-animate`
        : `relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] w-full font-['Inter',_sans-serif] rounded-xl shadow-2xl transition-all duration-300 desktop-scaled ls-container-animate`;

    const content = (
        <div className={containerClass} style={{ background: bgGradient, zIndex: 999999 }}>
            <style>{`
                @keyframes ls-fade-in-container {
                    from { opacity: 0; transform: scale(0.99); }
                    to { opacity: 1; transform: scale(1); }
                }
                .ls-container-animate {
                    animation: ls-fade-in-container 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes ls-breathe {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 20px ${isNative ? 'rgba(34, 197, 94, 0.03)' : 'rgba(0, 107, 63, 0.03)'}); }
                    50% { transform: scale(1.025); filter: drop-shadow(0 12px 28px ${isNative ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0, 107, 63, 0.08)'}); }
                }
                .ls-breathe-wrapper {
                    animation: ls-breathe 4s ease-in-out infinite;
                }

                @keyframes ls-spin-clockwise {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes ls-spin-counter {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }
                .ls-logo-spin {
                    animation: ls-spin-clockwise 18s linear infinite;
                }
                .ls-ring-spin {
                    animation: ls-spin-counter 10s linear infinite;
                }

                @keyframes ls-fade-up {
                    0% { opacity: 0; transform: translateY(12px); filter: blur(2px); }
                    100% { opacity: 1; transform: translateY(0); filter: blur(0); }
                }
                .ls-animate-fade-up {
                    opacity: 0;
                    animation: ls-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .ls-delay-1 { animation-delay: 0.15s; }
                .ls-delay-2 { animation-delay: 0.35s; }

                @keyframes ls-fill-bar {
                    0% { width: 0%; }
                    10% { width: 15%; }
                    25% { width: 45%; }
                    45% { width: 68%; }
                    70% { width: 85%; }
                    92% { width: 96%; }
                    100% { width: 100%; }
                }
                @keyframes ls-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .ls-progress-bar-fill {
                    animation: ls-fill-bar 4s cubic-bezier(0.1, 0.8, 0.1, 1) forwards,
                               ls-shimmer 2.5s linear infinite;
                }

                @keyframes ls-dot {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
                    40% { transform: scale(1.15); opacity: 1; }
                }
                .ls-dot-1 { animation: ls-dot 1.4s 0s infinite ease-in-out; }
                .ls-dot-2 { animation: ls-dot 1.4s 0.16s infinite ease-in-out; }
                .ls-dot-3 { animation: ls-dot 1.4s 0.32s infinite ease-in-out; }

                .ls-logo-container {
                    background: transparent;
                    border-radius: 9999px;
                    padding: 2.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
            `}</style>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center text-center">
                <div className={`${fullScreen ? 'mb-8' : 'mb-4'} relative flex flex-col justify-center items-center`}>
                    <div className="relative mb-6 ls-breathe-wrapper">
                        {/* Counter-rotating subtle outline ring */}
                        <div className={`absolute inset-0 rounded-full border border-dashed ${isNative ? 'border-emerald-500/20' : 'border-[#006b3f]/15'} ls-ring-spin`} />
                        <div className={`absolute -inset-1.5 rounded-full border ${isNative ? 'border-emerald-500/5' : 'border-[#006b3f]/5'} animate-pulse`} />
                        
                        <div className={`ls-logo-container ${fullScreen ? 'w-60 h-60' : 'w-44 h-44'} relative z-10`}>
                            {/* Inner slowly spinning logo */}
                            <div className="ls-logo-spin w-full h-full flex items-center justify-center">
                                <img
                                    src="/paradigm-correct-logo.png"
                                    alt="Paradigm Logo"
                                    className="w-full h-full object-contain p-2"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="company-text flex flex-col items-center ls-animate-fade-up ls-delay-1">
                        <h2 className={`${fullScreen ? 'text-4xl' : 'text-2xl'} font-black ${textPrimary} tracking-[0.2em] uppercase mb-1`}>
                            PARADIGM
                        </h2>
                        <h3 className={`${fullScreen ? 'text-xl' : 'text-base'} font-bold ${textSub} tracking-[0.4em] uppercase opacity-90`}>
                            SERVICES
                        </h3>
                    </div>
                </div>

                <div className={`${fullScreen ? 'px-6' : 'px-4'} relative z-30 ls-animate-fade-up ls-delay-2`}>
                    {/* Dot loader + status text */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="flex gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ls-dot-1 ${isNative ? 'bg-[#22c55e]' : 'bg-[#006b3f]'}`} />
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ls-dot-2 ${isNative ? 'bg-[#22c55e]' : 'bg-[#006b3f]'}`} />
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ls-dot-3 ${isNative ? 'bg-[#22c55e]' : 'bg-[#006b3f]'}`} />
                        </div>
                        <p className={`${statusText} text-xs font-mono tracking-widest font-semibold`}>
                            {message === 'Loading...' ? 'Initializing System...' : message}
                        </p>
                    </div>
                    <div className={`${fullScreen ? 'w-72' : 'w-48'} h-1.5 ${barBg} rounded-full overflow-hidden ${!isNative ? 'border border-gray-100/50' : ''}`}>
                        <div className={`h-full ${barFill} rounded-full ls-progress-bar-fill bg-[length:200%_100%]`}></div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (fullScreen) {
        return createPortal(content, document.body);
    }

    return content;
};

export default LoadingScreen;

