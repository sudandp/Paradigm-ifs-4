import React, { useState, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Printer,
  Search,
  Shield,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { SnagEntry } from './SnagAuditPage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

// ─── Types ───────────────────────────────────────────────────────────────────

type Criticality = 'High' | 'Medium' | 'Low';
type Department = 'MEP' | 'House Keeping' | 'Security' | 'Landscaping' | 'Fire and Safety' | 'Other';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CRITICALITY_COLOR: Record<Criticality, string> = {
  High: 'text-red-600 bg-red-50 border-red-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Low: 'text-green-600 bg-green-50 border-green-200',
};

const STATUS_COLOR: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
};

const DEPT_COLORS: Record<string, string> = {
  MEP: 'bg-blue-100 text-blue-700',
  'House Keeping': 'bg-purple-100 text-purple-700',
  Security: 'bg-red-100 text-red-700',
  Landscaping: 'bg-green-100 text-green-700',
  'Fire and Safety': 'bg-orange-100 text-orange-700',
  Other: 'bg-gray-100 text-gray-700',
};

function generateId() {
  return `snag-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseExcelData(text: string): SnagEntry[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    return {
      id: generateId(),
      timestamp: cols[0] || new Date().toISOString(),
      emailAddress: cols[1] || '',
      nameOfSite: cols[2] || '',
      purposeOfVisit: cols[3] ? [cols[3] as any] : [],
      department: cols[4] ? [cols[4] as Department] : [],
      snagPictureUrl: cols[5] || '',
      criticality: (cols[6] as Criticality) || 'Low',
      snagDescription: cols[7] || '',
      actionToBeTaken: cols[8] || '',
      remarks: cols[9] || '',
      status: 'Open' as const,
      submittedBy: cols[1] || '',
    };
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  textColor: string;
}> = ({ label, value, textColor }) => (
  <div className="bg-card rounded-xl p-4 text-center border border-border shadow-card transition-all hover:shadow-md">
    <div className={`text-3xl font-black ${textColor}`}>{value}</div>
    <div className="text-muted text-xs font-semibold uppercase tracking-wider mt-1.5">{label}</div>
  </div>
);

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

const MiniBarChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-24 text-xs text-gray-600 text-right shrink-0">{d.label}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${d.color}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="w-6 text-xs font-semibold text-gray-700 shrink-0">{d.value}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Report Card (Print-friendly row) ────────────────────────────────────────

const ReportRow: React.FC<{ entry: SnagEntry; index: number }> = ({ entry, index }) => (
  <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
      {format(new Date(entry.timestamp), 'dd/MM/yy HH:mm')}
    </td>
    <td className="px-3 py-3">
      <div className="font-semibold text-gray-800 text-sm">{entry.nameOfSite}</div>
      <div className="text-xs text-gray-400">{entry.purposeOfVisit.join(', ')}</div>
    </td>
    <td className="px-3 py-3">
      <div className="flex flex-wrap gap-1">
        {entry.department.map(d => (
          <span key={d} className={`text-xs px-1.5 py-0.5 rounded font-medium ${DEPT_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
            {d}
          </span>
        ))}
      </div>
    </td>
    <td className="px-3 py-3">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${CRITICALITY_COLOR[entry.criticality]}`}>
        <AlertTriangle size={9} />
        {entry.criticality}
      </span>
    </td>
    <td className="px-3 py-3 text-sm text-gray-700 max-w-xs">
      <p className="line-clamp-2">{entry.snagDescription}</p>
    </td>
    <td className="px-3 py-3 text-xs text-gray-600 max-w-xs">
      <p className="line-clamp-3">{entry.actionToBeTaken}</p>
    </td>
    <td className="px-3 py-3 text-xs text-gray-500">{entry.remarks || '—'}</td>
    <td className="px-3 py-3">
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[entry.status] ?? 'bg-gray-100 text-gray-600'}`}>
        {entry.status}
      </span>
    </td>
    <td className="px-3 py-3 text-xs text-gray-500">{entry.submittedBy || entry.emailAddress}</td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SnagReportPage: React.FC = () => {
  const today = new Date();
  const [entries, setEntries] = useState<SnagEntry[]>([
    {
      id: 'sample-1',
      timestamp: '2024-09-26T13:38:19.000Z',
      emailAddress: 'nithingowda2807@gmail.com',
      nameOfSite: 'Sark 2 Villas',
      purposeOfVisit: ['Monthly Audit'],
      department: ['Security'],
      snagPictureUrl: '',
      criticality: 'High',
      snagDescription: 'Compound wall height is less and there is no solar fencing in west line',
      actionToBeTaken: 'Solar fencing needs to be installed at boundary wall near west line. Anyone can cross the boundary wall from Fakeers or Sark 1 land.',
      remarks: 'Need to close the gate after inspection',
      status: 'Open',
      submittedBy: 'Nithin Gowda',
    },
    {
      id: 'sample-2',
      timestamp: '2024-09-20T10:15:00.000Z',
      emailAddress: 'manager@paradigm.com',
      nameOfSite: 'Sark 1 Phase',
      purposeOfVisit: ['Quarterly Audit'],
      department: ['MEP', 'Fire and Safety'],
      snagPictureUrl: '',
      criticality: 'Medium',
      snagDescription: 'Fire extinguisher expired in basement parking. MEP panel door latch broken.',
      actionToBeTaken: 'Replace fire extinguishers and fix panel door latch immediately.',
      remarks: '',
      status: 'In Progress',
      submittedBy: 'Ravi Kumar',
    },
    {
      id: 'sample-3',
      timestamp: '2024-09-18T09:00:00.000Z',
      emailAddress: 'supervisor@paradigm.com',
      nameOfSite: 'Sark Grand',
      purposeOfVisit: ['Breakdown Visit'],
      department: ['House Keeping'],
      snagPictureUrl: '',
      criticality: 'Low',
      snagDescription: 'Common area carpet stains near lobby entrance. Waste bins overflowing.',
      actionToBeTaken: 'Deep clean lobby carpet and increase waste collection frequency.',
      remarks: 'Noted for monthly review',
      status: 'Resolved',
      submittedBy: 'Priya S',
    },
  ]);

  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || e.nameOfSite.toLowerCase().includes(q)
      || e.snagDescription.toLowerCase().includes(q)
      || (e.submittedBy || '').toLowerCase().includes(q);
    const matchSite = !filterSite || e.nameOfSite === filterSite;
    const matchCrit = !filterCriticality || e.criticality === filterCriticality;
    const matchDept = !filterDept || e.department.includes(filterDept as Department);
    const matchStatus = !filterStatus || e.status === filterStatus;
    let matchDate = true;
    if (dateFrom && dateTo) {
      try {
        const from = parseISO(dateFrom);
        const to = parseISO(dateTo);
        matchDate = isWithinInterval(new Date(e.timestamp), { start: from, end: to });
      } catch { matchDate = true; }
    }
    return matchSearch && matchSite && matchCrit && matchDept && matchStatus && matchDate;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = {
    total: filtered.length,
    high: filtered.filter(e => e.criticality === 'High').length,
    medium: filtered.filter(e => e.criticality === 'Medium').length,
    low: filtered.filter(e => e.criticality === 'Low').length,
    open: filtered.filter(e => e.status === 'Open').length,
    inProgress: filtered.filter(e => e.status === 'In Progress').length,
    resolved: filtered.filter(e => e.status === 'Resolved').length,
  };

  const siteNames = [...new Set(entries.map(e => e.nameOfSite))];

  const deptChart = (['MEP', 'House Keeping', 'Security', 'Landscaping', 'Fire and Safety'] as Department[]).map(d => ({
    label: d,
    value: filtered.filter(e => e.department.includes(d)).length,
    color: {
      MEP: 'bg-blue-400',
      'House Keeping': 'bg-purple-400',
      Security: 'bg-red-400',
      Landscaping: 'bg-green-400',
      'Fire and Safety': 'bg-orange-400',
    }[d] || 'bg-gray-400',
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseExcelData(text);
      if (parsed.length === 0) {
        toast.error('No data found. Ensure file is tab-separated from Google Sheets.');
      } else {
        setEntries(prev => [...parsed, ...prev]);
        toast.success(`${parsed.length} records imported`);
      }
      setImporting(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const exportCSV = () => {
    const headers = [
      'Timestamp', 'Email', 'Site Name', 'Purpose of Visit', 'Department',
      'Snag Picture', 'Criticality', 'Snag Description', 'Action To Be Taken',
      'Remarks', 'Status', 'Submitted By'
    ];
    const rows = filtered.map(e => [
      format(new Date(e.timestamp), 'dd/MM/yyyy HH:mm'),
      e.emailAddress,
      e.nameOfSite,
      e.purposeOfVisit.join('; '),
      e.department.join('; '),
      e.snagPictureUrl ? 'Attached' : '',
      e.criticality,
      e.snagDescription,
      e.actionToBeTaken,
      e.remarks || '',
      e.status,
      e.submittedBy || '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SnagReport_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported as CSV');
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearch(''); setFilterSite(''); setFilterCriticality('');
    setFilterDept(''); setFilterStatus(''); setDateFrom(''); setDateTo('');
  };

  const hasFilters = search || filterSite || filterCriticality || filterDept || filterStatus || dateFrom || dateTo;

  return (
    <div className="space-y-6 print:space-y-4 print:bg-white">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-accent" />
              Snag Report
            </h1>
            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Manager View
            </span>
          </div>
          <p className="text-muted mt-1">Consolidated site snag audit report</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <FileSpreadsheet size={15} className="mr-1.5" />}
            Import Data
          </Button>
          <input ref={importRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleImport} />
          <Button
            variant="outline"
            onClick={exportCSV}
          >
            <Download size={15} className="mr-1.5" />
            Export CSV
          </Button>
          <Button
            onClick={handlePrint}
          >
            <Printer size={15} className="mr-1.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <StatCard
          label="Total Snags"
          value={stats.total}
          textColor="text-primary-text"
        />
        <StatCard
          label="High Criticality"
          value={stats.high}
          textColor="text-red-600"
        />
        <StatCard
          label="Open Issues"
          value={stats.open}
          textColor="text-amber-600"
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          textColor="text-accent"
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4 print:hidden">
        {/* Status Breakdown */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-accent" />
            Status Breakdown
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Open', value: stats.open, total: stats.total, color: 'bg-red-400' },
              { label: 'In Progress', value: stats.inProgress, total: stats.total, color: 'bg-amber-400' },
              { label: 'Resolved', value: stats.resolved, total: stats.total, color: 'bg-green-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600 text-right">{item.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-500`}
                    style={{ width: item.total ? `${(item.value / item.total) * 100}%` : '0%' }}
                  />
                </div>
                <div className="w-8 text-xs font-bold text-gray-700">{item.value}</div>
                <div className="w-10 text-xs text-gray-400">
                  {item.total ? `${Math.round((item.value / item.total) * 100)}%` : '0%'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Building size={15} className="text-accent" />
            Department Distribution
          </h3>
          <MiniBarChart data={deptChart} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[200px] w-full">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search site, description…"
              autoCapitalizeCustom={false}
              icon={<Search size={16} />}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-auto min-w-[140px]">
            <Select
              id="filter-site"
              value={filterSite}
              onChange={e => setFilterSite(e.target.value)}
              className="w-full"
            >
              <option value="">All Sites</option>
              {siteNames.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[140px]">
            <Select
              id="filter-criticality"
              value={filterCriticality}
              onChange={e => setFilterCriticality(e.target.value)}
              className="w-full"
            >
              <option value="">All Criticality</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[160px]">
            <Select
              id="filter-dept"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full"
            >
              <option value="">All Departments</option>
              <option value="MEP">MEP</option>
              <option value="House Keeping">House Keeping</option>
              <option value="Security">Security</option>
              <option value="Landscaping">Landscaping</option>
              <option value="Fire and Safety">Fire and Safety</option>
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[140px]">
            <Select
              id="filter-status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full"
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[130px]">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-auto min-w-[130px]">
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full"
            />
          </div>
          {hasFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="text-xs border-red-500/20 text-red-500 hover:bg-red-50/50 flex items-center gap-1.5 h-11"
            >
              <X size={13} /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Report Table - Print Friendly */}
      <div ref={printRef} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          {/* Print Header */}
          <div className="hidden print:block p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-gray-800">PARADIGM SERVICES</h1>
                <h2 className="text-base font-semibold text-gray-600 mt-1">Snag Audit Report</h2>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
                <p>Total Records: {filtered.length}</p>
              </div>
            </div>
            {/* Print stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              {[
                { label: 'Total', value: stats.total },
                { label: 'High Criticality', value: stats.high },
                { label: 'Open', value: stats.open },
                { label: 'Resolved', value: stats.resolved },
              ].map(s => (
                <div key={s.label} className="border border-gray-200 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ClipboardCheck size={40} className="mb-3 opacity-30" />
                <p className="font-medium">No report data</p>
                <p className="text-sm mt-1">Adjust filters or import data</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      'Timestamp', 'Site Name', 'Department', 'Criticality',
                      'Snag Description', 'Action To Be Taken', 'Remarks', 'Status', 'Submitted By'
                    ].map(h => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((entry, i) => (
                    <ReportRow key={entry.id} entry={entry} index={i} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span>Showing {filtered.length} of {entries.length} records</span>
              <span>Report generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</span>
            </div>
          )}
        </div>

        {/* Manager Access Notice */}
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4 flex items-center gap-3 text-sm text-primary-text print:hidden">
          <Shield size={16} className="shrink-0 text-amber-600" />
          <div>
            <strong className="text-amber-800">Restricted Access:</strong> This report panel is visible to reporting managers only. 
            Use Export CSV or Print/PDF to share reports with your team.
          </div>
        </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print\\:block, .print\\:block * { visibility: visible !important; }
          table, table * { visibility: visible !important; }
          .rounded-2xl { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default SnagReportPage;
