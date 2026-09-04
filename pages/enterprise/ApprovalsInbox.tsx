import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEnterpriseStore } from '../../store/enterpriseStore';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { 
  CheckCircle2, XCircle, Clock, ShieldAlert, Loader2,
  Lock, FileText, Check, Copy, User, HelpCircle, FileCheck, RefreshCw, Download,
  History, Calendar, Building2, AlertCircle, Eye, FileSpreadsheet
} from 'lucide-react';
import type { OpsApprovalRequest, ApprovalStatus } from '../../types/enterprise';
import type { SiteChangeRequest } from '../../types/siteRouting';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { exportGenericReportToExcel } from '../../utils/excelExport';
import { Navigate } from 'react-router-dom';
import { isAdmin } from '../../utils/auth';

// Import and register chart.js components
import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const generateDeterministicPasscode = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const code = Math.abs(hash) % 1000000;
  return code.toString().padStart(6, '0');
};

const extractPasscode = (comments?: string): string => {
  if (!comments) return '';
  const match = comments.match(/Passcode:\s*(\d{6})/i);
  return match ? match[1] : '';
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  'Pending': 'bg-amber-50 text-amber-700 border-amber-200/50',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  'Rejected': 'bg-rose-50 text-rose-700 border-rose-200/50'
};

// --- Local Chart Components ---

const RequestTypeChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (instanceRef.current) instanceRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (labels.length === 0) {
      instanceRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
      return;
    }

    instanceRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6'],
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              boxWidth: 10,
              padding: 10,
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 8,
            cornerRadius: 6
          }
        }
      }
    });

    return () => { instanceRef.current?.destroy(); };
  }, [labels, values]);

  return (
    <div className="h-40 relative w-full flex items-center justify-center">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

const RequestTrendChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (instanceRef.current) instanceRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (labels.length === 0) {
      instanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [0], backgroundColor: ['#e2e8f0'] }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { display: false }, x: { display: false } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
      return;
    }

    instanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Requests Submitted',
          data: values,
          backgroundColor: '#3B82F6',
          borderRadius: 4,
          maxBarThickness: 30
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(128,128,128,0.08)' },
            ticks: { precision: 0 }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 }, maxTicksLimit: 7 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 8,
            cornerRadius: 6
          }
        }
      }
    });

    return () => { instanceRef.current?.destroy(); };
  }, [labels, values]);

  return (
    <div className="h-40 relative w-full">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

const RequesterDistributionChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (instanceRef.current) instanceRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (labels.length === 0) {
      instanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [0], backgroundColor: ['#e2e8f0'] }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { display: false }, x: { display: false } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
      return;
    }

    instanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.slice(0, 5),
        datasets: [{
          label: 'Requests by User',
          data: values.slice(0, 5),
          backgroundColor: '#10B981',
          borderRadius: 4,
          maxBarThickness: 12
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(128,128,128,0.08)' },
            ticks: { precision: 0 }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 9 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 8,
            cornerRadius: 6
          }
        }
      }
    });

    return () => { instanceRef.current?.destroy(); };
  }, [labels, values]);

  return (
    <div className="h-40 relative w-full">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

// --- Main Component ---

const ApprovalsInbox: React.FC = () => {
  const { approvalRequests, fetchApprovalRequests, processApproval, isLoading } = useEnterpriseStore();
  const { user } = useAuthStore();

  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ReportAccess');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  
  // Filter States
  const [moduleFilter, setModuleFilter] = useState('All');
  const [requesterFilter, setRequesterFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickFilter, setQuickFilter] = useState('All');
  const [requesterList, setRequesterList] = useState<{ id: string, name: string }[]>([]);
  
  // Modals
  const [showRejectModal, setShowRejectModal] = useState<OpsApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Historical Site Change Requests State
  const [siteChangeRequests, setSiteChangeRequests] = useState<SiteChangeRequest[]>([]);
  const [isLoadingSiteChanges, setIsLoadingSiteChanges] = useState(false);
  const [processingSiteId, setProcessingSiteId] = useState<string | null>(null);
  const [selectedDiffRequest, setSelectedDiffRequest] = useState<SiteChangeRequest | null>(null);
  const [showSiteRejectModal, setShowSiteRejectModal] = useState<SiteChangeRequest | null>(null);
  const [siteRejectReason, setSiteRejectReason] = useState('');

  const fetchSiteChanges = async () => {
    setIsLoadingSiteChanges(true);
    try {
      const data = await api.getSiteChangeRequests();
      setSiteChangeRequests(data);
    } catch (err) {
      console.warn('Failed to fetch site change requests:', err);
    } finally {
      setIsLoadingSiteChanges(false);
    }
  };

  const handleApproveSiteChange = async (req: SiteChangeRequest) => {
    if (!user) return;
    setProcessingSiteId(req.id);
    try {
      await api.approveSiteChangeRequest(req.id, user.id, user.name || 'Manager');
      setToast({ message: `Approved ${req.requestType} request for ${req.siteName}`, type: 'success' });
      await fetchSiteChanges();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to approve request', type: 'error' });
    } finally {
      setProcessingSiteId(null);
    }
  };

  const handleRejectSiteChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !showSiteRejectModal) return;
    if (!siteRejectReason.trim()) {
      setToast({ message: 'Please provide a rejection reason', type: 'error' });
      return;
    }
    setProcessingSiteId(showSiteRejectModal.id);
    try {
      await api.rejectSiteChangeRequest(showSiteRejectModal.id, user.id, user.name || 'Manager', siteRejectReason.trim());
      setToast({ message: `Rejected ${showSiteRejectModal.requestType} request for ${showSiteRejectModal.siteName}`, type: 'success' });
      setShowSiteRejectModal(null);
      setSiteRejectReason('');
      await fetchSiteChanges();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to reject request', type: 'error' });
    } finally {
      setProcessingSiteId(null);
    }
  };

  // Fetch count statistics from Supabase
  const fetchCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('ops_approval_requests')
        .select('status');
      
      if (!error && data) {
        const stats = { pending: 0, approved: 0, rejected: 0, total: data.length };
        data.forEach(r => {
          if (r.status === 'Pending') stats.pending++;
          else if (r.status === 'Approved') stats.approved++;
          else if (r.status === 'Rejected') stats.rejected++;
        });
        setCounts(stats);
      }
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [approvalRequests]);

  // Build unique requester select options
  useEffect(() => {
    const list: Record<string, string> = {};
    approvalRequests.forEach(req => {
      if (req.requestedBy && req.requestedByName) {
        list[req.requestedBy] = req.requestedByName;
      }
    });
    setRequesterList(Object.entries(list).map(([id, name]) => ({ id, name })));
  }, [approvalRequests]);

  const notifyUserOfAccessResult = async (request: OpsApprovalRequest, status: 'Approved' | 'Rejected', reason?: string, passcodeOverride?: string) => {
    try {
      if (!request.requestedBy) return;
      
      const passcode = passcodeOverride || (status === 'Approved' ? generateDeterministicPasscode(request.id) : '');
      const message = status === 'Approved' 
        ? `Your access request for ${request.title.replace('Access Request: ', '')} has been approved. Use passcode ${passcode} to unlock.`
        : `Your access request for ${request.title.replace('Access Request: ', '')} was rejected. ${reason ? `Reason: ${reason}` : ''}`;
      
      const link = '/attendance/dashboard';
      
      await supabase
        .from('notifications')
        .insert({
          user_id: request.requestedBy,
          message,
          type: 'info',
          link_to: link,
          severity: status === 'Approved' ? 'Medium' : 'High',
          metadata: {
            requestId: request.id,
            status,
            link
          }
        });

      await supabase.functions.invoke('send-notification', {
        body: {
          userIds: [request.requestedBy],
          title: status === 'Approved' ? 'Access Request Approved' : 'Access Request Rejected',
          message,
          data: {
            link,
            requestId: request.id
          }
        }
      });

      // Get the reporting manager of the requester
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('reporting_manager_id')
        .eq('id', request.requestedBy)
        .maybeSingle();

      if (!userErr && userData?.reporting_manager_id) {
        const managerMessage = status === 'Approved'
          ? `Access request by ${request.requestedByName || 'Employee'} for ${request.title.replace('Access Request: ', '')} has been approved. Passcode: ${passcode}`
          : `Access request by ${request.requestedByName || 'Employee'} for ${request.title.replace('Access Request: ', '')} was rejected. ${reason ? `Reason: ${reason}` : ''}`;

        await supabase
          .from('notifications')
          .insert({
            user_id: userData.reporting_manager_id,
            message: managerMessage,
            type: 'info',
            link_to: link,
            severity: status === 'Approved' ? 'Medium' : 'High',
            metadata: {
              requestId: request.id,
              status,
              link
            }
          });

        await supabase.functions.invoke('send-notification', {
          body: {
            userIds: [userData.reporting_manager_id],
            title: status === 'Approved' ? 'Team Access Request Approved' : 'Team Access Request Rejected',
            message: managerMessage,
            data: {
              link,
              requestId: request.id
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to notify user of access request result:', err);
    }
  };

  useEffect(() => {
    fetchApprovalRequests();
    fetchSiteChanges();
  }, []);

  // Apply filters on the client-side
  const filteredRequests = useMemo(() => {
    return approvalRequests.filter(req => {
      if (moduleFilter !== 'All' && req.moduleName !== moduleFilter) return false;
      if (requesterFilter !== 'All' && req.requestedBy !== requesterFilter) return false;
      
      const reqDate = new Date(req.createdAt);
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (reqDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (reqDate > eDate) return false;
      }
      return true;
    });
  }, [approvalRequests, moduleFilter, requesterFilter, startDate, endDate]);

  // Chart Data calculations from current filtered set
  const chartData = useMemo(() => {
    const moduleCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    const requesterCounts: Record<string, number> = {};

    filteredRequests.forEach(req => {
      const mod = req.moduleName || 'Other';
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;

      try {
        const dateStr = new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      } catch (_err) {
        // ignore invalid date parsing
      }

      const reqName = req.requestedByName || 'System';
      requesterCounts[reqName] = (requesterCounts[reqName] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyCounts).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return {
      modules: Object.keys(moduleCounts),
      moduleValues: Object.values(moduleCounts),
      dates: sortedDates,
      dateValues: sortedDates.map(d => dailyCounts[d]),
      requesters: Object.keys(requesterCounts),
      requesterValues: Object.values(requesterCounts)
    };
  }, [filteredRequests]);

  const handleQuickFilter = (val: string) => {
    setQuickFilter(val);
    const today = new Date();
    if (val === 'Today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (val === 'This Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (val === 'This Year') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleApprove = async (request: OpsApprovalRequest) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      let comments = 'Approved via Enterprise Inbox';
      let passcode = '';
      if (request.moduleName === 'ReportAccess') {
        passcode = Math.floor(100000 + Math.random() * 900000).toString();
        comments = `Passcode: ${passcode}`;
      }
      
      const updatedRequest = await processApproval(request.id, user.id, 'Approved', comments);
      
      if (request.moduleName === 'ReportAccess') {
        await notifyUserOfAccessResult(updatedRequest, 'Approved', undefined, passcode);
      }

      setToast({ message: 'Request Approved Successfully', type: 'success' });
      fetchApprovalRequests();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !showRejectModal) return;
    if (!rejectReason.trim()) {
      setToast({ message: 'Rejection reason is required', type: 'error' });
      return;
    }
    
    setProcessingId(showRejectModal.id);
    try {
      await processApproval(showRejectModal.id, user.id, 'Rejected', rejectReason);
      
      if (showRejectModal.moduleName === 'ReportAccess') {
        await notifyUserOfAccessResult(showRejectModal, 'Rejected', rejectReason);
      }

      setToast({ message: 'Request Rejected', type: 'success' });
      setShowRejectModal(null);
      setRejectReason('');
      fetchApprovalRequests();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleLock = async (request: OpsApprovalRequest) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      await processApproval(request.id, user.id, 'Rejected', 'Access manually locked by Admin');
      setToast({ message: 'Request Access Locked', type: 'success' });
      fetchApprovalRequests();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportExcel = async () => {
    try {
      const columns = [
        { header: 'Title', key: 'title', width: 40 },
        { header: 'Module', key: 'moduleName', width: 20 },
        { header: 'Requested By', key: 'requestedByName', width: 25 },
        { header: 'Entity', key: 'entityName', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Required Role', key: 'requiredRole', width: 15 },
        { header: 'Approval Stage', key: 'approvalStage', width: 15 },
        { header: 'Approver', key: 'approverName', width: 25 },
        { header: 'Feedback Comments', key: 'comments', width: 40 },
        { header: 'Created At', key: 'createdAtFormatted', width: 25 },
        { header: 'Updated At', key: 'updatedAtFormatted', width: 25 }
      ];

      const exportData = filteredRequests.map(req => ({
        ...req,
        createdAtFormatted: new Date(req.createdAt).toLocaleString('en-IN'),
        updatedAtFormatted: new Date(req.updatedAt).toLocaleString('en-IN')
      }));

      const start = startDate ? new Date(startDate) : new Date(Math.min(...filteredRequests.map(r => new Date(r.createdAt).getTime())));
      const end = endDate ? new Date(endDate) : new Date();

      await exportGenericReportToExcel(
        exportData,
        columns,
        'Approvals Inbox Report',
        { startDate: start, endDate: end },
        'approvals_report'
      );
      setToast({ message: 'Excel Report exported successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Export failed: ${err.message}`, type: 'error' });
    }
  };

  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'ReportAccess':
        return <Lock className="w-4 h-4 text-amber-600" />;
      case 'Quotation':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'Contract':
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <HelpCircle className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getModuleIconBg = (moduleName: string) => {
    switch (moduleName) {
      case 'ReportAccess':
        return 'bg-amber-50 border border-amber-100/50';
      case 'Quotation':
        return 'bg-blue-50 border border-blue-100/50';
      case 'Contract':
        return 'bg-emerald-50 border border-emerald-100/50';
      default:
        return 'bg-indigo-50 border border-indigo-100/50';
    }
  };

  if (!user || !isAdmin(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      {/* Title Bar Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-primary-text flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-[#006b3f]" /> Approvals Inbox
          </h1>
          <p className="text-sm font-semibold text-muted leading-relaxed mt-1">
            Review and authorization queue for user passcodes, quotation drafts, and service contracts.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border border-border hover:bg-gray-50 text-primary-text transition-all shadow-sm w-full sm:w-auto justify-center active:scale-95"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 text-muted" />
            Export Report
          </button>
        </div>
      </div>

      {/* Modern Filter Row (leave-management styled) */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 flex-1 w-full">
            {/* Filter by Requester */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted">Filter by Employee</label>
              <select
                value={requesterFilter}
                onChange={e => setRequesterFilter(e.target.value)}
                className="form-input w-full text-xs py-2 px-3 rounded-xl border-border bg-page"
              >
                <option value="All">All Employees</option>
                {requesterList.map(req => (
                  <option key={req.id} value={req.id}>{req.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Module */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted">Quick Filters</label>
              <select
                value={quickFilter}
                onChange={e => handleQuickFilter(e.target.value)}
                className="form-input w-full text-xs py-2 px-3 rounded-xl border-border bg-page"
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
              </select>
            </div>

            {/* Filter by Module Type */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted">Module Type</label>
              <select
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="form-input w-full text-xs py-2 px-3 rounded-xl border-border bg-page"
              >
                <option value="All">All Modules</option>
                <option value="ReportAccess">ReportAccess</option>
                <option value="Quotation">Quotation</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="form-input w-full text-xs py-2 px-3 rounded-xl border-border bg-page"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="form-input w-full text-xs py-2 px-3 rounded-xl border-border bg-page"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => {
                setModuleFilter('All');
                setRequesterFilter('All');
                setStartDate('');
                setEndDate('');
                setQuickFilter('All');
              }}
              className="px-4 py-2 border border-border bg-page text-muted hover:text-primary-text hover:bg-gray-50 rounded-xl text-xs font-black uppercase tracking-wider transition-colors w-full sm:w-auto text-center active:scale-95"
            >
              Clear
            </button>
            <button
              onClick={() => fetchApprovalRequests()}
              className="px-4 py-2 bg-[#006b3f] hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm w-full sm:w-auto flex items-center justify-center gap-1.5 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Row (styled exactly like leave-management) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Module Type Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Request Type Distribution</h3>
            <p className="text-2xl font-black text-primary-text mb-4 ml-1">
              {filteredRequests.length} <span className="text-xs font-normal text-muted">Active Requests</span>
            </p>
          </div>
          <RequestTypeChart labels={chartData.modules} values={chartData.moduleValues} />
        </div>

        {/* Daily Request Trend */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Daily Request Trend</h3>
            <p className="text-2xl font-black text-primary-text mb-4 ml-1">
              {chartData.dates.length} <span className="text-xs font-normal text-muted">Unique Days</span>
            </p>
          </div>
          <RequestTrendChart labels={chartData.dates} values={chartData.dateValues} />
        </div>

        {/* Requests by Requester */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Requests by Requester</h3>
            <p className="text-2xl font-black text-primary-text mb-4 ml-1">
              {chartData.requesters.length} <span className="text-xs font-normal text-muted">Requesters Active</span>
            </p>
          </div>
          <RequesterDistributionChart labels={chartData.requesters} values={chartData.requesterValues} />
        </div>
      </div>

      {/* Navigation Tabs and Content (Leave List Style Table) */}
      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Tab Buttons bar */}
        <div className="p-3.5 border-b border-border flex justify-between items-center gap-4 overflow-x-auto bg-gray-50/40">
          <div className="flex gap-2">
            {[
              { id: 'ReportAccess', label: 'Report Access', count: filteredRequests.filter(r => r.status === 'Pending' && r.moduleName === 'ReportAccess').length },
              { id: 'Quotations', label: 'Quotations', count: filteredRequests.filter(r => r.status === 'Pending' && r.moduleName === 'Quotation').length },
              { id: 'Contracts', label: 'Contracts', count: filteredRequests.filter(r => r.status === 'Pending' && r.moduleName === 'Contract').length },
              { id: 'HistoricalChanges', label: 'Historical Site Changes', count: siteChangeRequests.filter(r => r.status === 'Pending').length },
              { id: 'Approved', label: 'Approved', count: filteredRequests.filter(r => r.status === 'Approved').length },
              { id: 'Rejected', label: 'Rejected', count: filteredRequests.filter(r => r.status === 'Rejected').length },
              { id: 'All', label: 'All Requests', count: filteredRequests.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-[#006b3f] text-white shadow-md shadow-[#006b3f]/10' 
                    : 'bg-white border border-border text-muted hover:text-primary-text'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Requests List Styled as Leave Approval Inbox Table */}
        <div className="flex-1 overflow-x-auto bg-gray-50/10">
          {activeTab === 'HistoricalChanges' ? (
            /* Historical Site Changes Table */
            isLoadingSiteChanges ? (
              <div className="flex justify-center items-center py-20 flex-col gap-3">
                <Loader2 className="w-9 h-9 animate-spin text-[#006b3f]" />
                <p className="text-sm font-bold text-muted uppercase tracking-widest">Loading Change Requests...</p>
              </div>
            ) : siteChangeRequests.length === 0 ? (
              <div className="text-center py-24 text-muted flex flex-col items-center max-w-sm mx-auto">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">No Pending Site Changes</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  All past month modification requests have been reviewed.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Requester</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Site & Period</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Justification Reason</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {siteChangeRequests.map(req => {
                    const reqTypeBadge = req.requestType === 'ADD' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : req.requestType === 'DELETE' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200';

                    const isPending = req.status === 'Pending';

                    return (
                      <tr key={req.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0 shadow-sm">
                              {req.requestedByName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{req.requestedByName}</div>
                              <div className="text-[10px] text-muted uppercase font-semibold">{req.requestedByRole?.replace('_', ' ') || 'Staff'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4.5">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted" />
                            {req.siteName}
                          </div>
                          <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3 text-muted" />
                            Period: <span className="font-bold text-gray-700">{req.targetMonth}/{req.targetYear}</span>
                            {req.companyName && <span className="text-[10px] text-emerald-600 font-bold ml-1">({req.companyName})</span>}
                          </div>
                        </td>

                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              {req.recordType === 'attendance' ? <Clock className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                              {req.recordType}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${reqTypeBadge}`}>
                              {req.requestType}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4.5">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-800 italic leading-relaxed max-w-xs">
                              "{req.reason || 'No justification provided'}"
                            </p>
                            <button
                              onClick={() => setSelectedDiffRequest(req)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006b3f] hover:underline"
                            >
                              <Eye className="w-3 h-3" />
                              View Proposed Changes
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            req.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {req.status}
                          </span>
                          {req.reviewedByName && (
                            <div className="text-[10px] text-muted mt-1">
                              by {req.reviewedByName}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4.5 whitespace-nowrap">
                          {isPending ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveSiteChange(req)}
                                disabled={processingSiteId === req.id}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 active:scale-95"
                                title="Approve and Apply to Database"
                              >
                                {processingSiteId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                              <button
                                onClick={() => setShowSiteRejectModal(req)}
                                disabled={processingSiteId === req.id}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs uppercase tracking-wider border border-rose-200/50 flex items-center gap-1.5 transition-all active:scale-95"
                                title="Reject Request"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-muted">
                              {req.reviewedAt && new Date(req.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : isLoading ? (
            /* Regular Ops Requests Table */
            <div className="flex justify-center items-center py-20 flex-col gap-3">
              <Loader2 className="w-9 h-9 animate-spin text-[#006b3f]" />
              <p className="text-sm font-bold text-muted uppercase tracking-widest">Loading Requests...</p>
            </div>
          ) : filteredRequests.filter(r => {
            if (activeTab === 'ReportAccess') return r.status === 'Pending' && r.moduleName === 'ReportAccess';
            if (activeTab === 'Quotations') return r.status === 'Pending' && r.moduleName === 'Quotation';
            if (activeTab === 'Contracts') return r.status === 'Pending' && r.moduleName === 'Contract';
            if (activeTab === 'Approved') return r.status === 'Approved';
            if (activeTab === 'Rejected') return r.status === 'Rejected';
            return true;
          }).length === 0 ? (
            <div className="text-center py-24 text-muted flex flex-col items-center max-w-sm mx-auto">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 mb-4 animate-pulse">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">You're all caught up!</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                There are no requests matching your current filter conditions.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Request Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Module</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Raised On</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredRequests
                  .filter(r => {
                    if (activeTab === 'ReportAccess') return r.status === 'Pending' && r.moduleName === 'ReportAccess';
                    if (activeTab === 'Quotations') return r.status === 'Pending' && r.moduleName === 'Quotation';
                    if (activeTab === 'Contracts') return r.status === 'Pending' && r.moduleName === 'Contract';
                    if (activeTab === 'Approved') return r.status === 'Approved';
                    if (activeTab === 'Rejected') return r.status === 'Rejected';
                    return true;
                  })
                  .map(req => {
                    const reqPasscode = req.moduleName === 'ReportAccess' ? (extractPasscode(req.comments) || generateDeterministicPasscode(req.id)) : '';
                    const employeeName = req.requestedByName || 'System';
                    const initial = employeeName.charAt(0).toUpperCase();

                    return (
                      <tr key={req.id} className="hover:bg-gray-50/30 transition-colors">
                        {/* Employee Column */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0 shadow-sm">
                              {initial}
                            </div>
                            <span className="text-sm font-bold text-gray-900">{employeeName}</span>
                          </div>
                        </td>

                        {/* Request Details Column */}
                        <td className="px-6 py-4.5">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-900 leading-snug break-words max-w-[280px]">
                              {req.title}
                            </p>
                            {req.comments && (
                              <p className="text-xs text-muted leading-relaxed">
                                <span className="font-semibold">{req.status === 'Approved' ? 'Feedback:' : 'Rejection Reason:'}</span> "{req.comments}"
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Module Column */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm">
                            {getModuleIcon(req.moduleName)}
                            {req.moduleName}
                          </span>
                        </td>

                        {/* Entity Column */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                            {req.entityName || 'General'}
                          </span>
                        </td>

                        {/* Raised On Column */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <span className="text-xs text-muted font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(req.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>

                        {/* Status Column with Passcode */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[req.status]}`}>
                              {req.status}
                            </span>
                            
                            {/* Copyable passcode inline details */}
                            {req.moduleName === 'ReportAccess' && req.status === 'Approved' && reqPasscode && (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-1 text-xs">
                                <span className="font-mono font-bold tracking-widest text-[#006b3f]">{reqPasscode}</span>
                                <button
                                  onClick={() => handleCopy(reqPasscode, req.id)}
                                  className="text-[#006b3f] hover:scale-110 active:scale-95 transition-transform"
                                  title="Copy Passcode"
                                >
                                  {copiedId === req.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4.5 whitespace-nowrap text-sm">
                          {req.status === 'Pending' ? (
                            <div className="flex items-center gap-2.5">
                              <button
                                onClick={() => handleApprove(req)}
                                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border border-emerald-200/50 transition-all flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
                                title="Approve Request"
                                disabled={processingId === req.id}
                              >
                                {processingId === req.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setShowRejectModal(req)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200/50 transition-all flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
                                title="Reject Request"
                                disabled={processingId === req.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="text-xs font-semibold text-muted">
                                Processed on:<br />
                                <span className="text-gray-700 font-bold">
                                  {new Date(req.updatedAt).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              {req.status === 'Approved' && req.moduleName === 'ReportAccess' && (
                                <button
                                  onClick={() => handleLock(req)}
                                  disabled={processingId === req.id}
                                  className="flex items-center justify-center gap-1.5 w-fit px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200/50 transition-all text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95"
                                  title="Lock Access Now"
                                >
                                  {processingId === req.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Lock className="w-3 h-3" />
                                  )}
                                  Lock
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-fade-in-up">
            <div className="p-5 border-b border-border bg-rose-50/50">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2 uppercase tracking-wide">
                <XCircle className="w-5 h-5" /> Reject Request
              </h3>
            </div>
            <form onSubmit={handleReject} className="p-5 space-y-4">
              <p className="text-xs text-muted font-semibold">
                You are about to reject the request for:
                <strong className="block text-sm text-gray-900 mt-1.5 leading-snug">{showRejectModal.title}</strong>
              </p>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-muted">Reason for Rejection *</label>
                <textarea 
                  className="form-input w-full min-h-[100px] text-sm py-2 px-3 rounded-xl border-border focus:ring-[#006b3f] focus:border-[#006b3f]"
                  placeholder="Provide feedback note explaining why this access request is being rejected..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 rounded-xl text-xs uppercase font-bold py-2.5" 
                  onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl border-none shadow-sm shadow-rose-600/10" 
                  disabled={processingId === showRejectModal.id}
                >
                  {processingId === showRejectModal.id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Change Request Diff Modal */}
      {selectedDiffRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
            <div className="p-5 border-b border-gray-100 bg-[#006b3f]/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <History className="w-5 h-5 text-[#006b3f]" /> Change Request Details
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {selectedDiffRequest.siteName} • Period: {selectedDiffRequest.targetMonth}/{selectedDiffRequest.targetYear}
                </p>
              </div>
              <button onClick={() => setSelectedDiffRequest(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs">
                <div className="font-bold text-amber-900 uppercase tracking-wider mb-1">Reason for Historical Modification:</div>
                <div className="text-amber-800 italic">{selectedDiffRequest.reason}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDiffRequest.originalData && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-black uppercase text-gray-600 tracking-wider mb-2">Original Data</h4>
                    <pre className="text-xs font-mono bg-white p-3 rounded-lg border border-gray-100 overflow-x-auto text-gray-700 max-h-52">
                      {JSON.stringify(selectedDiffRequest.originalData, null, 2)}
                    </pre>
                  </div>
                )}

                <div className={`p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 ${!selectedDiffRequest.originalData ? 'md:col-span-2' : ''}`}>
                  <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider mb-2">Proposed Changes ({selectedDiffRequest.requestType})</h4>
                  <pre className="text-xs font-mono bg-white p-3 rounded-lg border border-emerald-100 overflow-x-auto text-emerald-900 max-h-52">
                    {JSON.stringify(selectedDiffRequest.proposedData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl text-xs font-bold uppercase" onClick={() => setSelectedDiffRequest(null)}>
                Close
              </Button>
              {selectedDiffRequest.status === 'Pending' && (
                <Button 
                  variant="primary" 
                  className="bg-[#006b3f] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                  onClick={() => {
                    handleApproveSiteChange(selectedDiffRequest);
                    setSelectedDiffRequest(null);
                  }}
                >
                  Approve This Change
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Site Change Modal */}
      {showSiteRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-fade-in-up">
            <div className="p-5 border-b border-border bg-rose-50/50">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2 uppercase tracking-wide">
                <XCircle className="w-5 h-5" /> Reject Site Change Request
              </h3>
            </div>
            <form onSubmit={handleRejectSiteChange} className="p-5 space-y-4">
              <p className="text-xs text-muted font-semibold">
                Rejecting modification request for:
                <strong className="block text-sm text-gray-900 mt-1.5 leading-snug">{showSiteRejectModal.siteName} ({showSiteRejectModal.targetMonth}/{showSiteRejectModal.targetYear})</strong>
              </p>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-muted">Rejection Feedback *</label>
                <textarea 
                  className="form-input w-full min-h-[100px] text-sm py-2 px-3 rounded-xl border-border focus:ring-[#006b3f] focus:border-[#006b3f]"
                  placeholder="Explain why this historical modification request cannot be approved..."
                  value={siteRejectReason}
                  onChange={e => setSiteRejectReason(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 rounded-xl text-xs uppercase font-bold py-2.5" 
                  onClick={() => { setShowSiteRejectModal(null); setSiteRejectReason(''); }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl border-none shadow-sm shadow-rose-600/10" 
                  disabled={processingSiteId === showSiteRejectModal.id}
                >
                  {processingSiteId === showSiteRejectModal.id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ApprovalsInbox;
