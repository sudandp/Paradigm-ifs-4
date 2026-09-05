import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertTriangle, RefreshCw, Smartphone, Laptop, CheckCircle2, X, ExternalLink, ShieldAlert } from 'lucide-react';
import { getPrecisePosition } from '../../utils/locationUtils';
import { Capacitor } from '@capacitor/core';

interface LocationPermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLocationAcquired?: (position: GeolocationPosition) => void;
    actionName?: string;
    errorMessage?: string | null;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
    isOpen,
    onClose,
    onLocationAcquired,
    actionName = 'Attendance Action',
    errorMessage
}) => {
    const navigate = useNavigate();
    const isNative = Capacitor.isNativePlatform();
    const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isDesktop = !isNative && !isMobileBrowser;

    const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>(isDesktop ? 'desktop' : 'mobile');
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryStatus, setRetryStatus] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(isDesktop ? 'desktop' : 'mobile');
            setRetryStatus(null);
        }
    }, [isOpen, isDesktop]);

    if (!isOpen) return null;

    const handleRetry = async () => {
        setIsRetrying(true);
        setRetryStatus(null);
        try {
            const pos = await getPrecisePosition(200, 10000);
            if (pos && pos.coords && pos.coords.latitude != null) {
                setRetryStatus({
                    success: true,
                    message: `Location verified (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})!`
                });
                setTimeout(() => {
                    if (onLocationAcquired) {
                        onLocationAcquired(pos);
                    }
                    onClose();
                }, 600);
            } else {
                throw new Error('Coordinates missing from location service.');
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Unable to obtain GPS fix. Please ensure location is turned ON in your phone settings.';
            console.warn('[LocationModal] Retry failed:', errorMsg);
            setRetryStatus({
                success: false,
                message: errorMsg
            });
        } finally {
            setIsRetrying(false);
        }
    };

    const handleManagerApproval = () => {
        onClose();
        navigate('/attendance/request-unlock');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 px-6 py-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                            <MapPin className="h-6 w-6 text-white animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Location Access Mandatory</h2>
                            <p className="text-xs text-rose-100 font-medium mt-0.5">
                                Verified location is required for {actionName}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                    {/* Error Banner */}
                    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 flex gap-3 text-rose-900 dark:text-rose-200 text-sm">
                        <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300">
                                Action Blocked
                            </p>
                            <p className="text-xs leading-relaxed mt-1 text-rose-900/90 dark:text-rose-200/90">
                                {errorMessage || 'Could not acquire your verified location. Company policy requires verified coordinates before recording attendance.'}
                            </p>
                        </div>
                    </div>

                    {/* Retry Status feedback if attempted */}
                    {retryStatus && (
                        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                            retryStatus.success 
                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' 
                                : 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
                        }`}>
                            {retryStatus.success ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            )}
                            <span>{retryStatus.message}</span>
                        </div>
                    )}

                    {/* Device Instruction Tabs */}
                    <div className="space-y-3">
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setActiveTab('desktop')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    activeTab === 'desktop'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                                }`}
                            >
                                <Laptop className="h-3.5 w-3.5" />
                                <span>Windows PC / Chrome</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('mobile')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    activeTab === 'mobile'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                                }`}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                                <span>Mobile App / Phone</span>
                            </button>
                        </div>

                        {/* Desktop Step-by-Step Instructions */}
                        {activeTab === 'desktop' && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                                <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>How to enable Location in Windows & Chrome:</span>
                                </h4>
                                
                                <div className="space-y-2.5 text-slate-700 dark:text-slate-300">
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                            1
                                        </span>
                                        <div>
                                            <strong className="text-slate-900 dark:text-white">Enable Windows 11 Location:</strong>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Press <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border rounded text-[10px]">Win + I</kbd> → <em>Privacy & security</em> → <em>Location</em> → Turn <strong>ON</strong> <u>Location services</u> and <u>Let desktop apps access your location</u>.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                            2
                                        </span>
                                        <div>
                                            <strong className="text-slate-900 dark:text-white">Allow in Chrome Browser:</strong>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                In the Chrome address bar next to <code className="text-emerald-600 font-bold">app.paradigmms.com</code>, click the <strong>site settings icon (sliders/tune)</strong> and set <strong>Location to "Allow"</strong>.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                            3
                                        </span>
                                        <div>
                                            <strong className="text-slate-900 dark:text-white">Keep Wi-Fi Turned ON:</strong>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Laptops and PCs use Wi-Fi networks to pinpoint your location. Ensure your Wi-Fi is enabled.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mobile Step-by-Step Instructions */}
                        {activeTab === 'mobile' && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                                <h4 className="font-extrabold text-slate-900 dark:text-white">
                                    How to enable GPS on Android / iOS:
                                </h4>
                                
                                <div className="space-y-2.5 text-slate-700 dark:text-slate-300">
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                            1
                                        </span>
                                        <div>
                                            <strong className="text-slate-900 dark:text-white">Turn on Phone GPS:</strong>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Pull down your notification shade and turn <strong>ON Location / GPS</strong>.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                            2
                                        </span>
                                        <div>
                                            <strong className="text-slate-900 dark:text-white">Allow App Permissions:</strong>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Go to <em>Settings → Apps → Paradigm → Permissions → Location</em> → Select <strong>"Allow while using app"</strong> and enable <strong>"Use Precise Location"</strong>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Actions Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/90 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <button
                        onClick={handleManagerApproval}
                        className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer order-2 sm:order-1"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Signal broken? Request Manager Approval</span>
                    </button>

                    <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                            <span>{isRetrying ? 'Checking Location...' : 'Retry Location Access'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationPermissionModal;
