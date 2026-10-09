import React, { useState, useEffect } from 'react';
import {
  Users, Download, Phone, Search, ShieldCheck, Loader2,
  CalendarCheck, Clock, MapPin, Building, Briefcase, UserCheck
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAssistStore } from '../../store/assistStore';
import { exportSiteStaffRosterPDF } from '../../utils/assistPdfExport';
import toast from 'react-hot-toast';

export const DutyRosterPage: React.FC = () => {
  const { sites, selectedSiteId, setSelectedSiteId } = useAssistStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [downloading, setDownloading] = useState(false);

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteDisplayName = selectedSite ? selectedSite.name : 'All Paradigm Sites';

  useEffect(() => {
    fetchStaff();
  }, [selectedSiteId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('site_staff_members')
        .select('*')
        .eq('is_active', true)
        .order('designation', { ascending: true });

      if (selectedSiteId) {
        query = query.eq('site_id', selectedSiteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStaff(data || []);
    } catch (err: any) {
      console.error('[DutyRosterPage] Fetch error:', err);
      toast.error('Failed to load duty roster');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch =
      (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.designation || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search);
    const matchesShift = shiftFilter === 'ALL' || s.shift_type === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const handleDownloadPdf = async () => {
    if (staff.length === 0) {
      toast.error('No staff records found to export');
      return;
    }
    setDownloading(true);
    try {
      await exportSiteStaffRosterPDF({
        siteName: siteDisplayName || 'All Sites',
        siteCity: staff[0]?.city || 'Bengaluru',
        staffList: filteredStaff.length > 0 ? filteredStaff : staff
      });
      toast.success('Roster PDF generated successfully');
    } catch (err: any) {
      toast.error('Failed to export PDF');
    } finally {
      setDownloading(false);
    }
  };

  const shiftCounts = {
    ALL: staff.length,
    A: staff.filter(s => s.shift_type === 'A').length,
    B: staff.filter(s => s.shift_type === 'B').length,
    C: staff.filter(s => s.shift_type === 'C').length,
    GS: staff.filter(s => s.shift_type === 'GS').length,
    'DAY-12': staff.filter(s => s.shift_type === 'DAY-12').length,
    'NIGHT-12': staff.filter(s => s.shift_type === 'NIGHT-12').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Site Staff Duty Directory
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                  {staff.length} Active Staff
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified Shift Rosters, Site Contacts & Role Deployments
              </p>
            </div>
          </div>
        </div>

        {/* Site Filter & Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              className="pl-3 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white shadow-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">🏢 All Paradigm Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  📍 {s.name} {s.city ? `(${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading || staff.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Roster PDF</span>
          </button>
        </div>
      </div>

      {/* ── Shift Summary Badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {(['ALL', 'A', 'B', 'C', 'GS', 'DAY-12', 'NIGHT-12'] as const).map(shift => {
          const isSelected = shiftFilter === shift;
          const count = shiftCounts[shift] || 0;
          return (
            <button
              key={shift}
              onClick={() => setShiftFilter(shift)}
              className={`p-3 rounded-2xl border transition text-left shadow-xs flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {shift === 'ALL' ? 'Total Staff' : `Shift ${shift}`}
              </div>
              <div className="text-lg font-extrabold mt-1">
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by staff name, role, department, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-900 dark:text-white">{filteredStaff.length}</strong> of {staff.length} staff members for <strong className="text-emerald-600 dark:text-emerald-400">{siteDisplayName}</strong>
        </div>
      </div>

      {/* ── Staff Roster Grid / Cards ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
          <span className="text-sm">Fetching verified staff roster from database...</span>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm">
          No staff records match your current filter and search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredStaff.map((s) => {
            const shiftColors: Record<string, string> = {
              A: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300',
              B: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300',
              C: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300',
              GS: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300',
              'DAY-12': 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300',
              'NIGHT-12': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300',
            };
            const shiftBadgeClass = shiftColors[s.shift_type] || 'bg-slate-100 text-slate-800 border-slate-200';

            return (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition flex items-center justify-between"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {s.full_name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shiftBadgeClass}`}>
                      Shift {s.shift_type || 'GS'}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {s.designation} • <span className="text-slate-500 dark:text-slate-400 font-normal">{s.department || 'Technical/Operations'}</span>
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{s.site_name || siteDisplayName}</span>
                  </div>

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Reports to: {s.reporting_manager_name || 'Site Manager'}
                  </div>
                </div>

                <a
                  href={`tel:${s.phone}`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition flex-shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DutyRosterPage;
