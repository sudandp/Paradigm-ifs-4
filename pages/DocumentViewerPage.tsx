import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, ZoomIn, ZoomOut, RotateCw, ArrowLeft, FileText, ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';

const DocumentViewerPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const url = searchParams.get('url') || '';
    const title = searchParams.get('title') || 'Document Preview';
    
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isObscured, setIsObscured] = useState(false);

    const isPdf = useMemo(() => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf');
    }, [url]);

    // Security and keyboard event listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                navigate(-1);
            }
            // Block screenshots/recording shortcuts (PrintScreen, Ctrl+S, Cmd+Shift+3/4/5)
            if (e.key === 'PrintScreen' || 
                (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'c')) || 
                (e.metaKey && (e.key === 's' || e.key === 'p' || e.key === 'c')) ||
                (e.metaKey && e.shiftKey && ['3','4','5'].includes(e.key))) {
                e.preventDefault();
                setIsObscured(true);
                setTimeout(() => setIsObscured(false), 3000); // Obscure for a few seconds
            }
        };

        const handleVisibilityChange = () => setIsObscured(document.hidden);
        const handleBlur = () => setIsObscured(true);
        const handleFocus = () => setIsObscured(false);

        const preventAction = (e: Event) => e.preventDefault();

        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('copy', preventAction);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('copy', preventAction);
        };
    }, [navigate]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);


    const handleBack = () => {
        navigate(-1);
    };

    if (!url) {
        return (
            <div className="fixed inset-0 z-[9999] bg-page flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-muted">No document to display</p>
                    <Button onClick={handleBack} className="mt-4" variant="secondary">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/95 flex flex-col font-sans select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            {isObscured && (
                <div className="absolute inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
                    <ShieldAlert className="h-16 w-16 text-yellow-500 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Screen Capture Protected</h2>
                    <p className="text-white/70 max-w-md">This document contains sensitive information. Screenshots, screen recording, and copying are disabled to protect compliance data.</p>
                </div>
            )}
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/10 shadow-lg relative z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-white/90 hover:text-white transition-colors group"
                    >
                        <div className="p-1.5 rounded-full group-hover:bg-white/10 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold hidden sm:inline">Back</span>
                    </button>
                    
                    <div className="h-6 w-px bg-white/10 hidden sm:block" />
                    
                    <div className="flex items-center gap-2 max-w-[150px] sm:max-w-[400px]">
                        {isPdf ? <FileText className="h-4 w-4 text-accent shrink-0" /> : <RotateCw className="h-4 w-4 text-accent shrink-0" />}
                        <h1 className="text-white text-sm font-bold truncate">
                            {decodeURIComponent(title)}
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                    <button
                        onClick={handleBack}
                        className="p-2 text-white/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-hidden relative bg-[#1a1a1a]">
                {isPdf ? (
                    <div className="w-full h-full flex flex-col">
                        <iframe
                            src={`${url}#toolbar=0`}
                            title={title}
                            className="w-full h-full border-none"
                            loading="lazy"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-4 md:p-10 scrollbar-hide">
                        <div 
                            className="relative shadow-2xl transition-all duration-300 ease-out"
                            style={{
                                transform: `scale(${scale}) rotate(${rotation}deg)`,
                                transformOrigin: 'center center'
                            }}
                        >
                            <img
                                src={url}
                                alt={decodeURIComponent(title)}
                                className="max-w-full max-h-[85vh] object-contain rounded-sm"
                                draggable={false}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Controls (Only for Images) */}
            {!isPdf && (
                <div className="flex items-center justify-center gap-3 px-6 py-4 bg-black/80 backdrop-blur-md border-t border-white/10 relative z-20">
                    <div className="flex items-center bg-white/10 rounded-full p-1 border border-white/5 shadow-inner">
                        <button
                            onClick={handleZoomOut}
                            disabled={scale <= 0.5}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30"
                            aria-label="Zoom out"
                        >
                            <ZoomOut className="h-5 w-5" />
                        </button>
                        
                        <span className="text-white font-bold text-xs min-w-[50px] text-center select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        
                        <button
                            onClick={handleZoomIn}
                            disabled={scale >= 3}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30"
                            aria-label="Zoom in"
                        >
                            <ZoomIn className="h-5 w-5" />
                        </button>
                    </div>
                    
                    <div className="h-8 w-px bg-white/10 mx-1" />
                    
                    <button
                        onClick={handleRotate}
                        className="p-2.5 text-white/70 hover:text-white bg-white/5 hover:bg-accent/20 rounded-full border border-white/10 transition-all active:scale-90"
                        title="Rotate 90°"
                    >
                        <RotateCw className="h-5 w-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default DocumentViewerPage;
