import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import {
  BarChart2, Users, Calendar, Award, Clock, Activity, RefreshCw, Flame,
  Target, TrendingUp, ArrowDownRight, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Kpis {
  total: number;
  joined: number;
  conversionPct: number;
  avgDaysToHire: number;
  callSlaPct: number;
}

interface LeaderboardItem {
  name: string;
  count: number;
  joined: number;
}

const STAGE_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#8b5cf6',
  screened: '#f59e0b',
  interview: '#06b6d4',
  offer: '#10b981',
  joined: '#006b3f',
  rejected: '#ef4444',
};

const ReportsDashboard: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [funnel, setFunnel] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Date Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [leaderboardMetric, setLeaderboardMetric] = useState<'count' | 'joined'>('count');

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const [kpiData, funnelData, leaderboardData] = await Promise.all([
        hrmApi.getKpis(startDate, endDate),
        hrmApi.getFunnel(startDate, endDate),
        hrmApi.getLeaderboard(startDate, endDate, leaderboardMetric)
      ]);

      setKpis(kpiData);
      setFunnel(funnelData || {});
      setLeaderboard(leaderboardData || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load reports dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [startDate, endDate, leaderboardMetric]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReportsData();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted animate-pulse">Compiling reports data...</p>
      </div>
    );
  }

  // Find max funnel count to normalize bar scaling
  const maxFunnelCount = Math.max(...Object.values(funnel), 1);

  return (
    <div className={`animate-fade-in min-w-0 overflow-x-hidden min-h-screen ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24' : 'space-y-8 pb-32 md:pb-8'}`}>
      {/* Header */}
      <div className={`flex justify-between items-start sm:items-center ${isMobile ? 'flex-col gap-4' : 'flex-col sm:flex-row gap-6'}`}>
        <div className="w-full sm:w-auto">
          <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl text-white' : 'text-xl md:text-2xl text-primary-text'}`}>Pipeline Analytics</h1>
          <p className={`mt-1 text-xs md:text-sm leading-relaxed ${isMobile ? 'text-white/60' : 'text-muted'}`}>Realtime HR funnel reports & SLA metrics</p>
        </div>

        <div className={`flex items-center gap-3 w-full sm:w-auto ${isMobile ? 'flex-col' : 'flex-row'}`}>
          {/* Date range picker */}
          <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${isMobile ? 'bg-[#182a20] border-[#2a4536] w-full' : 'bg-page border-border md:bg-page md:border-border max-md:bg-white/[0.05] max-md:border-white/5'}`}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`px-3 py-2 text-xs rounded-xl outline-none transition-all ${isMobile ? 'bg-[#121f17] text-white border-none' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white'}`}
            />
            <span className={`text-xs font-bold ${isMobile ? 'text-white/30' : 'text-muted max-md:text-emerald-400/60'}`}>–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`px-3 py-2 text-xs rounded-xl outline-none transition-all ${isMobile ? 'bg-[#121f17] text-white border-none' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white'}`}
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 transition-all active:scale-95 ${isMobile ? 'bg-[#006b3f] text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-[#006b3f]/20 w-full justify-center' : 'btn btn-primary btn-md shadow-xl shadow-accent/20 hover:shadow-accent/40'}`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
          <KpiCard isMobile={isMobile} icon={<Users className="w-5 h-5 md:w-6 md:h-6" />} label="Total Referrals" value={String(kpis.total)} color="#3b82f6" trend="Pipeline" />
          <KpiCard isMobile={isMobile} icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />} label="Hired" value={String(kpis.joined)} color="#10b981" trend="Joined" />
          <KpiCard isMobile={isMobile} icon={<Target className="w-5 h-5 md:w-6 md:h-6" />} label="Conversion" value={`${kpis.conversionPct}%`} color="#006b3f" trend="Ratio" />
          <KpiCard isMobile={isMobile} icon={<Clock className="w-5 h-5 md:w-6 md:h-6" />} label="Avg to Hire" value={`${kpis.avgDaysToHire}d`} color="#f59e0b" trend="Days" />
          <KpiCard isMobile={isMobile} icon={<Activity className="w-5 h-5 md:w-6 md:h-6" />} label="Call SLA" value={`${kpis.callSlaPct}%`} color={kpis.callSlaPct >= 80 ? '#10b981' : '#ef4444'} trend="48h Check" />
        </div>
      )}

      {/* Funnel & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel chart */}
        <div className={`overflow-hidden transition-all ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
              <BarChart2 className={`w-5 h-5 ${isMobile ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <h2 className={`text-lg font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Recruitment Funnel</h2>
          </div>

          <div className="space-y-5">
            {['new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected'].map((stage) => {
              const count = funnel[stage] || 0;
              const widthPct = maxFunnelCount > 0 ? (count / maxFunnelCount) * 100 : 0;
              const stageColor = STAGE_COLORS[stage] || '#94a3b8';

              return (
                <div key={stage} className="space-y-2 group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColor }} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isMobile ? 'text-white/60' : 'text-muted'}`}>
                        {stage.replace('_', ' ')}
                      </span>
                    </div>
                    <span className={`text-xs font-black ${isMobile ? 'text-white' : 'text-primary-text'}`}>{count}</span>
                  </div>
                  <div className={`h-3 w-full rounded-full overflow-hidden ${isMobile ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-90"
                      style={{ width: `${widthPct}%`, backgroundColor: stageColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className={`overflow-hidden transition-all flex flex-col ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-amber-500/20' : 'bg-amber-500/10'}`}>
                <Flame className={`w-5 h-5 ${isMobile ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
              <h2 className={`text-lg font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Leaderboard</h2>
            </div>

            <div className="relative">
              <select
                value={leaderboardMetric}
                onChange={(e) => setLeaderboardMetric(e.target.value as any)}
                className={`appearance-none h-10 pl-3 pr-9 rounded-2xl text-xs font-bold uppercase tracking-wider outline-none cursor-pointer ${isMobile ? 'bg-[#121f17] border border-[#2a4536] text-white' : 'bg-page border border-border text-primary-text'}`}
              >
                <option value="count">By Total</option>
                <option value="joined">By Hires</option>
              </select>
              <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isMobile ? 'text-white/30' : 'text-muted'}`} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
            {leaderboard.length === 0 ? (
              <div className="text-center py-16">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isMobile ? 'bg-white/[0.05]' : 'bg-page'}`}>
                  <Award className={`w-7 h-7 ${isMobile ? 'text-white/10' : 'text-muted/30'}`} />
                </div>
                <p className={`text-sm ${isMobile ? 'text-white/30' : 'text-muted'}`}>No referral leaders logged</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all group ${isMobile ? 'bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-[#2a4536]' : 'bg-page/40 hover:bg-white hover:shadow-md hover:border-border border border-transparent'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border text-xs font-black shrink-0 ${
                        idx === 0 ? (isMobile ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600') :
                        idx === 1 ? (isMobile ? 'bg-slate-500/20 border-slate-500/30 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500') :
                        idx === 2 ? (isMobile ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-500') :
                        (isMobile ? 'bg-white/5 border-white/10 text-white/40' : 'bg-page border-border text-muted')
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`font-bold truncate ${isMobile ? 'text-white text-sm' : 'text-primary-text text-sm'}`}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <div className={`text-xs font-black ${isMobile ? 'text-white' : 'text-primary-text'}`}>{item.count}</div>
                        <div className={`text-[8px] font-bold uppercase tracking-widest ${isMobile ? 'text-white/30' : 'text-muted'}`}>Total</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xs font-black ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`}>{item.joined}</div>
                        <div className={`text-[8px] font-bold uppercase tracking-widest ${isMobile ? 'text-white/30' : 'text-muted'}`}>Hired</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// KPI Stat Card
const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; trend?: string; isMobile?: boolean }> = ({ icon, label, value, color, trend, isMobile }) => (
  <div className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4' : 'bg-white rounded-3xl border border-border p-4 md:p-5 shadow-sm'}`}>
    <div className={`absolute top-0 right-0 p-3 transition-opacity ${isMobile ? 'opacity-5 group-hover:opacity-10' : 'opacity-[0.05] group-hover:opacity-[0.08]'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16 md:w-20 md:h-20' })}
    </div>
    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${color}15` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className={`text-[9px] md:text-xs font-black uppercase tracking-widest truncate ${isMobile ? 'text-white/60' : 'text-muted'}`}>{label}</p>
        <p className={`text-lg md:text-2xl font-black mt-0.5 ${isMobile ? 'text-white' : 'text-primary-text'}`}>{value}</p>
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-tighter ${isMobile ? 'text-white/40' : 'text-muted'}`}>{trend}</p>
      </div>
    )}
  </div>
);

export default ReportsDashboard;
