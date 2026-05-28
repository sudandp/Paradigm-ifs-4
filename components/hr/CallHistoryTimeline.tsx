import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import { Phone, Calendar, Clock, User } from 'lucide-react';

interface CallLog {
  id: string;
  outcome: string;
  durationMins: number;
  notes: string;
  calledAt: string;
  nextCallAt?: string;
  caller?: {
    name: string;
  };
}

interface CallHistoryTimelineProps {
  candidateId: string;
  refreshTrigger: number;
}

const CallHistoryTimeline: React.FC<CallHistoryTimelineProps> = ({ candidateId, refreshTrigger }) => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrmApi.getCalls(candidateId);
      setCalls(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [candidateId, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-3 py-6">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-slate-50 p-4 border border-dashed border-border rounded-[2px] space-y-2">
            <div className="h-4 bg-slate-200 w-1/4 rounded-[2px]" />
            <div className="h-3 bg-slate-200 w-3/4 rounded-[2px]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-xs py-4 font-bold">{error}</div>;
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-border rounded-[2px] bg-slate-50/50">
        <Phone className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-bold text-slate-500">No calls logged yet</p>
        <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Click "Log Call" to register a candidate call</p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-border pl-6 ml-3 py-2 space-y-6">
      {calls.map((call) => {
        const calledDate = new Date(call.calledAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const nextCallDate = call.nextCallAt
          ? new Date(call.nextCallAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null;

        return (
          <div key={call.id} className="relative group">
            {/* Timeline bullet */}
            <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border border-white bg-slate-400 group-hover:bg-accent transition-all shadow-sm" />

            <div className="p-4 border border-border rounded-[2px] bg-white hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-100 border border-slate-200">
                    {call.outcome.replace('_', ' ')}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {call.durationMins} mins
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono font-bold uppercase">
                  <Calendar className="w-3 h-3" />
                  {calledDate}
                </div>
              </div>

              <p className="text-sm text-primary-text font-medium leading-relaxed mb-3 whitespace-pre-line">
                {call.notes}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2 text-[10px] text-slate-500 font-mono font-bold uppercase">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Logged by: {call.caller?.name || 'Recruiter'}</span>
                </div>

                {nextCallDate && (
                  <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-[2px]">
                    Next Call: {nextCallDate}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CallHistoryTimeline;
