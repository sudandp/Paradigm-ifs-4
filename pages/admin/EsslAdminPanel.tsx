/**
 * EsslAdminPanel.tsx
 * Full-Page Executive Admin Console for managing eSSL eTimeTrackLite data directly from Paradigm Office.
 * Full-width responsive dashboard with live telemetry, KPI metrics, client-side pagination, and rich controls.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Toast from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import {
  Database, Users, Calendar, CalendarCheck2, Building2, Layers,
  Plus, Search, RefreshCw, Trash2, Edit3, ArrowLeft,
  CheckCircle2, Clock, CheckSquare, Square, Filter, DownloadCloud,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Sparkles, Shield, X, LayoutGrid, List, AlertTriangle, ExternalLink
} from 'lucide-react';

// ─── API Helpers ─────────────────────────────────────────────────────────────

const API_BASE = '/api/mssql';

async function esslGet(action: string, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`${API_BASE}?${qs}`);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return r.json();
}

async function esslPost(action: string, body: Record<string, unknown>) {
  const r = await fetch(`${API_BASE}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || `HTTP ${r.status}`);
  }
  return data;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  EmployeeId: number;
  EmployeeCode: string;
  EmployeeName: string;
  CompanyId: number;
  CompanyName?: string;
  DepartmentId: number;
  DepartmentName?: string;
  ShiftGroupId: number;
  CategoryId: number;
  Status: string;
  ShiftGroupName: string;
  CategoryName: string;
  Designation?: string;
  DateofJoining?: string;
}

interface Department {
  DepartmentId: number;
  DepartmentName: string;
  CompanyId: number;
}

interface Company {
  CompanyId: number;
  CompanyName: string;
}

interface Category {
  CategoryId: number;
  CategoryName: string;
}

interface ShiftGroup {
  ShiftGroupId: number;
  ShiftGroupName: string;
  Shifts: string;
}

interface Holiday {
  HolidayId: number;
  HolidayName: string;
  HolidayDate: string;
  CompanyId: number | null;
}

type Tab = 'employees' | 'weekly-off' | 'holidays' | 'master-data';

// Helper to get clean initials (strips leading dots, punctuation)
function getInitials(name: string): string {
  if (!name) return 'EM';
  const clean = name.replace(/^[^a-zA-Z0-9]+/, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (clean.slice(0, 2) || 'EM').toUpperCase();
}

// Dynamic avatar colors
const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-300/80',
  'bg-teal-100 text-teal-800 border-teal-300/80',
  'bg-cyan-100 text-cyan-800 border-cyan-300/80',
  'bg-blue-100 text-blue-800 border-blue-300/80',
  'bg-slate-100 text-slate-800 border-slate-300/80',
  'bg-amber-100 text-amber-800 border-amber-300/80',
  'bg-rose-100 text-rose-800 border-rose-300/80',
];

function getAvatarStyle(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// Helper for category badge styling
function getCategoryBadge(name: string = '') {
  const lower = name.toLowerCase();
  if (lower.includes('sunday')) {
    return 'bg-rose-50 text-rose-700 border-rose-200/90';
  }
  if (lower.includes('saturday')) {
    return 'bg-amber-50 text-amber-700 border-amber-200/90';
  }
  if (lower.includes('rotational')) {
    return 'bg-sky-50 text-sky-700 border-sky-200/90';
  }
  if (lower.includes('all days') || lower.includes('security')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200/90';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200/90';
}

export default function EsslAdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('employees');

  // Lookup data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shiftGroups, setShiftGroups] = useState<ShiftGroup[]>([]);
  const [isLookupsLoading, setIsLookupsLoading] = useState(false);

  // Employee list
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empFilterCompany, setEmpFilterCompany] = useState('');
  const [empFilterDepartment, setEmpFilterDepartment] = useState('');
  const [empFilterStatus, setEmpFilterStatus] = useState('Working');

  // Pagination for Employee and Weekly Off tables
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Weekly Off Batch State
  const [selectedEmpCodes, setSelectedEmpCodes] = useState<Set<string>>(new Set());
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>('');
  const [isBatchApplying, setIsBatchApplying] = useState(false);
  const [updatingRowEmpCode, setUpdatingRowEmpCode] = useState<string | null>(null);

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holLoading, setHolLoading] = useState(false);
  const [holYear, setHolYear] = useState(String(new Date().getFullYear()));
  const [holFilterCompany, setHolFilterCompany] = useState('');
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [holidaysViewMode, setHolidaysViewMode] = useState<'cards' | 'table'>('cards');

  // Modals
  const [addEmpModal, setAddEmpModal] = useState(false);
  const [editEmpModal, setEditEmpModal] = useState<Employee | null>(null);
  const [addHolModal, setAddHolModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'employee' | 'holiday'; code?: string; date?: string; companyId?: number | null } | null>(null);

  // Forms
  const [newEmp, setNewEmp] = useState({
    employeeCode: '',
    employeeName: '',
    companyId: '',
    departmentId: '',
    shiftGroupId: '1',
    categoryId: '1',
    designation: '',
    employmentType: 'Permanent',
    dateOfJoining: new Date().toISOString().slice(0, 10),
  });
  const [editFields, setEditFields] = useState({
    departmentId: '',
    companyId: '',
    shiftGroupId: '',
    categoryId: '',
    status: '',
    designation: '',
  });
  const [newHol, setNewHol] = useState({ holidayName: '', holidayDate: '', companyId: '' });
  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [saving, setSaving] = useState(false);

  function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
    setToastMsg({ message, type });
  }

  // ─── Load Lookups & Initial Data (All on Mount) ───────────────────────────

  const loadLookups = useCallback(async () => {
    setIsLookupsLoading(true);
    try {
      const [d, c, cat, sg, h] = await Promise.all([
        esslGet('essl-departments'),
        esslGet('essl-companies'),
        esslGet('essl-categories'),
        esslGet('essl-shift-groups'),
        esslGet('essl-holidays', { year: holYear }),
      ]);
      setDepartments(d.departments || []);
      setCompanies(c.companies || []);
      setCategories(cat.categories || []);
      setShiftGroups(sg.shiftGroups || []);
      setHolidays(h.holidays || []);
    } catch (e: any) {
      showToast('Failed to load eSSL lookup data: ' + (e.message || String(e)), 'error');
    } finally {
      setIsLookupsLoading(false);
    }
  }, [holYear]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // ─── Load Employees ────────────────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const params: Record<string, string> = { status: empFilterStatus };
      if (empSearch) params.search = empSearch;
      if (empFilterCompany) params.companyId = empFilterCompany;
      const data = await esslGet('essl-employees', params);
      setEmployees(data.employees || []);
      setPage(1); // Reset to page 1 on filter change
    } catch (e: any) {
      showToast('Failed to load eSSL employees: ' + (e.message || String(e)), 'error');
    } finally {
      setEmpLoading(false);
    }
  }, [empSearch, empFilterCompany, empFilterStatus]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // ─── Load Holidays ─────────────────────────────────────────────────────────

  const loadHolidays = useCallback(async () => {
    setHolLoading(true);
    try {
      const params: Record<string, string> = { year: holYear };
      if (holFilterCompany) params.companyId = holFilterCompany;
      const data = await esslGet('essl-holidays', params);
      setHolidays(data.holidays || []);
    } catch (e: any) {
      showToast('Failed to load eSSL holidays: ' + (e.message || String(e)), 'error');
    } finally {
      setHolLoading(false);
    }
  }, [holYear, holFilterCompany]);

  // ─── Employee Actions ──────────────────────────────────────────────────────

  async function handleAddEmployee() {
    if (!newEmp.employeeCode || !newEmp.employeeName || !newEmp.companyId || !newEmp.departmentId) {
      showToast('Employee Code, Name, Company, and Department are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await esslPost('essl-add-employee', {
        ...newEmp,
        companyId: Number(newEmp.companyId),
        departmentId: Number(newEmp.departmentId),
        shiftGroupId: Number(newEmp.shiftGroupId),
        categoryId: Number(newEmp.categoryId),
      });
      showToast(data.message || 'Employee registered in eSSL!');
      setAddEmpModal(false);
      setNewEmp({
        employeeCode: '',
        employeeName: '',
        companyId: '',
        departmentId: '',
        shiftGroupId: '1',
        categoryId: '1',
        designation: '',
        employmentType: 'Permanent',
        dateOfJoining: new Date().toISOString().slice(0, 10),
      });
      loadEmployees();
    } catch (e: any) {
      showToast(e.message || 'Failed to add employee', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmployee() {
    if (!editEmpModal) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { employeeCode: editEmpModal.EmployeeCode };
      if (editFields.departmentId) payload.departmentId = Number(editFields.departmentId);
      if (editFields.companyId) payload.companyId = Number(editFields.companyId);
      if (editFields.shiftGroupId) payload.shiftGroupId = Number(editFields.shiftGroupId);
      if (editFields.categoryId) payload.categoryId = Number(editFields.categoryId);
      if (editFields.status) payload.status = editFields.status;
      if (editFields.designation) payload.designation = editFields.designation;
      const data = await esslPost('essl-update-employee-details', payload);
      showToast(data.message || 'Employee updated in eSSL!');
      setEditEmpModal(null);
      loadEmployees();
    } catch (e: any) {
      showToast(e.message || 'Failed to update employee', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEmployee(code: string, hard: boolean) {
    setSaving(true);
    try {
      const data = await esslPost('essl-delete-employee', { employeeCode: code, hardDelete: hard });
      showToast(data.message || (hard ? 'Employee hard deleted from eSSL' : 'Employee marked as Left in eSSL'));
      setConfirmDelete(null);
      loadEmployees();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete employee', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ─── Weekly Off Actions (Individual & Bulk) ───────────────────────────────

  async function handleRowWeeklyOffChange(employeeCode: string, newCategoryId: number) {
    setUpdatingRowEmpCode(employeeCode);
    try {
      await esslPost('essl-set-weekly-off', { employeeCode, categoryId: newCategoryId });
      showToast(`Weekly off updated for ${employeeCode}`, 'success');
      // Update local state without full refetch
      setEmployees(prev => prev.map(e => e.EmployeeCode === employeeCode ? {
        ...e,
        CategoryId: newCategoryId,
        CategoryName: categories.find(c => c.CategoryId === newCategoryId)?.CategoryName || e.CategoryName
      } : e));
    } catch (e: any) {
      showToast(e.message || 'Failed to update weekly off', 'error');
    } finally {
      setUpdatingRowEmpCode(null);
    }
  }

  async function handleBatchApplyWeeklyOff() {
    if (selectedEmpCodes.size === 0) {
      showToast('Please select at least one employee first.', 'warning');
      return;
    }
    if (!batchTargetCategory) {
      showToast('Please select a Weekly Off Category to apply.', 'warning');
      return;
    }
    const catId = Number(batchTargetCategory);
    const catName = categories.find(c => c.CategoryId === catId)?.CategoryName || 'Weekly Off';

    setIsBatchApplying(true);
    const codes = Array.from(selectedEmpCodes);
    let successCount = 0;
    let failCount = 0;

    for (const code of codes) {
      try {
        await esslPost('essl-set-weekly-off', { employeeCode: code, categoryId: catId });
        successCount++;
      } catch (_) {
        failCount++;
      }
    }

    setIsBatchApplying(false);
    setSelectedEmpCodes(new Set());
    if (failCount === 0) {
      showToast(`Successfully assigned '${catName}' to all ${successCount} employees!`, 'success');
    } else {
      showToast(`Assigned to ${successCount} employees (${failCount} failed).`, 'warning');
    }
    loadEmployees();
  }

  // ─── Holiday Actions ───────────────────────────────────────────────────────

  async function handleAddHoliday() {
    if (!newHol.holidayName || !newHol.holidayDate) {
      showToast('Holiday name and date are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        holidayName: newHol.holidayName,
        holidayDate: newHol.holidayDate
      };
      if (newHol.companyId) payload.companyId = Number(newHol.companyId);
      const data = await esslPost('essl-set-holiday', payload);
      showToast(data.message || 'Holiday saved to eSSL!');
      setAddHolModal(false);
      setNewHol({ holidayName: '', holidayDate: '', companyId: '' });
      loadHolidays();
    } catch (e: any) {
      showToast(e.message || 'Failed to save holiday', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHoliday(date: string, companyId?: number | null) {
    setSaving(true);
    try {
      const data = await esslPost('essl-delete-holiday', { holidayDate: date, companyId: companyId || null });
      showToast(data.message || 'Holiday deleted from eSSL');
      setConfirmDelete(null);
      loadHolidays();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete holiday', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Auto-Sync All Holidays from Paradigm Supabase to eSSL
  async function handleSyncAllHolidaysFromParadigm() {
    setIsSyncingHolidays(true);
    try {
      const paradigmHols = await api.getHolidays();
      if (!paradigmHols || paradigmHols.length === 0) {
        showToast('No holidays found in Paradigm master settings.', 'info');
        setIsSyncingHolidays(false);
        return;
      }

      let syncedCount = 0;
      for (const h of paradigmHols) {
        if (h.name && h.date) {
          try {
            await esslPost('essl-set-holiday', {
              holidayName: h.name,
              holidayDate: h.date,
            });
            syncedCount++;
          } catch (_) {}
        }
      }

      showToast(`Successfully synced ${syncedCount} holidays from Paradigm to eTimeTrackLite!`, 'success');
      loadHolidays();
    } catch (err: any) {
      showToast('Holiday sync failed: ' + (err.message || 'Server error'), 'error');
    } finally {
      setIsSyncingHolidays(false);
    }
  }

  // ─── Filtered Data & Pagination ───────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesDept = !empFilterDepartment || String(e.DepartmentId) === empFilterDepartment;
      return matchesDept;
    });
  }, [employees, empFilterDepartment]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, page, pageSize]);

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedEmpCodes.size === filteredEmployees.length) {
      setSelectedEmpCodes(new Set());
    } else {
      setSelectedEmpCodes(new Set(filteredEmployees.map(e => e.EmployeeCode)));
    }
  };

  const toggleSelectEmp = (code: string) => {
    const next = new Set(selectedEmpCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedEmpCodes(next);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/60 px-4 md:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <Toast
          message={toastMsg.message}
          type={toastMsg.type}
          onDismiss={() => setToastMsg(null)}
        />
      )}

      {/* ── Top Executive Header Banner (Full Width) ─────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/90 shadow-xs relative overflow-hidden">
        {/* Top vibrant brand bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/admin/devices')}
              className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors mt-0.5 shrink-0"
              title="Return to Biometric Devices"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700 shadow-2xs">
                  <Database className="h-5 w-5" />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  eSSL Master Sync &amp; Feeding
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  eTimeTrackLite MSSQL Live
                </span>
              </div>
              <p className="text-slate-500 text-sm max-w-3xl leading-relaxed">
                Centralized full-page command center for managing biometric staff directories, fast Weekly Off category feeding, and Gazetted Holiday synchronization directly with eTimeTrackLite.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
            <Button
              variant="outline"
              onClick={() => {
                loadLookups();
                loadHolidays();
                loadEmployees();
              }}
              disabled={empLoading || holLoading || isLookupsLoading}
              className="flex items-center gap-2 h-11 px-5 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${(empLoading || holLoading) ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              Refresh Data
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/admin/devices')}
              className="flex items-center gap-2 h-11 px-5 text-xs font-bold rounded-xl border-emerald-600/30 text-emerald-700 hover:bg-emerald-50/80 shadow-2xs transition-all"
            >
              Biometric Hardware &rarr;
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Stats Summary Cards (Full Width Grid) ────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Workforce</p>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                {employees.length.toLocaleString()}
              </h4>
            </div>
          </div>

          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 hover:border-teal-200 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-teal-600 shadow-xs shrink-0">
              <CalendarCheck2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Weekly Off Rules</p>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                {categories.length} Categories
              </h4>
            </div>
          </div>

          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 hover:border-amber-200 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">2026 Holidays</p>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                {holidays.length} Days
              </h4>
            </div>
          </div>

          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 hover:border-sky-200 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-sky-600 shadow-xs shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Sites</p>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                {departments.length} Sites
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* ── Segmented Navigation Tabs (Full Width) ───────────────────────────── */}
      <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200 shadow-inner overflow-x-auto w-full">
        {[
          { id: 'employees', label: 'Employees Directory', icon: Users, count: employees.length },
          { id: 'weekly-off', label: 'Weekly Off Feeding', icon: CalendarCheck2, count: employees.length },
          { id: 'holidays', label: 'Holidays Sync', icon: Calendar, count: holidays.length },
          { id: 'master-data', label: 'eSSL Structure', icon: Building2, count: departments.length },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white text-emerald-950 shadow-sm border border-slate-200/70 ring-1 ring-emerald-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{t.label}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-300/80 text-slate-700'
              }`}>
                {t.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: EMPLOYEES DIRECTORY & CRUD (FULL WIDTH)
          ═══════════════════════════════════════════════════════ */}
      {tab === 'employees' && (
        <div className="space-y-4 w-full">
          {/* Controls Bar */}
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or emp code..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadEmployees()}
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
                />
                {empSearch && (
                  <button
                    onClick={() => { setEmpSearch(''); setTimeout(loadEmployees, 50); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={empFilterCompany}
                onChange={e => setEmpFilterCompany(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>

              <select
                value={empFilterDepartment}
                onChange={e => setEmpFilterDepartment(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                ))}
              </select>

              <select
                value={empFilterStatus}
                onChange={e => setEmpFilterStatus(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="Working">Status: Working</option>
                <option value="Left">Status: Left</option>
                <option value="">Status: All</option>
              </select>

              <Button
                variant="outline"
                onClick={loadEmployees}
                className="h-10 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50"
              >
                Apply
              </Button>
            </div>

            <Button
              onClick={() => setAddEmpModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-10 px-5 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30 w-full xl:w-auto justify-center transition-all"
            >
              <Plus className="h-4 w-4" /> Add Employee to eSSL
            </Button>
          </div>

          {/* Full-Width Employees Table Card */}
          {empLoading ? (
            <div className="py-28 text-center bg-white rounded-3xl border border-slate-200/90 shadow-xs">
              <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">Querying eSSL live records...</p>
              <p className="text-xs text-slate-400 mt-1">Fetching biometric profiles from MS SQL</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-xs">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base">No employees found</h3>
              <p className="text-xs text-slate-500 mt-1">Try relaxing your search terms or company filter.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col w-full">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/90 text-[11px] uppercase tracking-wider text-slate-500 font-extrabold border-b border-slate-200/90 sticky top-0 backdrop-blur-xs">
                    <tr>
                      <th className="py-4 px-6">Staff Member</th>
                      <th className="py-4 px-4">Code</th>
                      <th className="py-4 px-4">Department / Site</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4">Weekly Off</th>
                      <th className="py-4 px-4">Shift Group</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEmployees.map(emp => {
                      const isWorking = emp.Status === 'Working' || !emp.Status;
                      return (
                        <tr key={emp.EmployeeId} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-3.5">
                              <div className={`w-9 h-9 rounded-2xl border flex items-center justify-center font-black text-xs shadow-2xs ${getAvatarStyle(emp.EmployeeName)}`}>
                                {getInitials(emp.EmployeeName)}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm">
                                  {emp.EmployeeName}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  {emp.Designation || 'Staff'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            <span className="bg-slate-100 border border-slate-200/80 text-slate-800 px-2.5 py-1 rounded-lg font-bold text-xs shadow-2xs">
                              {emp.EmployeeCode}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <span>{emp.DepartmentName || departments.find(d => d.DepartmentId === emp.DepartmentId)?.DepartmentName || 'General'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-medium">
                            {emp.CompanyName || companies.find(c => c.CompanyId === emp.CompanyId)?.CompanyName || 'Paradigm Services'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full font-bold text-[11px] border ${getCategoryBadge(emp.CategoryName)}`}>
                              {emp.CategoryName || 'Sunday Off'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-700">
                                {emp.ShiftGroupName || 'General Shift'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[11px] border ${
                              isWorking
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {emp.Status || 'Working'}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditEmpModal(emp);
                                  setEditFields({
                                    departmentId: String(emp.DepartmentId || ''),
                                    companyId: String(emp.CompanyId || ''),
                                    shiftGroupId: String(emp.ShiftGroupId || ''),
                                    categoryId: String(emp.CategoryId || ''),
                                    status: emp.Status || 'Working',
                                    designation: emp.Designation || '',
                                  });
                                }}
                                className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-transparent hover:border-emerald-200/60"
                                title="Edit employee details"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              {isWorking && (
                                <button
                                  onClick={() => setConfirmDelete({ type: 'employee', code: emp.EmployeeCode })}
                                  className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors border border-transparent hover:border-amber-200/60"
                                  title="Mark employee as Left (Soft-delete)"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </button>
                              )}

                              <button
                                onClick={() => setConfirmDelete({ type: 'employee', code: emp.EmployeeCode })}
                                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200/60"
                                title="Delete from eSSL"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Full-Width Pagination Controls */}
              <div className="p-4 md:p-5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 w-full">
                <div className="flex items-center gap-2">
                  <span>Showing</span>
                  <span className="font-extrabold text-slate-900">
                    {((page - 1) * pageSize) + 1}
                  </span>
                  <span>to</span>
                  <span className="font-extrabold text-slate-900">
                    {Math.min(page * pageSize, filteredEmployees.length)}
                  </span>
                  <span>of</span>
                  <span className="font-extrabold text-slate-900">{filteredEmployees.length.toLocaleString()}</span>
                  <span>staff members</span>

                  <span className="mx-2 text-slate-300">|</span>

                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none shadow-2xs"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-800 shadow-2xs">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: WEEKLY OFF FEEDING & BATCH ASSIGNMENT
          ═══════════════════════════════════════════════════════ */}
      {tab === 'weekly-off' && (
        <div className="space-y-4 w-full">
          {/* Info Banner */}
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-5 text-xs text-amber-950 flex items-start gap-4 shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-amber-900 text-sm">
                How Weekly Off Works in eTimeTrackLite:
              </p>
              <p className="text-amber-800 leading-relaxed text-xs">
                In eSSL MSSQL, an employee's Weekly Off (Sunday Off, Saturday Off, Rotational Off, etc.) is mapped through their assigned <strong>Category (dbo.Categories)</strong>. You can change an employee's weekly off instantly in their row, or multi-select staff below to batch feed in a single click!
              </p>
            </div>
          </div>

          {/* Batch Feeding Toolbar */}
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
              >
                {selectedEmpCodes.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
                <span>Select All Visible ({selectedEmpCodes.size})</span>
              </button>

              <select
                value={empFilterDepartment}
                onChange={e => setEmpFilterDepartment(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="">Filter by Department (All)</option>
                {departments.map(d => (
                  <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                ))}
              </select>

              <select
                value={empFilterCompany}
                onChange={e => setEmpFilterCompany(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="">Filter by Company (All)</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>
            </div>

            {/* Batch Action Group */}
            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
              <select
                value={batchTargetCategory}
                onChange={e => setBatchTargetCategory(e.target.value)}
                className="h-10 px-4 bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/30 focus:outline-none transition-all"
              >
                <option value="">Select Weekly Off to Apply...</option>
                {categories.map(c => (
                  <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
                ))}
              </select>

              <Button
                onClick={handleBatchApplyWeeklyOff}
                disabled={isBatchApplying || selectedEmpCodes.size === 0 || !batchTargetCategory}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-10 px-5 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isBatchApplying ? 'Feeding eSSL...' : `Assign to ${selectedEmpCodes.size} Staff`}
              </Button>
            </div>
          </div>

          {/* Full-Width Weekly Off Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 text-[11px] uppercase tracking-wider text-slate-500 font-extrabold border-b border-slate-200/90 sticky top-0 backdrop-blur-xs">
                  <tr>
                    <th className="py-4 px-5 w-12 text-center">
                      <button onClick={toggleSelectAll} className="p-1 text-slate-500 hover:text-slate-800">
                        {selectedEmpCodes.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-4 px-4">Staff Code</th>
                    <th className="py-4 px-6">Employee Name</th>
                    <th className="py-4 px-4">Department / Site</th>
                    <th className="py-4 px-4">Current Weekly Off</th>
                    <th className="py-4 px-6 text-right">Quick Feed Dropdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedEmployees.map(emp => {
                    const isSelected = selectedEmpCodes.has(emp.EmployeeCode);
                    const isUpdating = updatingRowEmpCode === emp.EmployeeCode;
                    return (
                      <tr
                        key={emp.EmployeeId}
                        className={`transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-3 px-5 text-center">
                          <button onClick={() => toggleSelectEmp(emp.EmployeeCode)} className="p-1">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                          <span className="bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg font-bold text-xs shadow-2xs">
                            {emp.EmployeeCode}
                          </span>
                        </td>
                        <td className="py-3 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs ${getAvatarStyle(emp.EmployeeName)}`}>
                              {getInitials(emp.EmployeeName)}
                            </div>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {emp.EmployeeName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold whitespace-nowrap">
                          {emp.DepartmentName || departments.find(d => d.DepartmentId === emp.DepartmentId)?.DepartmentName || 'General'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full font-bold text-[11px] border ${getCategoryBadge(emp.CategoryName)}`}>
                            {emp.CategoryName || 'Sunday Off'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={emp.CategoryId}
                              disabled={isUpdating}
                              onChange={e => handleRowWeeklyOffChange(emp.EmployeeCode, Number(e.target.value))}
                              className="h-8 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all shadow-2xs"
                            >
                              {categories.map(c => (
                                <option key={c.CategoryId} value={c.CategoryId}>
                                  {c.CategoryName}
                                </option>
                              ))}
                            </select>
                            {isUpdating && <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 md:p-5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 w-full">
              <div className="flex items-center gap-2">
                <span>Showing</span>
                <span className="font-extrabold text-slate-900">
                  {((page - 1) * pageSize) + 1}
                </span>
                <span>to</span>
                <span className="font-extrabold text-slate-900">
                  {Math.min(page * pageSize, filteredEmployees.length)}
                </span>
                <span>of</span>
                <span className="font-extrabold text-slate-900">{filteredEmployees.length.toLocaleString()}</span>
                <span>records</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-800 shadow-2xs">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3: HOLIDAYS SYNC & MANAGER (FULL WIDTH)
          ═══════════════════════════════════════════════════════ */}
      {tab === 'holidays' && (
        <div className="space-y-4 w-full">
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
              <input
                type="number"
                placeholder="Year"
                value={holYear}
                onChange={e => setHolYear(e.target.value)}
                className="w-24 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              />

              <select
                value={holFilterCompany}
                onChange={e => setHolFilterCompany(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option value="">All Companies (Universal)</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>

              <Button
                variant="outline"
                onClick={loadHolidays}
                className="h-10 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50"
              >
                Filter
              </Button>

              <div className="hidden sm:flex items-center gap-1 border-l border-slate-200 pl-3">
                <button
                  onClick={() => setHolidaysViewMode('cards')}
                  className={`p-2 rounded-xl transition-colors ${holidaysViewMode === 'cards' ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-2xs' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setHolidaysViewMode('table')}
                  className={`p-2 rounded-xl transition-colors ${holidaysViewMode === 'table' ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-2xs' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
              <Button
                variant="outline"
                onClick={handleSyncAllHolidaysFromParadigm}
                disabled={isSyncingHolidays}
                className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 h-10 px-5 text-xs font-bold rounded-xl shadow-2xs transition-all"
                title="Read all Gazetted Holidays configured in Paradigm and synchronize them with eTimeTrackLite dbo.Holidays"
              >
                <DownloadCloud className={`h-4 w-4 ${isSyncingHolidays ? 'animate-spin' : ''}`} />
                {isSyncingHolidays ? 'Syncing...' : 'Sync Holidays from Paradigm'}
              </Button>

              <Button
                onClick={() => setAddHolModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-10 px-5 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30 transition-all"
              >
                <Plus className="h-4 w-4" /> Add eSSL Holiday
              </Button>
            </div>
          </div>

          {/* Full-Width Holidays View */}
          {holLoading ? (
            <div className="py-28 text-center bg-white rounded-3xl border border-slate-200/90 shadow-xs">
              <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">Loading eSSL holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-xs">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base">No holidays configured for {holYear}</h3>
              <p className="text-xs text-slate-500 mt-1">Click "Sync Holidays from Paradigm" to import all gazetted holidays automatically.</p>
            </div>
          ) : holidaysViewMode === 'cards' ? (
            /* Full-Width Modern Calendar Tile Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4.5 w-full">
              {holidays.map(h => {
                const dateObj = new Date(h.HolidayDate);
                const monthName = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'DATE';
                const dayNum = !isNaN(dateObj.getTime()) ? String(dateObj.getDate()).padStart(2, '0') : '—';
                const dayOfWeek = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-US', { weekday: 'long' }) : '';
                return (
                  <div
                    key={h.HolidayId}
                    className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      {/* Calendar date tile */}
                      <div className="w-14 h-16 rounded-2xl border border-emerald-200/90 overflow-hidden text-center shrink-0 shadow-2xs flex flex-col">
                        <div className="bg-emerald-600 text-white font-black text-[10px] py-0.5 tracking-wider">
                          {monthName}
                        </div>
                        <div className="bg-emerald-50/60 flex-1 flex items-center justify-center font-black text-slate-900 text-xl">
                          {dayNum}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                          {h.HolidayName}
                        </p>
                        <p className="text-xs font-bold text-emerald-600">
                          {dayOfWeek}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {h.CompanyId
                            ? (companies.find(c => c.CompanyId === h.CompanyId)?.CompanyName || `Company ${h.CompanyId}`)
                            : 'Universal (All Sites)'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400 font-medium">
                        {h.HolidayDate?.slice(0, 10)}
                      </span>
                      <button
                        onClick={() => setConfirmDelete({
                          type: 'holiday',
                          date: h.HolidayDate?.slice(0, 10),
                          companyId: h.CompanyId
                        })}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 text-[11px] uppercase tracking-wider text-slate-500 font-extrabold border-b border-slate-200/90">
                  <tr>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Holiday Name</th>
                    <th className="py-4 px-6">Company Scope</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map(h => (
                    <tr key={h.HolidayId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {h.HolidayDate ? h.HolidayDate.slice(0, 10) : '—'}
                      </td>
                      <td className="py-3 px-6 font-bold text-slate-900 whitespace-nowrap text-sm">
                        {h.HolidayName}
                      </td>
                      <td className="py-3 px-6 text-slate-500 whitespace-nowrap font-medium">
                        {h.CompanyId
                          ? (companies.find(c => c.CompanyId === h.CompanyId)?.CompanyName || `Company ${h.CompanyId}`)
                          : 'All Companies (Universal)'}
                      </td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => setConfirmDelete({
                            type: 'holiday',
                            date: h.HolidayDate?.slice(0, 10),
                            companyId: h.CompanyId
                          })}
                          className="px-3 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1 ml-auto shadow-2xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4: MASTER DATA & LOOKUP STRUCTURE (FULL WIDTH)
          ═══════════════════════════════════════════════════════ */}
      {tab === 'master-data' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Companies Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shadow-2xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">eSSL Companies</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {companies.length} Records
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {companies.map(c => (
                <div key={c.CompanyId} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 text-sm">{c.CompanyName}</span>
                  <span className="font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 font-semibold">
                    ID: {c.CompanyId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Departments Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-2xs">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Departments &amp; Sites</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800">
                {departments.length} Sites
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {departments.map(d => (
                <div key={d.DepartmentId} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 text-sm">{d.DepartmentName}</span>
                  <span className="font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 font-semibold">
                    ID: {d.DepartmentId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Categories Card (Weekly Off Groups) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-2xs">
                  <CalendarCheck2 className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Weekly Off Categories</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800">
                {categories.length} Rules
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {categories.map(c => (
                <div key={c.CategoryId} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 text-sm">{c.CategoryName}</span>
                  <span className="font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 font-semibold">
                    ID: {c.CategoryId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Groups Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-2xs">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Shift Groups</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800">
                {shiftGroups.length} Groups
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {shiftGroups.map(sg => (
                <div key={sg.ShiftGroupId} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block text-sm">{sg.ShiftGroupName}</span>
                    <span className="text-xs text-slate-400 font-medium">{sg.Shifts || 'Regular timing'}</span>
                  </div>
                  <span className="font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 font-semibold">
                    ID: {sg.ShiftGroupId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Employee ─────────────────────────────────────────────── */}
      {addEmpModal && (
        <Modal
          isOpen={addEmpModal}
          onClose={() => setAddEmpModal(false)}
          title="Register Employee in eSSL MSSQL"
        >
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee Code *</label>
                <Input
                  value={newEmp.employeeCode}
                  onChange={e => setNewEmp({ ...newEmp, employeeCode: e.target.value })}
                  placeholder="e.g. 31050"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <Input
                  value={newEmp.employeeName}
                  onChange={e => setNewEmp({ ...newEmp, employeeName: e.target.value })}
                  placeholder="e.g. Rajesh Kumar"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company *</label>
                <select
                  value={newEmp.companyId}
                  onChange={e => setNewEmp({ ...newEmp, companyId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Select Company...</option>
                  {companies.map(c => (
                    <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department / Site *</label>
                <select
                  value={newEmp.departmentId}
                  onChange={e => setNewEmp({ ...newEmp, departmentId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Select Department...</option>
                  {departments.map(d => (
                    <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Weekly Off Category</label>
                <select
                  value={newEmp.categoryId}
                  onChange={e => setNewEmp({ ...newEmp, categoryId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Group</label>
                <select
                  value={newEmp.shiftGroupId}
                  onChange={e => setNewEmp({ ...newEmp, shiftGroupId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {shiftGroups.map(sg => (
                    <option key={sg.ShiftGroupId} value={sg.ShiftGroupId}>{sg.ShiftGroupName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <Input
                  value={newEmp.designation}
                  onChange={e => setNewEmp({ ...newEmp, designation: e.target.value })}
                  placeholder="e.g. Electrician / Security Guard"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Joining</label>
                <Input
                  type="date"
                  value={newEmp.dateOfJoining}
                  onChange={e => setNewEmp({ ...newEmp, dateOfJoining: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setAddEmpModal(false)}
                className="h-10 px-5 text-xs font-bold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddEmployee}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30"
              >
                {saving ? 'Registering...' : 'Register in eSSL'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Edit Employee ────────────────────────────────────────────── */}
      {editEmpModal && (
        <Modal
          isOpen={Boolean(editEmpModal)}
          onClose={() => setEditEmpModal(null)}
          title={`Edit Employee: ${editEmpModal.EmployeeName} (${editEmpModal.EmployeeCode})`}
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department / Site</label>
              <select
                value={editFields.departmentId}
                onChange={e => setEditFields({ ...editFields, departmentId: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select Department...</option>
                {departments.map(d => (
                  <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
              <select
                value={editFields.companyId}
                onChange={e => setEditFields({ ...editFields, companyId: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select Company...</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Weekly Off Category</label>
                <select
                  value={editFields.categoryId}
                  onChange={e => setEditFields({ ...editFields, categoryId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Select Weekly Off...</option>
                  {categories.map(c => (
                    <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Group</label>
                <select
                  value={editFields.shiftGroupId}
                  onChange={e => setEditFields({ ...editFields, shiftGroupId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Select Shift Group...</option>
                  {shiftGroups.map(sg => (
                    <option key={sg.ShiftGroupId} value={sg.ShiftGroupId}>{sg.ShiftGroupName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={editFields.status}
                  onChange={e => setEditFields({ ...editFields, status: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Working">Working (Active)</option>
                  <option value="Left">Left (Inactive / Ex-employee)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <Input
                  value={editFields.designation}
                  onChange={e => setEditFields({ ...editFields, designation: e.target.value })}
                  placeholder="Designation"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setEditEmpModal(null)}
                className="h-10 px-5 text-xs font-bold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateEmployee}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30"
              >
                {saving ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Add Holiday ──────────────────────────────────────────────── */}
      {addHolModal && (
        <Modal
          isOpen={addHolModal}
          onClose={() => setAddHolModal(false)}
          title="Add Holiday to eSSL MSSQL"
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Holiday Name *</label>
              <Input
                value={newHol.holidayName}
                onChange={e => setNewHol({ ...newHol, holidayName: e.target.value })}
                placeholder="e.g. Gandhi Jayanti"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Holiday Date *</label>
              <Input
                type="date"
                value={newHol.holidayDate}
                onChange={e => setNewHol({ ...newHol, holidayDate: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Scope</label>
              <select
                value={newHol.companyId}
                onChange={e => setNewHol({ ...newHol, companyId: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Universal (Applies to All Companies)</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setAddHolModal(false)}
                className="h-10 px-5 text-xs font-bold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddHoliday}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/30"
              >
                {saving ? 'Saving...' : 'Save Holiday'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirm Deletion / Soft-delete ────────────────────────────── */}
      {confirmDelete && (
        <Modal
          isOpen={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          title="Confirm Action"
        >
          <div className="space-y-4 pt-2">
            {confirmDelete.type === 'employee' ? (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">
                  How would you like to handle employee <strong>{confirmDelete.code}</strong>?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
                  <strong>Recommended:</strong> Mark as 'Left' (Soft-delete). This preserves all historical biometric logs and past punch records while stopping new roster assignments.
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(null)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteEmployee(confirmDelete.code!, false)}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 text-white h-10 px-4 text-xs font-bold rounded-xl shadow-xs"
                  >
                    Mark as 'Left' (Soft-Delete)
                  </Button>
                  <Button
                    onClick={() => handleDeleteEmployee(confirmDelete.code!, true)}
                    disabled={saving}
                    className="bg-rose-600 hover:bg-rose-700 text-white h-10 px-4 text-xs font-bold rounded-xl shadow-xs"
                  >
                    Permanent Hard Delete
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Are you sure you want to delete the holiday on <strong>{confirmDelete.date}</strong>?
                </p>
                <div className="flex justify-end gap-3 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(null)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteHoliday(confirmDelete.date!, confirmDelete.companyId)}
                    disabled={saving}
                    className="bg-rose-600 hover:bg-rose-700 text-white h-10 px-5 text-xs font-bold rounded-xl shadow-xs"
                  >
                    {saving ? 'Deleting...' : 'Delete Holiday'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
