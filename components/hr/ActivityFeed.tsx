import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import { GitCommit, Filter, MessageSquare, ArrowRightLeft, ShieldCheck, Mail, Sparkles } from 'lucide-react';

interface FeedItem {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
  visibleToReferrer: boolean;
  actor?: {
    name: string;
  };
}

interface ActivityFeedProps {
  candidateId: string;
  refreshTrigger: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ candidateId, refreshTrigger }) => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [referrerOnly, setReferrerOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrmApi.getFeed(candidateId, referrerOnly);
      setFeed(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [candidateId, referrerOnly, refreshTrigger]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'call_logged':
        return <MessageSquare className="w-3.5 h-3.5" />;
      case 'stage_changed':
        return <ArrowRightLeft className="w-3.5 h-3.5" />;
      case 'letter_issued':
        return <Mail className="w-3.5 h-3.5" />;
      default:
        return <GitCommit className="w-3.5 h-3.5" />;
    }
  };

  const getLabel = (item: FeedItem) => {
    const actorName = item.actor?.name || 'Recruiter';
    switch (item.type) {
      case 'call_logged':
        return `${actorName} logged a candidate call (Outcome: ${item.payload?.outcome})`;
      case 'stage_changed':
        return `${actorName} moved stage from "${item.payload?.fromStage}" to "${item.payload?.toStage}"`;
      case 'letter_issued':
        return `${actorName} issued ${item.payload?.letterType} letter (${item.payload?.refNumber})`;
      default:
        return `${actorName} completed action: ${item.type}`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-slate-100 rounded w-1/4" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-xs py-4 font-bold">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Visibility Filters */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Filters:</span>
        <button
          onClick={() => setReferrerOnly(!referrerOnly)}
          className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-tighter border transition-all rounded-[2px] ${
            referrerOnly
              ? 'bg-[#006b3f] border-[#006b3f] text-white'
              : 'bg-white border-border text-slate-600 hover:bg-slate-50'
          }`}
        >
          Referrer Viewable Only
        </button>
      </div>

      {feed.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-[2px] bg-slate-50/50">
          <GitCommit className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-500">No activity logged</p>
          <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Candidate audit log is empty</p>
        </div>
      ) : (
        <div className="relative border-l border-border pl-6 ml-3 py-2 space-y-6">
          {feed.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div key={item.id} className="relative flex items-start gap-4 group">
                {/* Bullet */}
                <div className="absolute -left-[35px] top-1 w-5 h-5 rounded-full border border-white bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm group-hover:bg-[#006b3f] group-hover:text-white transition-all">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-sm font-bold text-primary-text leading-snug">
                      {getLabel(item)}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase whitespace-nowrap">
                      {dateStr}
                    </span>
                  </div>

                  {item.payload?.reason && (
                    <p className="text-xs text-slate-500 font-medium italic mt-1 pl-3 border-l-2 border-slate-200">
                      Reason: "{item.payload.reason}"
                    </p>
                  )}

                  {item.payload?.notes && (
                    <p className="text-xs text-slate-500 font-medium italic mt-1 pl-3 border-l-2 border-slate-200">
                      Notes: "{item.payload.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-[2px] text-[8px] font-mono font-bold uppercase tracking-wider ${
                      item.visibleToReferrer
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {item.visibleToReferrer ? 'Visible to Referrer' : 'Internal Only'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
