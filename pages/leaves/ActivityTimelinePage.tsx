import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Footprints, Maximize } from 'lucide-react';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';

export type DetailedActivityRecord = {
    dateStr: string;
    travelKm: number;
    travelDuration: number;
    steps: number;
    sqft: number;
    startTime: string | null;
    endTime: string | null;
    startLocation: string | null;
    endLocation: string | null;
};

const formatDuration = (mins: number): string => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

export const ActivityTimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Safely parse state
    const state = location.state as { records?: DetailedActivityRecord[], type?: 'travel' | 'steps' };
    const records = state?.records || [];
    const type = state?.type || 'travel';

    return (
        <div className="min-h-screen bg-page p-4 md:p-6 pb-32">
            <header className="mb-6">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm font-medium mb-4 text-muted-foreground hover:text-primary-text transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
                    {type === 'travel' ? (
                        <><MapPin className="text-emerald-500 w-6 h-6" /> Monthly Travel Breakdown</>
                    ) : (
                        <><Footprints className="text-indigo-500 w-6 h-6" /> Monthly Footsteps Breakdown</>
                    )}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Detailed daily logs for the selected month.</p>
            </header>

            {!records || records.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 border border-border text-center shadow-card">
                    <p className="text-muted-foreground mb-4">No records found or data was lost.</p>
                    <Button onClick={() => navigate('/leaves/dashboard')} variant="primary">
                        Return to Dashboard
                    </Button>
                </div>
            ) : (
                <div className="bg-card rounded-2xl p-4 md:p-6 shadow-card border border-border">
                    <div className="relative border-l-2 border-border/50 ml-3 md:ml-6 space-y-8 py-4">
                        {records.filter(r => type === 'travel' ? r.travelKm > 0 : r.steps > 0).length === 0 ? (
                             <p className="text-center text-muted-foreground text-sm py-4">No records to display for this category.</p>
                        ) : (
                            records
                            .filter(r => type === 'travel' ? r.travelKm > 0 : r.steps > 0)
                            .map((record) => (
                            <div key={record.dateStr} className="relative pl-6 md:pl-8">
                                <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-accent ring-4 ring-card"></div>
                                <div className="mb-3 text-base font-bold text-primary-text">
                                    {format(new Date(record.dateStr), 'MMM dd, yyyy (EEEE)')}
                                </div>
                                <div className="bg-accent/5 rounded-xl p-4 md:p-5 border border-accent/10 shadow-sm space-y-4">
                                    
                                    {/* Location & Time Section - Only relevant for Travel since it spans the whole day's locations */}
                                    {type === 'travel' && (
                                        <>
                                        <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <span className="text-[10px] font-bold text-blue-600">IN</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-primary-text">{record.startTime ? format(new Date(record.startTime), 'hh:mm a') : 'N/A'}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-1" title={record.startLocation || ''}>{record.startLocation || 'Unknown Location'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="hidden md:flex flex-col items-center justify-center text-muted/30">
                                                <div className="h-px w-8 bg-border"></div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <span className="text-[10px] font-bold text-purple-600">OUT</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-primary-text">{record.endTime ? format(new Date(record.endTime), 'hh:mm a') : 'N/A'}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-1" title={record.endLocation || ''}>{record.endLocation || 'Unknown Location'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-px w-full bg-border/50"></div>
                                        </>
                                    )}

                                    {/* Metrics Section */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        {type === 'travel' ? (
                                            <>
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                <MapPin className="w-4 h-4 text-emerald-600" />
                                                <span className="font-bold text-emerald-800 text-sm">{record.travelKm.toFixed(2)} KM</span>
                                            </div>
                                            {record.travelDuration > 0 && (
                                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                    <Clock className="w-4 h-4 text-blue-600" />
                                                    <span className="font-medium text-blue-800 text-sm">{formatDuration(record.travelDuration)}</span>
                                                </div>
                                            )}
                                            </>
                                        ) : (
                                            <>
                                            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                <Footprints className="w-4 h-4 text-indigo-600" />
                                                <span className="font-bold text-indigo-800 text-sm">{record.steps.toLocaleString()} steps</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                                                <Maximize className="w-4 h-4 text-purple-600" />
                                                <span className="font-medium text-purple-800 text-sm">{record.sqft.toLocaleString()} sqft</span>
                                            </div>
                                            </>
                                        )}
                                    </div>
                                    
                                </div>
                            </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityTimelinePage;
