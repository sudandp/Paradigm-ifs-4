import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Plus, Trash2, CheckCircle2, Clock, MapPin,
  Phone, TrendingUp, FileText, Car, Building2, Target,
  AlertCircle, Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCrmStore } from '../../store/crmStore';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface MetricRow {
  metric: string;
  target: string;
  actual: string;
  remarks: string;
}

interface BdReportFormData {
  attendanceStatus: 'Present' | 'Absent';
  checkInTime: string;
  checkOutTime: string;
  workingHours: string;
  kmsTravelled: string;
  sitesVisited: string[];
  prospectCalls: string;
  followupCalls: string;
  notes: string;
  metrics: MetricRow[];
}

const DEFAULT_METRICS: MetricRow[] = [
  { metric: 'Outbound Calls (New Prospects)', target: '', actual: '', remarks: '' },
  { metric: 'Follow-up Calls / Emails', target: '', actual: '', remarks: '' },
  { metric: 'Site Visits Conducted', target: '', actual: '', remarks: '' },
  { metric: 'Proposals Submitted', target: '', actual: '', remarks: '' },
  { metric: 'New Leads Added', target: '', actual: '', remarks: '' },
];

const BdDailyReport: React.FC = () => {
  const navigate = useNavigate();
  const { user, lastCheckInTime, lastCheckOutTime } = useAuthStore();
  const { leads, fetchLeads } = useCrmStore();
  const [isSending, setIsSending] = useState(false);
  const [newSiteInput, setNewSiteInput] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [managerEmail, setManagerEmail] = useState('');

  const today = format(new Date(), 'dd/MM/yyyy');
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    try { return format(new Date(iso), 'hh:mm a'); } catch { return ''; }
  };

  const calcWorkingHours = useCallback(() => {
    if (!lastCheckInTime || !lastCheckOutTime) return '';
    try {
      const inMs = new Date(lastCheckInTime).getTime();
      const outMs = new Date(lastCheckOutTime).getTime();
      if (outMs <= inMs) return '';
      const diffMs = outMs - inMs;
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      return `${hrs}h ${mins}m`;
    } catch { return ''; }
  }, [lastCheckInTime, lastCheckOutTime]);

  const todayNewLeads = leads.filter(lead => {
    const createdDate = lead.createdAt?.split('T')[0];
    return createdDate === todayIso && (lead.createdBy === user?.id || lead.assignedTo === user?.id);
  });

  const [form, setForm] = useState<BdReportFormData>({
    attendanceStatus: 'Present',
    checkInTime: formatTime(lastCheckInTime),
    checkOutTime: formatTime(lastCheckOutTime),
    workingHours: calcWorkingHours(),
    kmsTravelled: '',
    sitesVisited: [],
    prospectCalls: '',
    followupCalls: '',
    notes: '',
    metrics: DEFAULT_METRICS,
  });

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      checkInTime: formatTime(lastCheckInTime),
      checkOutTime: formatTime(lastCheckOutTime),
      workingHours: calcWorkingHours(),
    }));
  }, [lastCheckInTime, lastCheckOutTime, calcWorkingHours]);

  useEffect(() => {
    const fetchManager = async () => {
      if (!(user as any)?.reportingManagerId) return;
      try {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('id', (user as any).reportingManagerId)
          .single();
        if (data?.email) setManagerEmail(data.email);
      } catch { /* silent */ }
    };
    fetchManager();
  }, [user]);

  const addSite = () => {
    const trimmed = newSiteInput.trim();
    if (!trimmed) return;
    setForm(prev => ({ ...prev, sitesVisited: [...prev.sitesVisited, trimmed] }));
    setNewSiteInput('');
  };

  const removeSite = (idx: number) => {
    setForm(prev => ({ ...prev, sitesVisited: prev.sitesVisited.filter((_, i) => i !== idx) }));
  };

  const updateMetric = (idx: number, field: keyof MetricRow, value: string) => {
    setForm(prev => {
      const updated = [...prev.metrics];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, metrics: updated };
    });
  };

  const computeVariance = (target: string, actual: string) => {
    const t = parseFloat(target);
    const a = parseFloat(actual);
    if (isNaN(t) || isNaN(a)) return null;
    return a - t;
  };

  const buildEmailHtml = (): string => {
    const statusColor = form.attendanceStatus === 'Present' ? '#059669' : '#dc2626';
    const statusBg = form.attendanceStatus === 'Present' ? '#f0fdf4' : '#fef2f2';

    const sitesRows = form.sitesVisited.length > 0
      ? form.sitesVisited.map((s, i) =>
          `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="padding:8px 14px;color:#374151;font-size:13px;">${i + 1}</td>
            <td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:600;">${s}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No sites visited today</td></tr>`;

    const leadsRows = todayNewLeads.length > 0
      ? todayNewLeads.map((l, i) =>
          `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="padding:8px 14px;color:#374151;font-size:13px;">${i + 1}</td>
            <td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:600;">${l.clientName}</td>
            <td style="padding:8px 14px;color:#374151;font-size:13px;">${l.city || '—'}</td>
            <td style="padding:8px 14px;color:#374151;font-size:13px;">${l.propertyType || '—'}</td>
            <td style="padding:8px 14px;font-size:13px;">
              <span style="display:inline-block;padding:2px 10px;border-radius:20px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;">${l.status}</span>
            </td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No new leads added today</td></tr>`;

    const metricsRows = form.metrics.map((m, i) => {
      const v = computeVariance(m.target, m.actual);
      const vText = v === null ? '—' : v >= 0 ? `+${v}` : `${v}`;
      const vColor = v === null ? '#94a3b8' : v >= 0 ? '#059669' : '#dc2626';
      return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
        <td style="padding:10px 14px;color:#1e293b;font-size:13px;font-weight:600;">${m.metric}</td>
        <td style="padding:10px 14px;text-align:center;color:#374151;font-size:13px;">${m.target || '—'}</td>
        <td style="padding:10px 14px;text-align:center;color:#374151;font-size:13px;font-weight:700;">${m.actual || '—'}</td>
        <td style="padding:10px 14px;text-align:center;font-size:13px;font-weight:700;color:${vColor};">${vText}</td>
        <td style="padding:10px 14px;color:#6b7280;font-size:12px;">${m.remarks || '—'}</td>
      </tr>`;
    }).join('');

    const stageGroups: Record<string, number> = {};
    leads.filter(l => !['Won', 'Lost'].includes(l.status)).forEach(l => {
      stageGroups[l.status] = (stageGroups[l.status] || 0) + 1;
    });
    const pipelineRows = Object.entries(stageGroups).length > 0
      ? Object.entries(stageGroups).map(([stage, count], i) =>
          `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:600;">${stage}</td>
            <td style="padding:8px 14px;text-align:center;color:#374151;font-size:13px;font-weight:700;">${count}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No active leads</td></tr>`;

    const activeTotal = leads.filter(l => !['Won', 'Lost'].includes(l.status)).length;
    const notesSection = form.notes ? `
    <tr><td style="background:#ffffff;padding:0 36px 24px 36px;">
      <div style="font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">Additional Notes</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;color:#374151;line-height:1.6;">${form.notes}</div>
    </td></tr>` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background:#f1f5f9;font-family:'Inter',-apple-system,sans-serif;margin:0;padding:24px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:760px;margin:0 auto;">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;border-radius:16px 16px 0 0;padding:28px 36px;border-bottom:4px solid #16a34a;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" width="50%">
        <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm" style="height:44px;display:block;">
        <div style="margin-top:10px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Business Development</div>
      </td>
      <td valign="top" align="right" width="50%">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;display:inline-block;text-align:left;">
          <div style="font-size:11px;color:#166534;text-transform:uppercase;font-weight:700;">Daily Activity Report</div>
          <div style="font-size:22px;color:#15803d;font-weight:800;margin-top:4px;">${today}</div>
          <div style="font-size:11px;color:#374151;margin-top:4px;">BD: <strong>${user?.name || 'N/A'}</strong></div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 1: ATTENDANCE -->
  <tr><td style="background:#ffffff;padding:24px 36px;">
    <div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 0;"><tr>
      <td style="background:${statusBg};border:1px solid ${statusColor}30;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</div>
        <div style="font-size:18px;font-weight:800;color:${statusColor};margin-top:6px;">${form.attendanceStatus}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check In</div>
        <div style="font-size:16px;font-weight:700;color:#1e293b;margin-top:6px;">${form.checkInTime || '—'}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check Out</div>
        <div style="font-size:16px;font-weight:700;color:#1e293b;margin-top:6px;">${form.checkOutTime || '—'}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Work Hours</div>
        <div style="font-size:16px;font-weight:800;color:#1d4ed8;margin-top:6px;">${form.workingHours || '—'}</div>
      </td>
      <td style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;">KMs Travelled</div>
        <div style="font-size:16px;font-weight:800;color:#d97706;margin-top:6px;">${form.kmsTravelled || '0'} km</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 2: ACTIVITY SUMMARY -->
  <tr><td style="background:#ffffff;padding:0 36px 24px;">
    <div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">2. Activity Summary</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 0;margin-bottom:20px;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;text-align:center;">
        <div style="font-size:10px;color:#166534;font-weight:700;text-transform:uppercase;">New Prospect Calls</div>
        <div style="font-size:40px;font-weight:800;color:#059669;margin-top:6px;line-height:1;">${form.prospectCalls || '0'}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;text-align:center;">
        <div style="font-size:10px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Follow-up Calls</div>
        <div style="font-size:40px;font-weight:800;color:#2563eb;margin-top:6px;line-height:1;">${form.followupCalls || '0'}</div>
      </td>
      <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;text-align:center;">
        <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;">New Leads Added</div>
        <div style="font-size:40px;font-weight:800;color:#d97706;margin-top:6px;line-height:1;">${todayNewLeads.length}</div>
      </td>
      <td style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;text-align:center;">
        <div style="font-size:10px;color:#5b21b6;font-weight:700;text-transform:uppercase;">Sites Visited</div>
        <div style="font-size:40px;font-weight:800;color:#7c3aed;margin-top:6px;line-height:1;">${form.sitesVisited.length}</div>
      </td>
    </tr></table>
    <!-- Sites List -->
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:8px;">Sites Visited</div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">#</th>
          <th style="padding:8px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Site / Property</th>
        </tr></thead>
        <tbody>${sitesRows}</tbody>
      </table>
    </div>
  </td></tr>

  <!-- SECTION 3: NEW LEADS LIST -->
  <tr><td style="background:#ffffff;padding:0 36px 24px;">
    <div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">3. New Leads Added Today (${todayNewLeads.length})</div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#f0fdf4;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#166534;font-weight:700;">#</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#166534;font-weight:700;">Lead / Client Name</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#166534;font-weight:700;">Location</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#166534;font-weight:700;">Type</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#166534;font-weight:700;">Stage</th>
        </tr></thead>
        <tbody>${leadsRows}</tbody>
      </table>
    </div>
  </td></tr>

  <!-- SECTION 4: METRICS -->
  <tr><td style="background:#ffffff;padding:0 36px 24px;">
    <div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">4. Activity Metrics — Target vs Actual</div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#1e3a5f;">
          <th style="padding:12px 14px;text-align:left;font-size:11px;color:#fff;font-weight:700;">Activity Metric</th>
          <th style="padding:12px 14px;text-align:center;font-size:11px;color:#fff;font-weight:700;">Daily Target</th>
          <th style="padding:12px 14px;text-align:center;font-size:11px;color:#fff;font-weight:700;">Actual</th>
          <th style="padding:12px 14px;text-align:center;font-size:11px;color:#fff;font-weight:700;">+/−</th>
          <th style="padding:12px 14px;text-align:left;font-size:11px;color:#fff;font-weight:700;">Remarks</th>
        </tr></thead>
        <tbody>${metricsRows}</tbody>
      </table>
    </div>
  </td></tr>

  <!-- SECTION 5: PIPELINE SNAPSHOT -->
  <tr><td style="background:#ffffff;padding:0 36px 24px;">
    <div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">5. CRM Pipeline Snapshot</div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Count</th>
        </tr></thead>
        <tbody>${pipelineRows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;text-align:right;font-size:11px;color:#94a3b8;">Total active pipeline: ${activeTotal} leads</div>
  </td></tr>

  ${notesSection}

  <!-- FOOTER -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:20px 36px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:12px;color:#6b7280;">&copy; ${new Date().getFullYear()} <strong>Paradigm FMS</strong> &middot; BD Daily Activity Report</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Confidential Internal Report</p></td>
    </tr></table>
  </td></tr>

</table>
</body>
</html>`;
  };

  const handleSubmit = async () => {
    const recipients: string[] = [];
    if (recipientEmail.trim()) recipients.push(recipientEmail.trim());
    if (managerEmail.trim()) recipients.push(managerEmail.trim());

    if (recipients.length === 0) {
      toast.error('Please enter at least one recipient email address');
      return;
    }

    setIsSending(true);
    try {
      const html = buildEmailHtml();
      await api.sendEmail({
        to: recipients,
        subject: `BD Daily Activity Report — ${user?.name || 'BD'} — ${today}`,
        html,
      });
      toast.success('Report sent successfully! ✅');
      setTimeout(() => navigate('/crm'), 1500);
    } catch (err: any) {
      toast.error(`Failed to send: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-border bg-page/40 text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-muted';
  const sectionHeader = (num: number, icon: React.ReactNode, title: string, badge?: React.ReactNode) => (
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-page/30">
      {icon}
      <h2 className="text-[11px] font-black uppercase tracking-widest text-primary-text">{num}. {title}</h2>
      {badge && <span className="ml-auto">{badge}</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-page pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/crm')} className="p-2 rounded-xl hover:bg-page transition-colors text-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-primary-text">BD Daily Activity Report</h1>
            <p className="text-[11px] text-muted">{today} · {user?.name}</p>
          </div>
          <Button onClick={handleSubmit} isLoading={isSending} className="gap-2 !rounded-xl !py-2 !px-4 !text-sm">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-5">

        {/* Attendance */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(1, <CheckCircle2 className="h-4 w-4 text-emerald-600" />, 'Attendance & Time')}
          <div className="p-5 space-y-4">
            <div className="flex gap-3">
              {(['Present', 'Absent'] as const).map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, attendanceStatus: s }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    form.attendanceStatus === s
                      ? s === 'Present' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                      : 'bg-page border-border text-muted hover:text-primary-text'
                  }`}
                >{s}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Check-in', key: 'checkInTime', Icon: Clock, ro: false },
                { label: 'Check-out', key: 'checkOutTime', Icon: Clock, ro: false },
                { label: 'Working Hours', key: 'workingHours', Icon: Clock, ro: true },
                { label: 'KMs Travelled', key: 'kmsTravelled', Icon: Car, ro: false, ph: 'e.g. 45' },
              ].map(({ label, key, Icon, ro, ph }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">{label}</label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                    <input type="text" readOnly={ro}
                      className={`${inputCls} pl-8 ${ro ? 'opacity-60 cursor-not-allowed' : ''}`}
                      value={form[key as keyof BdReportFormData] as string}
                      placeholder={ro ? 'Auto' : ph || ''}
                      onChange={e => !ro && setForm(p => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sites Visited */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(2, <Building2 className="h-4 w-4 text-violet-600" />, 'Sites Visited',
            <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{form.sitesVisited.length}</span>
          )}
          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <input type="text" className={`${inputCls} flex-1`}
                placeholder="Site or property name (press Enter)"
                value={newSiteInput}
                onChange={e => setNewSiteInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSite()}
              />
              <button onClick={addSite} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {form.sitesVisited.length === 0
              ? <p className="text-center py-5 text-muted text-sm">No sites added yet</p>
              : <div className="space-y-2">
                {form.sitesVisited.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-page/50 px-3 py-2.5 rounded-xl border border-border">
                    <MapPin className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-primary-text">{s}</span>
                    <button onClick={() => removeSite(i)} className="text-muted hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        {/* Calls */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(3, <Phone className="h-4 w-4 text-emerald-600" />, 'Calls Made Today')}
          <div className="p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">New Prospect Calls</label>
              <input type="number" min="0" className={inputCls} placeholder="0"
                value={form.prospectCalls} onChange={e => setForm(p => ({ ...p, prospectCalls: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">Follow-up Calls</label>
              <input type="number" min="0" className={inputCls} placeholder="0"
                value={form.followupCalls} onChange={e => setForm(p => ({ ...p, followupCalls: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* New Leads */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(4, <TrendingUp className="h-4 w-4 text-amber-600" />, 'New Leads Added Today',
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{todayNewLeads.length} auto-detected</span>
          )}
          <div className="p-5">
            {todayNewLeads.length === 0
              ? <div className="text-center py-8 flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-muted/30" />
                  <p className="text-sm text-muted">No new leads detected for today. Leads you create in the CRM pipeline today will appear here automatically.</p>
                </div>
              : <div className="space-y-2">
                {todayNewLeads.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 bg-page/50 px-3 py-2.5 rounded-xl border border-border">
                    <span className="text-xs font-black text-muted w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary-text truncate">{l.clientName}</p>
                      <p className="text-[11px] text-muted">{l.city || 'No city'} · {l.propertyType || 'N/A'}</p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider whitespace-nowrap">{l.status}</span>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        {/* Activity Metrics */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(5, <Target className="h-4 w-4 text-blue-600" />, 'Activity Metrics — Target vs Actual')}
          <div className="p-5">
            <div className="grid grid-cols-12 gap-2 mb-2 px-1">
              {['Metric (4)', 'Target (2)', 'Actual (2)', '+/− (2)', 'Remarks (2)'].map((h, i) => (
                <div key={i} className={`${i === 0 ? 'col-span-4' : 'col-span-2'} text-[10px] font-black uppercase tracking-wider text-muted ${i > 0 && i < 4 ? 'text-center' : ''}`}>
                  {h.split(' (')[0]}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {form.metrics.map((m, i) => {
                const v = computeVariance(m.target, m.actual);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-page/40 rounded-xl px-3 py-2 border border-border">
                    <div className="col-span-4 text-xs font-semibold text-primary-text leading-tight">{m.metric}</div>
                    <div className="col-span-2">
                      <input type="number" min="0" placeholder="—"
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-white text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={m.target} onChange={e => updateMetric(i, 'target', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0" placeholder="—"
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-white text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={m.actual} onChange={e => updateMetric(i, 'actual', e.target.value)} />
                    </div>
                    <div className={`col-span-2 text-center text-sm font-black ${v === null ? 'text-muted' : v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {v === null ? '—' : v >= 0 ? `+${v}` : `${v}`}
                    </div>
                    <div className="col-span-2">
                      <input type="text" placeholder="Note…"
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={m.remarks} onChange={e => updateMetric(i, 'remarks', e.target.value)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(6, <FileText className="h-4 w-4 text-muted" />, 'Additional Notes')}
          <div className="p-5">
            <textarea className={`${inputCls} h-24 resize-none`}
              placeholder="Observations, challenges, escalations, or next-day plan..."
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {/* Send Config */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {sectionHeader(7, <Send className="h-4 w-4 text-emerald-600" />, 'Send Report To')}
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">Additional Recipient Email</label>
              <input type="email" className={inputCls} placeholder="management@paradigmfms.com"
                value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
            </div>
            {managerEmail && (
              <div className="flex items-center gap-2 text-sm text-muted bg-emerald-50 px-3 py-2.5 rounded-xl border border-emerald-200">
                <Users className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs">Your manager <strong className="text-primary-text">{managerEmail}</strong> will also receive this report.</span>
              </div>
            )}
          </div>
        </div>

        {/* Big Submit */}
        <Button onClick={handleSubmit} isLoading={isSending} className="w-full !py-4 !text-base !rounded-2xl gap-3">
          <Send className="h-5 w-5" />
          Send BD Daily Report
        </Button>

      </div>
    </div>
  );
};

export default BdDailyReport;
