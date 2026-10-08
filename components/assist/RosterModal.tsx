import React, { useState, useEffect } from 'react';
import { Users, Download, Phone, X, Search, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { exportSiteStaffRosterPDF } from '../../utils/assistPdfExport';
import toast from 'react-hot-toast';

interface RosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string | null;
  siteName: string;
}

export const RosterModal: React.FC<RosterModalProps> = ({
  isOpen,
  onClose,
  siteId,
  siteName
}) => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStaff();
    }
  }, [isOpen, siteId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('site_staff_members')
        .select('*')
        .eq('is_active', true)
        .order('designation', { ascending: true });

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStaff(data || []);
    } catch (err: any) {
      console.error('[RosterModal] Fetch error:', err);
      toast.error('Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredStaff = staff.filter(s => {
    const matchesSearch = 
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.designation?.toLowerCase().includes(search.toLowerCase()) ||
      s.department?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search);
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
        siteName: siteName || 'All Sites',
        siteCity: staff[0]?.city || 'Bengaluru',
        staffList: staff
      });
      toast.success('Roster PDF generated successfully');
    } catch (err: any) {
      toast.error('Failed to export PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Site Staff Duty Directory</h2>
              <p className="text-xs text-slate-400">
                Site: <span className="text-emerald-400 font-semibold">{siteName || 'All Sites'}</span> • Total: {staff.length} staff
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading || staff.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap gap-2.5 items-center justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, department, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Shift:</span>
            {['ALL', 'A', 'B', 'C', 'GS', 'DAY-12', 'NIGHT-12'].map((shift) => (
              <button
                key={shift}
                onClick={() => setShiftFilter(shift)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  shiftFilter === shift
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                {shift}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <span className="text-sm">Fetching verified duty roster...</span>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No staff members found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredStaff.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 transition flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {s.full_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        {s.shift_type || 'GS'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate mt-0.5">
                      {s.designation} • <span className="text-slate-400">{s.department}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Reports to: {s.reporting_manager_name || 'Site Manager'}
                    </div>
                  </div>
                  <a
                    href={`tel:${s.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 flex-shrink-0 transition shadow-lg shadow-emerald-950"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredStaff.length} of {staff.length} staff</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RosterModal;
