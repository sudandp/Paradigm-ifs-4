import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CloudOff, RefreshCw, CloudRain, CheckCircle2, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { offlineDb } from '../../services/offline/database';
import { syncService } from '../../services/offline/syncService';
import OutboxViewer from './OutboxViewer';

const SyncStatusIndicator: React.FC = () => {
    const { isOffline } = useAuthStore();
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const checkPending = async () => {
            const pending = await offlineDb.getPendingOutbox();
            setPendingCount(pending.length);
            
            const time = await offlineDb.getSyncTime();
            setLastSync(time);
        };
        checkPending();
        
        // Interval to check outbox
        const interval = setInterval(checkPending, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        if (isOffline) return;
        setIsSyncing(true);
        try {
            await syncService.sync();
            const pending = await offlineDb.getPendingOutbox();
            setPendingCount(pending.length);
        } finally {
            setIsSyncing(false);
        }
    };

    if (pendingCount === 0 && !isOffline) return null;

    return (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-4">
            {isViewerOpen && (
                <div className="w-[90vw] md:w-[600px] h-[70vh] animate-in fade-in zoom-in-95 duration-200">
                    <OutboxViewer onClose={() => setIsViewerOpen(false)} />
                </div>
            )}
            <div className="bg-gray-900/90 backdrop-blur-md rounded-full shadow-lg border border-white/10 px-4 py-2 flex items-center gap-3 text-sm text-white animate-in fade-in slide-in-from-bottom-5">
                {isOffline ? (
                    <>
                        <div className="flex items-center gap-2" onClick={() => setIsViewerOpen(true)} role="button">
                            <CloudOff className="w-4 h-4 text-orange-400" />
                            <div className="flex flex-col">
                                <span className="font-bold leading-tight">Offline Mode</span>
                                {lastSync && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        Synced: {format(new Date(lastSync), 'MMM d, h:mm a')}
                                    </span>
                                )}
                            </div>
                        </div>
                        {pendingCount > 0 && (
                            <span 
                                onClick={() => setIsViewerOpen(true)}
                                className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ml-2 cursor-pointer hover:bg-orange-500/30 transition-colors"
                            >
                                {pendingCount} Pending
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        {pendingCount > 0 ? (
                            <>
                                <CloudRain className="w-4 h-4 text-blue-400 cursor-pointer" onClick={() => setIsViewerOpen(true)} />
                                <span className="cursor-pointer" onClick={() => setIsViewerOpen(true)}>{pendingCount} items to sync</span>
                                <button 
                                    onClick={handleSync}
                                    disabled={isSyncing}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                                </button>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 cursor-pointer" onClick={() => setIsViewerOpen(true)} />
                                <span className="cursor-pointer" onClick={() => setIsViewerOpen(true)}>All caught up</span>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SyncStatusIndicator;
