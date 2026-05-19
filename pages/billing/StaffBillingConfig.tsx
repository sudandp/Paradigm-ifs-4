import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import { calculatePerDayRate, SiteStaffConfig } from '../../utils/siteStaffCalculations';
import StaffConfigEditor from '../../components/billing/StaffConfigEditor';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import {
  Search, Edit2, CheckCircle, AlertCircle, Loader2, Download, Upload,
  Users, IndianRupee, Filter, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';

interface StaffRow {
  userId: string;
  name: string;
  role: string;
  siteName: string;
  siteId: string;
  config: any | null;
}

const StaffBillingConfig: React.FC = () => {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'configured' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor modal
  const [editingUser, setEditingUser] = useState<StaffRow | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Import
  const [isImporting, setIsImporting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, configsRes, sitesRes] = await Promise.all([
        api.getUsers({ fetchAll: true, sortBy: 'name', sortAscending: true }),
        api.getAllSiteStaffConfigs(),
        api.getOrganizations(),
      ]);
      const usersList = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
      setAllUsers(usersList);
      setAllConfigs(configsRes);
      setSites(sitesRes);
    } catch (err) {
      console.error('Failed to load data:', err);
      setToast({ message: 'Failed to load staff data.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Build config map by userId
  const configMap = useMemo(() => {
    const map: Record<string, any> = {};
    allConfigs.forEach(c => { map[c.userId] = c; });
    return map;
  }, [allConfigs]);

  // Build site name map
  const siteMap = useMemo(() => {
    const map: Record<string, string> = {};
    sites.forEach(s => { map[s.id] = s.shortName || s.name || ''; });
    return map;
  }, [sites]);

  // Build rows: merge users with their configs
  const rows: StaffRow[] = useMemo(() => {
    return allUsers.map(u => ({
      userId: u.id,
      name: u.name || 'Unknown',
      role: u.role || '',
      siteName: siteMap[u.organizationId] || u.organizationName || '-',
      siteId: u.organizationId || '',
      config: configMap[u.id] || null,
    }));
  }, [allUsers, configMap, siteMap]);

  // Filtered + sorted rows
  const filteredRows = useMemo(() => {
    let result = rows;

    if (filterSite) {
      result = result.filter(r => r.siteId === filterSite);
    }
    if (filterStatus === 'configured') {
      result = result.filter(r => r.config !== null);
    } else if (filterStatus === 'pending') {
      result = result.filter(r => r.config === null);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'site': valA = a.siteName; valB = b.siteName; break;
        case 'ctc': valA = a.config?.ctcPerMonth || 0; valB = b.config?.ctcPerMonth || 0; break;
        case 'rate': valA = a.config?.perDayBillingRate || 0; valB = b.config?.perDayBillingRate || 0; break;
        case 'status': valA = a.config ? 1 : 0; valB = b.config ? 1 : 0; break;
        default: valA = a.name; valB = b.name;
      }
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [rows, filterSite, filterStatus, searchQuery, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
  };

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const configured = rows.filter(r => r.config !== null).length;
    return { total, configured, pending: total - configured };
  }, [rows]);

  const fmtCurrency = (v: number) => v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  // Excel export
  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Staff Billing Config');
    ws.columns = [
      { header: 'Employee ID', key: 'userId', width: 38 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Role', key: 'role', width: 18 },
      { header: 'CTC/Month', key: 'ctc', width: 14 },
      { header: 'Weekly Offs/Week', key: 'wo', width: 16 },
      { header: 'EL/Annum', key: 'el', width: 12 },
      { header: 'NFH/Annum', key: 'nfh', width: 12 },
      { header: 'NH Billing', key: 'nhBill', width: 16 },
      { header: 'NH Salary', key: 'nhSal', width: 16 },
      { header: 'Shift', key: 'shift', width: 8 },
      { header: 'Shift Hours', key: 'shiftHrs', width: 12 },
      { header: 'Rate Effective Date', key: 'effDate', width: 18 },
      { header: 'Per Day Rate (Auto)', key: 'rate', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    // Style header
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B3F' } };
    });

    filteredRows.forEach(r => {
      ws.addRow({
        userId: r.userId,
        name: r.name,
        site: r.siteName,
        role: r.role,
        ctc: r.config?.ctcPerMonth || '',
        wo: r.config?.weeklyOffsPerWeek ?? '',
        el: r.config?.earnedLeavesPerAnnum ?? '',
        nfh: r.config?.nfhPerAnnum ?? '',
        nhBill: r.config?.nhBillingConfig || '',
        nhSal: r.config?.nhSalaryConfig || '',
        shift: r.config?.shift || '',
        shiftHrs: r.config?.shiftHours || '',
        effDate: r.config?.rateEffectiveDate || '',
        rate: r.config?.perDayBillingRate ? Number(r.config.perDayBillingRate).toFixed(2) : '',
        status: r.config ? 'Configured' : 'Pending',
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Staff_Billing_Config_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setToast({ message: `Exported ${filteredRows.length} records.`, type: 'success' });
  };

  // Excel import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.getWorksheet(1);
      if (!ws) throw new Error('No worksheet found');

      let savedCount = 0;
      const errors: string[] = [];

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header
        const userId = String(row.getCell(1).value || '').trim();
        const ctc = Number(row.getCell(5).value) || 0;
        if (!userId || ctc <= 0) {
          errors.push(`Row ${rowNum}: Missing Employee ID or invalid CTC`);
          return;
        }
        // Queue save operations
        const config = {
          userId,
          ctcPerMonth: ctc,
          weeklyOffsPerWeek: Number(row.getCell(6).value) || 1,
          earnedLeavesPerAnnum: Number(row.getCell(7).value) || 0,
          nfhPerAnnum: Number(row.getCell(8).value) || 12,
          nhBillingConfig: String(row.getCell(9).value || 'Per Day Extra'),
          nhSalaryConfig: String(row.getCell(10).value || 'Standard Per Day'),
          shift: String(row.getCell(11).value || 'A'),
          shiftHours: Number(row.getCell(12).value) || 8,
          rateEffectiveDate: String(row.getCell(13).value || new Date().toISOString().split('T')[0]),
        };

        const calcResult = calculatePerDayRate(config as SiteStaffConfig);
        const fullConfig = {
          ...config,
          perDayBillingRate: Number(calcResult.perDayBillingRate.toFixed(2)),
          perAnnumRate: calcResult.perAnnumRate,
          billableDutiesInYear: Number(calcResult.billableDutiesInYear.toFixed(2)),
        };

        api.saveSiteStaffConfig(fullConfig).then(() => savedCount++).catch(() => errors.push(`Row ${rowNum}: Save failed`));
      });

      // Wait a bit for async saves to finish
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadData();

      if (errors.length > 0) {
        setToast({ message: `Import completed with ${errors.length} errors. Check console.`, type: 'error' });
        console.warn('Import errors:', errors);
      } else {
        setToast({ message: `Import successful! Records updated.`, type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Import failed.', type: 'error' });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleEditorSaved = () => {
    setEditingUser(null);
    loadData();
    setToast({ message: 'Configuration saved successfully!', type: 'success' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-xs text-muted">Total Staff</p>
            <p className="text-lg font-bold text-primary-text">{stats.total}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <p className="text-xs text-muted">Configured</p>
            <p className="text-lg font-bold text-emerald-700">{stats.configured}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg"><AlertCircle className="h-5 w-5 text-amber-600" /></div>
          <div>
            <p className="text-xs text-muted">Pending</p>
            <p className="text-lg font-bold text-amber-700">{stats.pending}</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Filters + Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input !pl-9 !py-2 !text-sm w-full"
            />
          </div>
          <Select
            id="filter-site"
            value={filterSite}
            onChange={e => setFilterSite(e.target.value)}
            className="!py-2 !text-sm min-w-[150px]"
          >
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.shortName || s.name}</option>)}
          </Select>
          <Select
            id="filter-status"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="!py-2 !text-sm min-w-[130px]"
          >
            <option value="all">All Status</option>
            <option value="configured">✅ Configured</option>
            <option value="pending">⚠️ Pending</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-page transition-colors">
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:text-primary-text" onClick={() => handleSort('name')}>
                Employee <SortIcon field="name" />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:text-primary-text" onClick={() => handleSort('site')}>
                Site <SortIcon field="site" />
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted uppercase cursor-pointer hover:text-primary-text" onClick={() => handleSort('ctc')}>
                CTC/Mo <SortIcon field="ctc" />
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase">WO/Wk</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase">EL/Yr</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase">NFH</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase">NH Bill/Sal</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase">Shift</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted uppercase cursor-pointer hover:text-primary-text" onClick={() => handleSort('rate')}>
                Rate/Day <SortIcon field="rate" />
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase cursor-pointer hover:text-primary-text" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase w-16">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-muted">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No staff found</p>
                  <p className="text-xs mt-1">Adjust filters or add site staff users first.</p>
                </td>
              </tr>
            ) : (
              filteredRows.map(row => {
                const c = row.config;
                return (
                  <tr key={row.userId} className="hover:bg-page/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-primary-text truncate max-w-[200px]">{row.name}</p>
                      <p className="text-[10px] text-muted">{row.role}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted">{row.siteName}</td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {c ? fmtCurrency(c.ctcPerMonth) : <span className="text-muted">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">{c ? c.weeklyOffsPerWeek : <span className="text-muted">-</span>}</td>
                    <td className="px-3 py-2.5 text-center">{c ? c.earnedLeavesPerAnnum : <span className="text-muted">-</span>}</td>
                    <td className="px-3 py-2.5 text-center">{c ? c.nfhPerAnnum : <span className="text-muted">-</span>}</td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      {c ? (
                        <span className="whitespace-nowrap">{c.nhBillingConfig?.replace('Per Day ', '') || '-'} / {c.nhSalaryConfig?.replace('Per Day ', '') || '-'}</span>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c ? <span>{c.shift} ({c.shiftHours}h)</span> : <span className="text-muted">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {c?.perDayBillingRate ? (
                        <span style={{ color: '#006B3F' }}>{fmtCurrency(c.perDayBillingRate)}</span>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Set
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-[10px] font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setEditingUser(row)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted hover:text-emerald-700 transition-colors"
                        title="Edit Configuration"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted text-right">Showing {filteredRows.length} of {rows.length} staff members</p>

      {/* Editor Modal */}
      {editingUser && (
        <StaffConfigEditor
          userId={editingUser.userId}
          employeeName={editingUser.name}
          siteName={editingUser.siteName}
          existingConfig={editingUser.config}
          onClose={() => setEditingUser(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
};

export default StaffBillingConfig;
