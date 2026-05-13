import React, { useState, useEffect } from 'react';
import { offlineDb, OutboxItem } from '../../services/offline/database';
import { format } from 'date-fns';
import { 
    Clock, 
    RefreshCcw, 
    Trash2, 
    AlertCircle, 
    CheckCircle2, 
    ChevronRight, 
    Database,
    X,
    Maximize2
} from 'lucide-react';

interface OutboxViewerProps {
    onClose?: () => void;
}

const OutboxViewer: React.FC<OutboxViewerProps> = ({ onClose }) => {
    const [items, setItems] = useState<OutboxItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<OutboxItem | null>(null);

    const loadItems = async () => {
        setIsLoading(true);
        try {
            const outboxItems = await offlineDb.getAllOutbox();
            setItems(outboxItems);
        } catch (error) {
            console.error('Failed to load outbox items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
        // Refresh every 10 seconds if open
        const interval = setInterval(loadItems, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this pending sync item?')) {
            await offlineDb.deleteFromOutbox(id);
            loadItems();
        }
    };

    const handleRetry = async (id: number) => {
        await offlineDb.updateOutboxStatus(id, 'pending');
        loadItems();
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'syncing': return <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Database className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Sync Outbox</h2>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                            {items.length} Pending Actions
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={loadItems}
                        className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-100"
                    >
                        <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-red-600 border border-transparent hover:border-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
                {/* List */}
                <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${selectedItem ? 'hidden md:block' : 'block'}`}>
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-bold text-sm tracking-widest uppercase">Everything Synced</p>
                        </div>
                    ) : (
                        items.map((item) => (
                            <div 
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                                    selectedItem?.id === item.id 
                                        ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                                        : 'bg-white border-gray-100 hover:border-emerald-100 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                            item.action === 'INSERT' ? 'bg-blue-100 text-blue-700' :
                                            item.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {item.action}
                                        </span>
                                        <span className="text-xs font-bold text-gray-900 truncate max-w-[120px]">
                                            {item.table_name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(item.status)}
                                        <span className="text-[10px] font-medium text-gray-400">
                                            {format(new Date(item.timestamp), 'HH:mm:ss')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <p className="text-gray-500 font-medium truncate">
                                        Payload: {JSON.stringify(item.payload).substring(0, 40)}...
                                    </p>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Details Side Panel */}
                {selectedItem && (
                    <div className="w-full md:w-96 border-l border-gray-100 bg-gray-50/30 flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Action Details</h3>
                            <button 
                                onClick={() => setSelectedItem(null)}
                                className="md:hidden p-1 hover:bg-gray-100 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(selectedItem.status)}
                                        <span className="text-sm font-bold text-gray-900 capitalize">{selectedItem.status}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Target Table</label>
                                        <p className="text-sm font-bold text-gray-900">{selectedItem.table_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Action</label>
                                        <p className="text-sm font-bold text-gray-900">{selectedItem.action}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Payload JSON</label>
                                    <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                                        <pre className="text-[10px] text-emerald-400 font-mono">
                                            {JSON.stringify(selectedItem.payload, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                                {selectedItem.status === 'failed' && (
                                    <button 
                                        onClick={() => handleRetry(selectedItem.id!)}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-200"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                        Retry Sync
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDelete(selectedItem.id!)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove from Queue
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OutboxViewer;
