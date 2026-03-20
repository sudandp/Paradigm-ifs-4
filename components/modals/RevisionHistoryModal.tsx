import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Clock, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { formatFieldLabel } from '../../utils/diff';
import type { RevisionLog } from '../../types';

interface RevisionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    recordId: string;
    trackerType: 'attendance' | 'finance';
    siteName: string;
}

const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({ isOpen, onClose, recordId, trackerType, siteName }) => {
    const { data: revisions = [], isLoading } = useQuery<RevisionLog[]>({
        queryKey: ['revisions', trackerType, recordId],
        queryFn: () => trackerType === 'attendance' ? api.getSiteInvoiceRevisions(recordId) : api.getSiteFinanceRevisions(recordId),
        enabled: isOpen && !!recordId,
    });

    if (!isOpen) return null;

    // Helper to stringify values safely for display
    const renderValue = (val: any) => {
        if (val === null || val === undefined || val === '') return <span className="text-gray-400 italic">Empty</span>;
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#06251c] md:bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-white/10 md:border-gray-200 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 md:border-gray-100 bg-white/5 md:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 md:bg-emerald-100 flex items-center justify-center text-emerald-400 md:text-emerald-600">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-white md:text-gray-900">Revision History</h2>
                            <p className="text-sm text-emerald-400/60 md:text-gray-500 mt-0.5">
                                Tracking changes for <strong className="text-white md:text-gray-700">{siteName}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/50 hover:text-white md:text-gray-400 md:hover:text-gray-600 hover:bg-white/10 md:hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#041b0f] md:bg-white">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
                            <p className="text-sm text-emerald-400/60 md:text-gray-500">Loading revision history...</p>
                        </div>
                    ) : revisions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Clock className="h-12 w-12 text-emerald-500/20 md:text-gray-200 mb-4" />
                            <h3 className="text-lg font-bold text-white md:text-gray-900">No Revisions Yet</h3>
                            <p className="text-sm text-emerald-400/60 md:text-gray-500 mt-2 max-w-md">
                                This record hasn't been modified since it was created. Any future updates will be tracked here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 md:space-y-8">
                            {revisions.map((rev) => (
                                <div key={rev.id} className="relative pl-6 md:pl-8">
                                    {/* Timeline line */}
                                    <div className="absolute left-[11px] md:left-[15px] top-6 bottom-[-24px] md:bottom-[-32px] w-0.5 bg-emerald-500/20 md:bg-gray-200 last:hidden" />
                                    
                                    {/* Timeline dot */}
                                    <div className="absolute left-0.5 md:left-1.5 top-1.5 h-6 w-6 rounded-full bg-[#06251c] md:bg-white border-2 border-emerald-500 shadow-sm flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    </div>

                                    {/* Revision Card */}
                                    <div className="bg-white/5 md:bg-gray-50 rounded-xl border border-white/10 md:border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="px-4 py-3 border-b border-white/5 md:border-gray-200 bg-[#06251c]/50 md:bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-emerald-500/10 md:bg-gray-100 text-[#00D27F] md:text-gray-700 text-xs font-bold uppercase tracking-wider">
                                                    Revision #{rev.revisionNumber}
                                                </span>
                                                <span className="text-sm font-semibold text-white md:text-gray-900">
                                                    {rev.revisedByName || 'Unknown User'}
                                                </span>
                                            </div>
                                            <div className="text-xs font-medium text-emerald-400/60 md:text-gray-500 flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5" />
                                                {format(new Date(rev.revisedAt), 'dd MMM yyyy, hh:mm a')}
                                            </div>
                                        </div>
                                        
                                        <div className="p-0 overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-[#041b0f]/50 md:bg-gray-50 border-b border-white/5 md:border-gray-200">
                                                        <th className="px-4 py-2 text-xs font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider w-1/3">Field</th>
                                                        <th className="px-4 py-2 text-xs font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider w-1/3">Previous Value</th>
                                                        <th className="px-4 py-2 text-xs font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider w-1/3">New Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 md:divide-gray-100">
                                                    {Object.entries(rev.diff).map(([field, { old, new: newVal }]) => (
                                                        <tr key={field} className="hover:bg-white/5 md:hover:bg-white transition-colors">
                                                            <td className="px-4 py-3 text-sm font-medium text-white md:text-gray-900">
                                                                {formatFieldLabel(field)}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-rose-400 md:text-rose-600 bg-rose-500/5 md:bg-rose-50/50">
                                                                <span className="line-through opacity-80">{renderValue(old)}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-emerald-400 md:text-emerald-600 bg-emerald-500/5 md:bg-emerald-50/50 font-medium flex items-center gap-2">
                                                                <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0 hidden sm:block" />
                                                                {renderValue(newVal)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RevisionHistoryModal;
