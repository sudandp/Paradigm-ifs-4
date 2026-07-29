import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Zap,
  ShieldCheck,
  Trash2,
  Pencil,
  RotateCcw,
  RefreshCw,
  Archive,
  Check
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { opsApi } from '../../services/opsApi';
import { htYardExporter } from '../../services/htYardExporter';
import { api } from '../../services/api';
import type { SnagEntry, Criticality, Department } from '../../types';

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

// ─── Report Card (Print-friendly row with Action Buttons) ─────────────────────

const ReportRow: React.FC<{
  entry: SnagEntry;
  index: number;
  onView: (entry: SnagEntry) => void;
  onEdit: (entry: SnagEntry) => void;
  onPDF: (entry: SnagEntry) => void;
  onExcel: (entry: SnagEntry) => void;
  onDelete: (entry: SnagEntry) => void;
}> = ({ entry, index, onView, onEdit, onPDF, onExcel, onDelete }) => (
  <tr className={index % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
    <td className="px-3 py-3 text-xs text-muted whitespace-nowrap font-mono">
      {format(new Date(entry.timestamp), 'dd/MM/yy HH:mm')}
    </td>
    <td className="px-3 py-3">
      <div className="font-bold text-primary-text text-sm">{entry.nameOfSite}</div>
      <div className="text-xs text-muted">{entry.purposeOfVisit.join(', ')}</div>
    </td>
    <td className="px-3 py-3">
      <div className="flex flex-wrap gap-1">
        {entry.department.map(d => (
          <span key={d} className={`text-xs px-2 py-0.5 rounded font-bold ${DEPT_COLORS[d] ?? 'bg-slate-100 text-slate-700'}`}>
            {d}
          </span>
        ))}
      </div>
    </td>
    <td className="px-3 py-3">
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${CRITICALITY_COLOR[entry.criticality]}`}>
        <AlertTriangle size={10} />
        {entry.criticality}
      </span>
    </td>
    <td className="px-3 py-3 text-xs text-primary-text max-w-xs font-medium">
      <p className="line-clamp-2">{entry.snagDescription}</p>
    </td>
    <td className="px-3 py-3 text-xs text-muted max-w-xs">
      <p className="line-clamp-3">{entry.actionToBeTaken}</p>
    </td>
    <td className="px-3 py-3 text-xs text-muted">{entry.remarks || '—'}</td>
    <td className="px-3 py-3">
      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${STATUS_COLOR[entry.status] ?? 'bg-slate-100 text-slate-700'}`}>
        {entry.status}
      </span>
    </td>
    <td className="px-3 py-3 text-xs text-muted font-medium">{entry.submittedBy || entry.emailAddress}</td>
    <td className="px-3 py-3 text-right whitespace-nowrap print:hidden">
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => onView(entry)}
          className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-xl transition-colors"
          title="View Snag Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEdit(entry)}
          className="p-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-xl transition-colors"
          title="Edit Snag Entry"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPDF(entry)}
          className="p-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/40 text-red-700 dark:text-red-300 rounded-xl transition-colors"
          title="Export PDF Report"
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          onClick={() => onExcel(entry)}
          className="p-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 rounded-xl transition-colors"
          title="Export Excel Report"
        >
          <FileSpreadsheet className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(entry)}
          className="p-2 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-800/40 text-rose-700 dark:text-rose-300 rounded-xl transition-colors"
          title="Move to Deleted Logs (Recycle Bin)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SnagReportPage: React.FC = () => {
  const today = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = (searchParams.get('tab') as 'snag' | 'site' | 'ppm') || 'snag';

  const setActiveTab = (tab: 'snag' | 'site' | 'ppm') => {
    setSearchParams({ tab });
  };

  // Site Audit Reports state
  const [siteAudits, setSiteAudits] = useState<any[]>([]);
  const [loadingSiteAudits, setLoadingSiteAudits] = useState(false);

  const fetchSiteAudits = useCallback(async () => {
    setLoadingSiteAudits(true);
    try {
      const data = await api.getAllHTYardAudits();
      setSiteAudits(data || []);
    } catch (err) {
      console.warn('Failed to load site audits list:', err);
    } finally {
      setLoadingSiteAudits(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'site') {
      fetchSiteAudits();
    }
  }, [activeTab, fetchSiteAudits]);

  const [entries, setEntries] = useState<SnagEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // View Details Modal state
  const [viewingSnagEntry, setViewingSnagEntry] = useState<SnagEntry | null>(null);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);

  const handleOpenViewSnag = (entry: SnagEntry) => {
    setViewingSnagEntry(entry);
    setShowViewModal(true);
  };

  // Helper functions for single item exports
  const exportSnagToPDF = (entry: SnagEntry) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Paradigm Services - Snag Audit Report', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Report Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    doc.line(14, 30, 196, 30);

    autoTable(doc, {
      startY: 35,
      head: [['Field', 'Details']],
      body: [
        ['Site Name', entry.nameOfSite],
        ['Submitted By', entry.submittedBy || entry.emailAddress],
        ['Criticality', entry.criticality],
        ['Status', entry.status],
        ['Timestamp', format(new Date(entry.timestamp), 'dd MMM yyyy, hh:mm a')],
        ['Department(s)', entry.department.join(', ')],
        ['Snag Description', entry.snagDescription],
        ['Action Suggested', entry.actionToBeTaken || '—'],
        ['Remarks', entry.remarks || '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9] }, // Amber
    });

    doc.save(`Snag_Report_${entry.nameOfSite.replace(/\s+/g, '_')}_${entry.id}.pdf`);
    toast.success('Snag PDF Report downloaded!');
  };

  const exportSnagToExcel = async (entry: SnagEntry) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Snag Detail');

    sheet.columns = [
      { header: 'Property / Field', key: 'field', width: 25 },
      { header: 'Detail Value', key: 'value', width: 50 }
    ];

    sheet.addRows([
      { field: 'Site Name', value: entry.nameOfSite },
      { field: 'Submitted By', value: entry.submittedBy || entry.emailAddress },
      { field: 'Criticality', value: entry.criticality },
      { field: 'Status', value: entry.status },
      { field: 'Date', value: format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm') },
      { field: 'Departments', value: entry.department.join(', ') },
      { field: 'Description', value: entry.snagDescription },
      { field: 'Action Suggested', value: entry.actionToBeTaken || 'N/A' },
      { field: 'Remarks', value: entry.remarks || 'N/A' }
    ]);

    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D97706' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Snag_Report_${entry.nameOfSite.replace(/\s+/g, '_')}_${entry.id}.xlsx`);
    toast.success('Snag Excel Report downloaded!');
  };

  const exportPPMToPDF = (ppm: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Paradigm Services - PPM Audit Report', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Report Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    doc.line(14, 30, 196, 30);

    autoTable(doc, {
      startY: 35,
      head: [['Field', 'Details']],
      body: [
        ['Schedule ID', ppm.id],
        ['Site Name', ppm.site],
        ['Equipment Type', ppm.type],
        ['Frequency', ppm.freq],
        ['Scheduled Date', ppm.date],
        ['Technician', ppm.tech],
        ['Status', ppm.status],
        ['Remarks', ppm.remarks || '—']
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo
    });

    doc.save(`PPM_Report_${ppm.site.replace(/\s+/g, '_')}_${ppm.id}.pdf`);
    toast.success('PPM PDF Report downloaded!');
  };

  const exportPPMToExcel = async (ppm: any) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PPM Detail');

    sheet.columns = [
      { header: 'Property / Field', key: 'field', width: 25 },
      { header: 'Detail Value', key: 'value', width: 50 }
    ];

    sheet.addRows([
      { field: 'Schedule ID', value: ppm.id },
      { field: 'Site Name', value: ppm.site },
      { field: 'Equipment Type', value: ppm.type },
      { field: 'Frequency', value: ppm.freq },
      { field: 'Scheduled Date', value: ppm.date },
      { field: 'Technician', value: ppm.tech },
      { field: 'Status', value: ppm.status },
      { field: 'Remarks', value: ppm.remarks || 'N/A' }
    ]);

    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `PPM_Report_${ppm.site.replace(/\s+/g, '_')}_${ppm.id}.xlsx`);
    toast.success('PPM Excel Report downloaded!');
  };

  // PPM Audits list state
  const [ppmAudits, setPpmAudits] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paradigm_ppm_audits_list');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [
      { id: 'PPM-2026-001', site: 'Nikoo Heights', type: 'HT Breaker / RMU', freq: 'Quarterly', date: '2026-07-25', tech: 'Suresh Kumar', status: 'Completed', remarks: 'All contact resistance tests passed.' },
      { id: 'PPM-2026-002', site: 'Sark 2 Villas', type: 'Transformer Oil BDV', freq: 'Half-Yearly', date: '2026-07-20', tech: 'Nithin Gowda', status: 'Completed', remarks: 'BDV value is 45kV. Healthy.' },
      { id: 'PPM-2026-003', site: 'Embassy TechVillage', type: 'LT Panel & MCCB', freq: 'Monthly', date: '2026-07-29', tech: 'Ravi Kumar', status: 'In Progress', remarks: 'Main busbar torque check pending.' },
    ];
  });

  const savePpmAudits = (list: any[]) => {
    setPpmAudits(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_ppm_audits_list', JSON.stringify(list));
    }
  };

  // PPM Edit / View state
  const [editingPPM, setEditingPPM] = useState<any | null>(null);
  const [showPPMEditModal, setShowPPMEditModal] = useState<boolean>(false);
  const [viewingPPM, setViewingPPM] = useState<any | null>(null);
  const [showPPMViewModal, setShowPPMViewModal] = useState<boolean>(false);

  const [deletedPpmLogs, setDeletedPpmLogs] = useState<(any & { deletedAt: string })[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paradigm_deleted_ppm_log');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  });

  // PPM Handlers
  const handleDeletePPM = (ppm: any) => {
    const deletedRecord = {
      ...ppm,
      deletedAt: new Date().toISOString()
    };
    const updatedLogs = [deletedRecord, ...deletedPpmLogs];
    setDeletedPpmLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_ppm_log', JSON.stringify(updatedLogs));
    }

    const newList = ppmAudits.filter(p => p.id !== ppm.id);
    savePpmAudits(newList);
    toast.success(`PPM schedule "${ppm.id}" moved to Deleted Logs`);
  };

  const handleRestorePpm = (deletedItem: any) => {
    const { deletedAt, ...rest } = deletedItem;
    savePpmAudits([rest, ...ppmAudits]);

    const updatedLogs = deletedPpmLogs.filter(p => p.id !== deletedItem.id);
    setDeletedPpmLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_ppm_log', JSON.stringify(updatedLogs));
    }
    toast.success(`Restored PPM schedule "${rest.id}" back to active list!`);
  };

  const handlePermanentDeletePpm = (id: string) => {
    const updatedLogs = deletedPpmLogs.filter(p => p.id !== id);
    setDeletedPpmLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_ppm_log', JSON.stringify(updatedLogs));
    }
    toast.success('Permanently deleted PPM log.');
  };

  const handleSavePPMEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPPM) return;
    const updatedList = ppmAudits.map(p => p.id === editingPPM.id ? editingPPM : p);
    savePpmAudits(updatedList);
    toast.success('PPM schedule updated successfully!');
    setShowPPMEditModal(false);
    setEditingPPM(null);
  };

  // Edit & Deleted Logs state
  const [editingSnag, setEditingSnag] = useState<SnagEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [deletedSnagLogs, setDeletedSnagLogs] = useState<(SnagEntry & { deletedAt: string })[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paradigm_deleted_snags_log');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  });

  const [deletedSiteAuditLogs, setDeletedSiteAuditLogs] = useState<(any & { deletedAt: string })[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paradigm_deleted_site_audits_log');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  });

  const [showDeletedLogsModal, setShowDeletedLogsModal] = useState<boolean>(false);
  const [deletedLogsTab, setDeletedLogsTab] = useState<'snag' | 'site' | 'ppm'>('snag');

  // Delete & Restore Snag handlers
  const handleDeleteSnag = async (entry: SnagEntry) => {
    const deletedRecord = {
      ...entry,
      deletedAt: new Date().toISOString()
    };
    const updatedLogs = [deletedRecord, ...deletedSnagLogs];
    setDeletedSnagLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_snags_log', JSON.stringify(updatedLogs));
    }

    setEntries(prev => prev.filter(e => e.id !== entry.id));

    try {
      if (entry.id && !entry.id.startsWith('sample-') && !entry.id.startsWith('snag-rpt-')) {
        await opsApi.deleteSnagEntry(entry.id);
      }
    } catch (err) {
      console.warn('Backend delete failed, removed locally:', err);
    }
    toast.success(`Moved snag entry "${entry.nameOfSite}" to Deleted Logs (Recycle Bin)`);
  };

  const handleRestoreSnag = async (deletedItem: SnagEntry & { deletedAt: string }) => {
    const { deletedAt, ...rest } = deletedItem;
    try {
      await opsApi.saveSnagEntry(rest);
    } catch (err) {
      console.warn('Backend restore save fallback:', err);
    }
    setEntries(prev => [rest, ...prev]);

    const updatedDeletedLogs = deletedSnagLogs.filter(d => d.id !== deletedItem.id);
    setDeletedSnagLogs(updatedDeletedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_snags_log', JSON.stringify(updatedDeletedLogs));
    }
    toast.success(`Restored "${rest.nameOfSite}" snag entry back to active report!`);
  };

  const handlePermanentDeleteSnag = async (id: string) => {
    const updatedDeletedLogs = deletedSnagLogs.filter(d => d.id !== id);
    setDeletedSnagLogs(updatedDeletedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_snags_log', JSON.stringify(updatedDeletedLogs));
    }
    try {
      if (id && !id.startsWith('sample-') && !id.startsWith('snag-rpt-')) {
        await opsApi.deleteSnagEntry(id);
      }
    } catch (err) {
      console.warn('Backend permanent delete error:', err);
    }
    toast.success('Permanently deleted snag entry.');
  };

  // Delete & Restore Site Audit handlers
  const handleDeleteSiteAudit = async (item: any) => {
    const auditId = item.activeAudit?.id;
    const deletedRecord = {
      ...item,
      deletedAt: new Date().toISOString()
    };
    const updatedLogs = [deletedRecord, ...deletedSiteAuditLogs];
    setDeletedSiteAuditLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_site_audits_log', JSON.stringify(updatedLogs));
    }

    setSiteAudits(prev => prev.filter(s => s.activeAudit?.id !== auditId));

    if (auditId) {
      try {
        await api.deleteHTYardAudit(auditId);
      } catch (err) {
        console.warn('Backend delete site audit error:', err);
      }
    }
    toast.success(`Moved site audit "${item.activeAudit?.siteName || 'Audit'}" to Deleted Logs`);
  };

  const handleRestoreSiteAudit = async (deletedItem: any) => {
    const { deletedAt, ...auditData } = deletedItem;
    try {
      await api.saveHTYardAudit(auditData);
    } catch (err) {
      console.warn('Backend restore site audit error:', err);
    }
    setSiteAudits(prev => [auditData, ...prev]);

    const updatedLogs = deletedSiteAuditLogs.filter(s => s.activeAudit?.id !== auditData.activeAudit?.id);
    setDeletedSiteAuditLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_site_audits_log', JSON.stringify(updatedLogs));
    }
    toast.success(`Restored site audit "${auditData.activeAudit?.siteName}" successfully!`);
  };

  const handlePermanentDeleteSiteAudit = async (auditId: string) => {
    const updatedLogs = deletedSiteAuditLogs.filter(s => s.activeAudit?.id !== auditId);
    setDeletedSiteAuditLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_deleted_site_audits_log', JSON.stringify(updatedLogs));
    }
    try {
      await api.deleteHTYardAudit(auditId);
    } catch (err) {}
    toast.success('Permanently deleted site audit report.');
  };

  // Edit Snag Handler
  const handleOpenEditSnag = (entry: SnagEntry) => {
    setEditingSnag({ ...entry });
    setShowEditModal(true);
  };

  const handleSaveEditedSnag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSnag) return;
    setIsSavingEdit(true);
    try {
      const updated = await opsApi.saveSnagEntry(editingSnag);
      setEntries(prev => prev.map(item => item.id === editingSnag.id ? { ...editingSnag, ...updated } : item));
      toast.success('Snag audit entry updated successfully!');
      setShowEditModal(false);
      setEditingSnag(null);
    } catch (err) {
      console.error('Failed to update snag entry:', err);
      setEntries(prev => prev.map(item => item.id === editingSnag.id ? editingSnag : item));
      toast.success('Updated snag entry locally!');
      setShowEditModal(false);
      setEditingSnag(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await opsApi.getSnagEntries();
      if (data.length > 0) {
        setEntries(data);
      } else {
        // Fallback mock entries
        setEntries([
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
      }
    } catch (err) {
      console.error('Failed to load snag entries for report:', err);
      toast.error('Failed to load snag data from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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
    reader.onload = async ev => {
      const text = ev.target?.result as string;
      const parsed = parseExcelData(text);
      if (parsed.length === 0) {
        toast.error('No data found. Ensure file is tab-separated from Google Sheets.');
      } else {
        try {
          let count = 0;
          for (const item of parsed) {
            const { id, ...saveItem } = item;
            await opsApi.saveSnagEntry(saveItem);
            count++;
          }
          toast.success(`${count} records imported and saved to Supabase successfully`);
          fetchEntries();
        } catch (err) {
          console.error('Failed to save imported entries:', err);
          toast.error('Failed to save some imported snag entries.');
          setEntries(prev => [...parsed, ...prev]);
        }
      }
      setImporting(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [fetchEntries]);

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
      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 w-fit print:hidden">
        <button
          onClick={() => setActiveTab('snag')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'snag'
              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" /> Snag Audit Report
        </button>

        <button
          onClick={() => setActiveTab('site')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'site'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-500" /> Site Audit Report
        </button>

        <button
          onClick={() => setActiveTab('ppm')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ppm'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-500" /> PPM Audit Report
        </button>
      </div>

      {/* ─── TAB 1: SNAG AUDIT REPORT ────────────────────────────────────────── */}
      {activeTab === 'snag' && (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-accent" />
                  Snag Audit Report
                </h1>
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Manager View
                </span>
              </div>
              <p className="text-muted mt-1">Consolidated site snag audit report & defect log</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeletedLogsModal(true)}
                className="border-red-200 text-red-700 hover:bg-red-50 relative font-bold"
              >
                <Trash2 size={15} className="mr-1.5 text-red-600" />
                Deleted Logs
                {(deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black bg-red-600 text-white rounded-full">
                    {deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length}
                  </span>
                )}
              </Button>
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

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-teal-600 gap-3 bg-card rounded-xl border border-border shadow-sm print:hidden">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-semibold">Loading snag report data from Supabase...</p>
        </div>
      ) : (
        <>
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
                      'Snag Description', 'Action To Be Taken', 'Remarks', 'Status', 'Submitted By', 'Actions'
                    ].map(h => (
                      <th
                        key={h}
                        className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((entry, i) => (
                    <ReportRow
                      key={entry.id}
                      entry={entry}
                      index={i}
                      onView={handleOpenViewSnag}
                      onEdit={handleOpenEditSnag}
                      onPDF={exportSnagToPDF}
                      onExcel={exportSnagToExcel}
                      onDelete={handleDeleteSnag}
                    />
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
        </>
      )}
        </div>
      )}

      {/* ─── TAB 2: SITE AUDIT REPORT ────────────────────────────────────────── */}
      {activeTab === 'site' && (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
                  <Zap className="h-6 w-6 text-emerald-500" />
                  Site Audit Report
                </h1>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  HT Yard & Site Take-Over Reports
                </span>
              </div>
              <p className="text-muted mt-1">Completed site audits, equipment checklists, and inspection observations log</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeletedLogsTab('site');
                  setShowDeletedLogsModal(true);
                }}
                className="border-red-200 text-red-700 hover:bg-red-50 relative font-bold"
              >
                <Trash2 size={15} className="mr-1.5 text-red-600" />
                Deleted Logs
                {(deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black bg-red-600 text-white rounded-full">
                    {deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length}
                  </span>
                )}
              </Button>
              <Button onClick={() => navigate('/operations/ht-yard-audits')}>
                <Zap size={15} className="mr-1.5" /> + New Site Audit
              </Button>
            </div>
          </div>

          {/* Site Audit Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Site Audits"
              value={siteAudits.length}
              textColor="text-primary-text"
            />
            <StatCard
              label="Approved Audits"
              value={siteAudits.filter(a => a.activeAudit?.status === 'Approved').length}
              textColor="text-emerald-600"
            />
            <StatCard
              label="Draft Audits"
              value={siteAudits.filter(a => a.activeAudit?.status === 'Draft' || !a.activeAudit?.status).length}
              textColor="text-amber-600"
            />
            <StatCard
              label="Total Recorded Snags"
              value={siteAudits.reduce((acc, curr) => acc + (curr.snagItems?.length || 0), 0)}
              textColor="text-red-600"
            />
          </div>

          {/* Site Audit List Table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-base font-extrabold text-primary-text flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-500" />
                Completed Site Audit Log
              </h2>
              <span className="text-xs text-muted font-bold">
                {siteAudits.length} Audit Records Found
              </span>
            </div>

            {loadingSiteAudits ? (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span>Loading site audit reports...</span>
              </div>
            ) : siteAudits.length === 0 ? (
              <div className="p-12 text-center text-muted">
                <p className="font-semibold text-sm">No site audit reports recorded yet.</p>
                <p className="text-xs mt-1">Complete a site audit in the Site Audit section to see reports here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-muted/40 font-bold text-muted border-b border-border">
                    <tr>
                      <th className="p-3.5">Reference No.</th>
                      <th className="p-3.5">Site Name</th>
                      <th className="p-3.5">Audit Date</th>
                      <th className="p-3.5">Division / Client</th>
                      <th className="p-3.5">Equipment Units</th>
                      <th className="p-3.5">Open Snags</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {siteAudits.map((item, idx) => {
                      const audit = item.activeAudit || {};
                      const instances = item.equipmentInstances || [];
                      const snags = item.snagItems || [];
                      return (
                        <tr key={audit.id || idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {audit.referenceNumber || 'HT-AUD-7520'}
                          </td>
                          <td className="p-3.5 font-bold text-primary-text text-sm">
                            {audit.siteName || 'Nikoo'}
                          </td>
                          <td className="p-3.5 font-medium text-muted">
                            {audit.auditDate || '2026-07-28'}
                          </td>
                          <td className="p-3.5 font-semibold text-primary-text">
                            {audit.clientDivision || 'Nikoo'}
                          </td>
                          <td className="p-3.5 font-semibold">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                              {instances.length} Units
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${snags.length > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600'}`}>
                              {snags.length} Snags
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${audit.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {audit.status || 'Draft'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap print:hidden">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => navigate(`/operations/ht-yard-audits?auditId=${audit.id}`)}
                                className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-xl transition-colors"
                                title="View Audit Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/operations/ht-yard-audits?auditId=${audit.id}`)}
                                className="p-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-xl transition-colors"
                                title="Edit Audit Details"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => htYardExporter.exportToPDF(audit, instances, item.responses || {}, snags)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors"
                                title="Export PDF Report"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => htYardExporter.exportToExcel(audit, instances, item.responses || {}, snags)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                                title="Export Excel Report"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSiteAudit(item)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors"
                                title="Move to Deleted Logs (Recycle Bin)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: PPM AUDIT REPORT ────────────────────────────────────────── */}
      {activeTab === 'ppm' && (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-indigo-500" />
                  PPM Audit Report
                </h1>
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Planned Preventive Maintenance Log
                </span>
              </div>
              <p className="text-muted mt-1">Preventive maintenance logs, equipment servicing records, and scheduled maintenance reports</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeletedLogsTab('ppm');
                  setShowDeletedLogsModal(true);
                }}
                className="border-red-200 text-red-700 hover:bg-red-50 relative font-bold"
              >
                <Trash2 size={15} className="mr-1.5 text-red-600" />
                Deleted Logs
                {(deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black bg-red-600 text-white rounded-full">
                    {deletedSnagLogs.length + deletedSiteAuditLogs.length + deletedPpmLogs.length}
                  </span>
                )}
              </Button>
              <Button onClick={() => navigate('/operations/ppm-audits')}>
                <ShieldCheck size={15} className="mr-1.5" /> Go to PPM Audits Section
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total PPM Schedules" value={ppmAudits.length} textColor="text-primary-text" />
            <StatCard label="Completed PPMs" value={ppmAudits.filter(p => p.status === 'Completed').length} textColor="text-emerald-600" />
            <StatCard label="Pending PPMs" value={ppmAudits.filter(p => p.status !== 'Completed').length} textColor="text-amber-600" />
            <StatCard label="Overdue" value={ppmAudits.filter(p => new Date(p.date) < new Date() && p.status !== 'Completed').length} textColor="text-red-600" />
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-base font-extrabold text-primary-text flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                Preventive Maintenance Log
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/40 font-bold text-muted border-b border-border">
                  <tr>
                    <th className="p-3.5">Schedule ID</th>
                    <th className="p-3.5">Site Name</th>
                    <th className="p-3.5">Equipment Type</th>
                    <th className="p-3.5">Frequency</th>
                    <th className="p-3.5">Scheduled Date</th>
                    <th className="p-3.5">Technician</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ppmAudits.map((ppm) => (
                    <tr key={ppm.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{ppm.id}</td>
                      <td className="p-3.5 font-bold text-primary-text">{ppm.site}</td>
                      <td className="p-3.5 font-medium">{ppm.type}</td>
                      <td className="p-3.5"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-bold text-slate-700 dark:text-slate-300">{ppm.freq}</span></td>
                      <td className="p-3.5 font-medium text-muted">{ppm.date}</td>
                      <td className="p-3.5 font-semibold text-primary-text">{ppm.tech}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${ppm.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {ppm.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setViewingPPM(ppm);
                              setShowPPMViewModal(true);
                            }}
                            className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-xl transition-colors"
                            title="View PPM Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPPM(ppm);
                              setShowPPMEditModal(true);
                            }}
                            className="p-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-xl transition-colors"
                            title="Edit PPM Details"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportPPMToPDF(ppm)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors"
                            title="Export PDF Report"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportPPMToExcel(ppm)}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                            title="Export Excel Report"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePPM(ppm)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors"
                            title="Move to Deleted Logs (Recycle Bin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW DETAILS MODAL ────────────────────────────────────────── */}
      {showViewModal && viewingSnagEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <div>
                  <h2 className="text-lg font-bold">Snag Audit Entry Details</h2>
                  <p className="text-xs text-slate-400">{viewingSnagEntry.nameOfSite} • {format(new Date(viewingSnagEntry.timestamp), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Criticality</span>
                  <span className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold border ${CRITICALITY_COLOR[viewingSnagEntry.criticality]}`}>
                    {viewingSnagEntry.criticality}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold ${STATUS_COLOR[viewingSnagEntry.status]}`}>
                    {viewingSnagEntry.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Submitted By</span>
                  <span className="font-bold text-primary-text block mt-1">{viewingSnagEntry.submittedBy || viewingSnagEntry.emailAddress}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Purpose of Visit</span>
                  <span className="font-bold text-primary-text block mt-1">{viewingSnagEntry.purposeOfVisit.join(', ')}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-muted uppercase block mb-1">Departments Concerned</span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingSnagEntry.department.map(d => (
                    <span key={d} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${DEPT_COLORS[d] ?? 'bg-slate-100 text-slate-700'}`}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted uppercase block">Snag Description</span>
                <div className="p-3.5 bg-card rounded-xl border border-border text-primary-text font-medium leading-relaxed">
                  {viewingSnagEntry.snagDescription}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted uppercase block">Required Action To Be Taken</span>
                <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-primary-text font-medium leading-relaxed">
                  {viewingSnagEntry.actionToBeTaken || 'No action specified.'}
                </div>
              </div>

              {viewingSnagEntry.remarks && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block">Remarks</span>
                  <div className="p-3 bg-muted/30 rounded-xl border border-border text-muted font-medium">
                    {viewingSnagEntry.remarks}
                  </div>
                </div>
              )}

              {viewingSnagEntry.snagPictureUrl && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block">Attached Photo Evidence</span>
                  <img
                    src={viewingSnagEntry.snagPictureUrl}
                    alt="Snag Evidence"
                    className="max-h-60 rounded-xl border border-border object-cover shadow-sm"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenEditSnag(viewingSnagEntry);
                }}
                className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 font-bold"
              >
                <Pencil className="w-4 h-4 mr-1.5" /> Edit This Entry
              </Button>

              <Button onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT SNAG MODAL ────────────────────────────────────────── */}
      {showEditModal && editingSnag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold">Edit Snag Audit Entry</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedSnag} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-1">Site Name</label>
                  <Input
                    value={editingSnag.nameOfSite}
                    onChange={e => setEditingSnag({ ...editingSnag, nameOfSite: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-1">Submitted By</label>
                  <Input
                    value={editingSnag.submittedBy || ''}
                    onChange={e => setEditingSnag({ ...editingSnag, submittedBy: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-1">Criticality</label>
                  <Select
                    value={editingSnag.criticality}
                    onChange={e => setEditingSnag({ ...editingSnag, criticality: e.target.value as Criticality })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-1">Status</label>
                  <Select
                    value={editingSnag.status}
                    onChange={e => setEditingSnag({ ...editingSnag, status: e.target.value as any })}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase mb-1">Snag Description</label>
                <textarea
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  value={editingSnag.snagDescription}
                  onChange={e => setEditingSnag({ ...editingSnag, snagDescription: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase mb-1">Action To Be Taken</label>
                <textarea
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  value={editingSnag.actionToBeTaken}
                  onChange={e => setEditingSnag({ ...editingSnag, actionToBeTaken: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase mb-1">Remarks</label>
                <Input
                  value={editingSnag.remarks || ''}
                  onChange={e => setEditingSnag({ ...editingSnag, remarks: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETED LOGS / RECYCLE BIN MODAL ────────────────────────── */}
      {showDeletedLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <div>
                  <h2 className="text-lg font-extrabold">Deleted Items Log & Recycle Bin</h2>
                  <p className="text-xs text-slate-400">Restore accidentally deleted audit reports or clear logs</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeletedLogsModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Switcher inside Modal */}
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex-wrap">
                <button
                  onClick={() => setDeletedLogsTab('snag')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    deletedLogsTab === 'snag'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Deleted Snags ({deletedSnagLogs.length})
                </button>
                <button
                  onClick={() => setDeletedLogsTab('site')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    deletedLogsTab === 'site'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 text-emerald-500" />
                  Deleted Site Audits ({deletedSiteAuditLogs.length})
                </button>
                <button
                  onClick={() => setDeletedLogsTab('ppm')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    deletedLogsTab === 'ppm'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Deleted PPMs ({deletedPpmLogs.length})
                </button>
              </div>

              {(deletedLogsTab === 'snag' ? deletedSnagLogs.length : deletedLogsTab === 'site' ? deletedSiteAuditLogs.length : deletedPpmLogs.length) > 0 && (
                <button
                  onClick={() => {
                    if (deletedLogsTab === 'snag') {
                      setDeletedSnagLogs([]);
                      localStorage.removeItem('paradigm_deleted_snags_log');
                    } else if (deletedLogsTab === 'site') {
                      setDeletedSiteAuditLogs([]);
                      localStorage.removeItem('paradigm_deleted_site_audits_log');
                    } else {
                      setDeletedPpmLogs([]);
                      localStorage.removeItem('paradigm_deleted_ppm_log');
                    }
                    toast.success('Emptied trash log');
                  }}
                  className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Empty Log
                </button>
              )}
            </div>

            {/* Modal Content Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {deletedLogsTab === 'snag' ? (
                deletedSnagLogs.length === 0 ? (
                  <div className="py-16 text-center text-muted">
                    <Archive className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm">No deleted snag items in trash.</p>
                    <p className="text-xs mt-1 text-muted">Deleted snag audit entries will appear here for easy restoration.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 font-bold text-muted border-b border-border">
                        <tr>
                          <th className="p-3">Deleted Date</th>
                          <th className="p-3">Site Name</th>
                          <th className="p-3">Criticality</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Restore / Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {deletedSnagLogs.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="p-3 font-mono text-muted">
                              {format(new Date(item.deletedAt), 'dd/MM/yy HH:mm')}
                            </td>
                            <td className="p-3 font-bold text-primary-text">{item.nameOfSite}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${CRITICALITY_COLOR[item.criticality]}`}>
                                {item.criticality}
                              </span>
                            </td>
                            <td className="p-3 text-muted max-w-xs truncate">{item.snagDescription}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleRestoreSnag(item)}
                                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDeleteSnag(item.id)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                Delete Permanent
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : deletedLogsTab === 'site' ? (
                deletedSiteAuditLogs.length === 0 ? (
                  <div className="py-16 text-center text-muted">
                    <Archive className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm">No deleted site audit reports in trash.</p>
                    <p className="text-xs mt-1 text-muted">Deleted site audits will appear here for easy restoration.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 font-bold text-muted border-b border-border">
                        <tr>
                          <th className="p-3">Deleted Date</th>
                          <th className="p-3">Reference No.</th>
                          <th className="p-3">Site Name</th>
                          <th className="p-3">Client / Division</th>
                          <th className="p-3 text-right">Restore / Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {deletedSiteAuditLogs.map((item, idx) => (
                          <tr key={item.activeAudit?.id || idx} className="hover:bg-muted/20">
                            <td className="p-3 font-mono text-muted">
                              {format(new Date(item.deletedAt), 'dd/MM/yy HH:mm')}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-600">
                              {item.activeAudit?.referenceNumber}
                            </td>
                            <td className="p-3 font-bold text-primary-text">
                              {item.activeAudit?.siteName}
                            </td>
                            <td className="p-3 text-muted">{item.activeAudit?.clientDivision}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleRestoreSiteAudit(item)}
                                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDeleteSiteAudit(item.activeAudit?.id)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                Delete Permanent
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                deletedPpmLogs.length === 0 ? (
                  <div className="py-16 text-center text-muted">
                    <Archive className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm">No deleted PPM schedules in trash.</p>
                    <p className="text-xs mt-1 text-muted">Deleted PPM records will appear here for easy restoration.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 font-bold text-muted border-b border-border">
                        <tr>
                          <th className="p-3">Deleted Date</th>
                          <th className="p-3">Schedule ID</th>
                          <th className="p-3">Site Name</th>
                          <th className="p-3">Equipment Type</th>
                          <th className="p-3 text-right">Restore / Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {deletedPpmLogs.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="p-3 font-mono text-muted">
                              {format(new Date(item.deletedAt), 'dd/MM/yy HH:mm')}
                            </td>
                            <td className="p-3 font-mono font-bold text-indigo-600">{item.id}</td>
                            <td className="p-3 font-bold text-primary-text">{item.site}</td>
                            <td className="p-3 text-muted">{item.type}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleRestorePpm(item)}
                                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDeletePpm(item.id)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl text-xs transition-colors"
                              >
                                Delete Permanent
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PPM VIEW MODAL ────────────────────────────────────────── */}
      {showPPMViewModal && viewingPPM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-lg font-bold">PPM Schedule Details</h2>
                  <p className="text-xs text-slate-400">{viewingPPM.id} • {viewingPPM.site}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPPMViewModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Frequency</span>
                  <span className="px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-block">
                    {viewingPPM.freq}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold ${
                    viewingPPM.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {viewingPPM.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Scheduled Date</span>
                  <span className="font-bold text-primary-text block mt-1">{viewingPPM.date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted uppercase block">Technician</span>
                  <span className="font-bold text-primary-text block mt-1">{viewingPPM.tech}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted uppercase block">Equipment Type</span>
                <div className="p-3.5 bg-card rounded-xl border border-border text-primary-text font-semibold">
                  {viewingPPM.type}
                </div>
              </div>

              {viewingPPM.remarks && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block">Remarks & Observations</span>
                  <div className="p-3.5 bg-muted/30 rounded-xl border border-border text-muted font-medium">
                    {viewingPPM.remarks}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPPMViewModal(false);
                  setEditingPPM(viewingPPM);
                  setShowPPMEditModal(true);
                }}
                className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 font-bold"
              >
                <Pencil className="w-4 h-4 mr-1.5" /> Edit This PPM
              </Button>

              <Button onClick={() => setShowPPMViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PPM EDIT MODAL ────────────────────────────────────────── */}
      {showPPMEditModal && editingPPM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold">Edit PPM Schedule</h2>
              </div>
              <button
                onClick={() => setShowPPMEditModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePPMEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Site Name</label>
                  <Input
                    value={editingPPM.site}
                    onChange={e => setEditingPPM({ ...editingPPM, site: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Equipment Type</label>
                  <Input
                    value={editingPPM.type}
                    onChange={e => setEditingPPM({ ...editingPPM, type: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Frequency</label>
                  <Select
                    value={editingPPM.freq}
                    onChange={e => setEditingPPM({ ...editingPPM, freq: e.target.value })}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Annual">Annual</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Scheduled Date</label>
                  <Input
                    type="date"
                    value={editingPPM.date}
                    onChange={e => setEditingPPM({ ...editingPPM, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Status</label>
                  <Select
                    value={editingPPM.status}
                    onChange={e => setEditingPPM({ ...editingPPM, status: e.target.value })}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase">Technician Name</label>
                <Input
                  value={editingPPM.tech}
                  onChange={e => setEditingPPM({ ...editingPPM, tech: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase">Remarks & Observations</label>
                <textarea
                  value={editingPPM.remarks || ''}
                  onChange={e => setEditingPPM({ ...editingPPM, remarks: e.target.value })}
                  className="w-full min-h-[100px] bg-card border border-border rounded-xl p-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all text-primary-text"
                  placeholder="Enter notes..."
                />
              </div>

              <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2 -mx-6 -mb-6 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowPPMEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
