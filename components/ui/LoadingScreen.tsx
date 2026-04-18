import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLoadingScreenStore } from '../../store/loadingScreenStore';

interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...', fullScreen = true }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const setFullScreenLoading = useLoadingScreenStore((s) => s.setFullScreenLoading);

    // Signal MobileLayout to hide header/footer during fullscreen loading
    useEffect(() => {
        if (fullScreen) {
            setFullScreenLoading(true);
            return () => setFullScreenLoading(false);
        }
    }, [fullScreen, setFullScreenLoading]);

    useEffect(() => {
        // Professional motion/whoosh sound for rotation
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); // Using the rumble sound as a base for premium feel, or could use a whoosh
        audio.loop = true;
        audio.volume = 0.1;
        audioRef.current = audio;

        const playSound = async () => {
            try {
                await audio.play();
                // Subtly increase volume
                let vol = 0;
                const fadeInterval = setInterval(() => {
                    vol += 0.01;
                    if (audio) audio.volume = vol;
                    if (vol >= 0.15) clearInterval(fadeInterval);
                }, 100);
            } catch (err) {
                console.log('Audio playback blocked - User interaction may be required');
            }
        };
        
        playSound();

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    const containerStyle = fullScreen 
        ? "fixed inset-0 overflow-hidden bg-[#041b0f] lg:bg-white flex items-center justify-center font-['Inter',_sans-serif]"
        : "relative overflow-hidden bg-[#041b0f] lg:bg-white flex flex-col items-center justify-center min-h-[400px] w-full font-['Inter',_sans-serif] rounded-xl shadow-2xl transition-all duration-300";

    const content = (
        <div className={containerStyle} style={{ zIndex: 999999 }}>
            <style>{`
                @keyframes slowRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .logo-container {
                    background: transparent;
                    border-radius: 9999px;
                    padding: 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .rotate-wrapper {
                    animation: slowRotate 10s linear infinite;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                @keyframes progress {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center text-center">
                <div className={`${fullScreen ? 'mb-6' : 'mb-4'} relative flex flex-col justify-center items-center`}>
                    <div className="relative mb-4">
                        <div className={`logo-container ${fullScreen ? 'w-64 h-64' : 'w-48 h-48'}`}>
                            <div className="rotate-wrapper">
                                <img 
                                    src="/paradigm-correct-logo.png" 
                                    alt="Paradigm Logo" 
                                    className="w-full h-full object-contain p-2"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="company-text flex flex-col items-center">
                        <h2 className={`${fullScreen ? 'text-4xl' : 'text-2xl'} font-black text-white lg:text-[#1A4331] tracking-[0.2em] uppercase mb-1`}>
                            PARADIGM
                        </h2>
                        <h3 className={`${fullScreen ? 'text-xl' : 'text-base'} font-bold text-gray-200 lg:text-[#2f6a42] tracking-[0.4em] uppercase opacity-90`}>
                            SERVICES
                        </h3>
                    </div>
                </div>

                <div className={`${fullScreen ? 'px-6' : 'px-4'} relative z-30`}>
                    <p className="text-[#22c55e] lg:text-[#1A4331] text-xs font-mono tracking-widest animate-pulse mb-4 font-semibold">
                        {message === 'Loading...' ? '> Initializing System...' : `> ${message}`}
                    </p>
                    <div className={`${fullScreen ? 'w-72' : 'w-48'} h-1 bg-[#1f3d2b] lg:bg-gray-200 rounded-full overflow-hidden lg:border lg:border-gray-300`}>
                        <div className="h-full bg-gradient-to-r from-[#22c55e] via-[#4ade80] to-[#22c55e] lg:from-[#1A4331] lg:via-[#2f6a42] lg:to-[#1A4331] rounded-full animate-[progress_3s_linear_infinite] bg-[length:200%_100%]"></div>
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
