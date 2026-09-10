import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
    Mail,
    Settings,
    Send,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    ArrowLeft,
    Monitor,
    Eye,
    FileText,
    Users,
    Calendar,
    Zap,
    Shield,
    RefreshCw,
    ExternalLink,
    Server,
    Save,
    History,
    Building2,
    MapPin,
    SlidersHorizontal,
    Search,
    UserCheck,
    Layers,
    FileSpreadsheet,
    Filter,
    ChevronDown
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { api } from '../../services/api';
import type { EmailConfig, EmailTemplate, EmailScheduleRule, EmailLog, Role, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';

const DEFAULT_MONTHLY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background-color: #ffffff; font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 1400px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td valign="top" width="50%">
              <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 40px; margin-bottom: 24px; display: block;">
              <div style="font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">ALL EMPLOYEES</div>
            </td>
            <td valign="top" width="50%" align="right" style="text-align: right;">
              <h1 style="font-size: 26px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0; letter-spacing: -0.5px; text-transform: uppercase;">Monthly Attendance Report</h1>
              <div style="font-size: 15px; color: #475569; margin-bottom: 24px; font-weight: 500;">Billing Cycle: {billingCycle}</div>
              <div style="font-size: 12px; color: #94a3b8; font-weight: 500; line-height: 1.6;">Generated: {reportDate} {generatedTime}<br>By: {generatedBy}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
          <tr>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Monthly Presence</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #059669; word-wrap: break-word;">{attendancePercentage}%</div>
              </div>
            </td>
            <td width="2%"></td>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Total Punches</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #2563eb; word-wrap: break-word;">{totalPresent}</div>
              </div>
            </td>
            <td width="2%"></td>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Active Staff</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #1e293b; word-wrap: break-word;">{totalEmployees}</div>
              </div>
            </td>
          </tr>
        </table>
        <div style="overflow-x: auto;">
          {table}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

const DEFAULT_DAILY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paradigm FMS Attendance Report</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 900px; margin: auto; border: 1px solid #e5e7eb; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
    <div style="padding: 25px 35px; background-color: #ffffff; border-bottom: 4px solid #16a34a;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm FMS" style="height: 48px; display: block; max-width: 100%;">
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="display: inline-block; text-align: left; background: #f0fdf4; padding: 10px 18px; border-radius: 8px; border: 1px solid #bbf7d0;">
              <p style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700;">Report Date</p>
              <p style="margin: 2px 0 0; font-size: 14px; color: #15803d; font-weight: 700;">{date}</p>
              <p style="margin: 4px 0 0; font-size: 10px; color: #166534;">Generated: {generatedTime}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding: 20px 35px; background-color: #f8fafc; border-bottom: 1px solid #f3f4f6;">
      <h3 style="margin: 0; font-size: 18px; color: #15803d; font-weight: 700;">Daily Attendance Summary</h3>
    </div>
    <div style="padding: 25px 35px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 12px 0;">
        <tr>
          <td style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #4b5563; text-transform: uppercase; font-weight: 700;">Total Staff</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #111827; font-weight: 800;">{totalEmployees}</p>
          </td>
          <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700;">Present</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #15803d; font-weight: 800;">{totalPresent}</p>
          </td>
          <td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700;">Absent</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #dc2626; font-weight: 800;">{totalAbsent}</p>
          </td>
          <td style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700;">Late</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #d97706; font-weight: 800;">{lateCount}</p>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding: 10px 35px 35px 35px;">
      <div style="margin-bottom: 15px; border-left: 4px solid #16a34a; padding-left: 12px;">
        <h4 style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">Detailed Attendance Log</h4>
      </div>
      <div style="border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f0fdf4;">
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">S.No</th>
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Employee Name</th>
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Department</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">In</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Out</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Hours</th>
              <th style="padding: 12px 15px; text-align: right; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Status</th>
            </tr>
          </thead>
          <tbody style="color: #374151;">
            {table}
          </tbody>
        </table>
      </div>
    </div>
    <div style="padding: 15px 35px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5;">
        <strong>Note:</strong> Attendance ratio is calculated as ({totalPresent} / {totalEmployees}) * 100. Late arrivals are marked based on shift definitions. This is a system-generated report.
      </p>
    </div>
    <div style="padding: 25px 35px; background-color: #ffffff; border-top: 1px solid #f3f4f6;">
      <table style="width: 100%;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">&copy; {year} <strong>Paradigm FMS</strong></p>
          </td>
          <td style="text-align: right;">
            <p style="margin: 0; font-size: 11px; color: #16a34a; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Confidential Internal Report</p>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;

type SubTab = 'config' | 'smtp_pool' | 'templates' | 'schedules' | 'logs';

const EmailTagInput: React.FC<{
    label: string;
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}> = ({ label, tags, onChange, placeholder }) => {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const addTag = (val: string) => {
        const trimmed = val.trim().replace(/,$/, '');
        if (!trimmed) return;

        if (!validateEmail(trimmed)) {
            setError('Invalid email format');
            return;
        }

        if (tags.includes(trimmed)) {
            setError('Email already added');
            setInputValue('');
            return;
        }

        onChange([...tags, trimmed]);
        setInputValue('');
        setError(null);
    };

    const removeTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider ml-1">
                {label}
            </label>
            <div className={`flex flex-wrap gap-2 p-2 bg-white border rounded-xl transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 ${error ? 'border-red-300' : 'border-border'}`}>
                {tags.map((tag, i) => (
                    <span 
                        key={`${tag}-${i}`} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-100 animate-in zoom-in-95 duration-200"
                    >
                        {tag}
                        <button 
                            type="button" 
                            onClick={() => removeTag(i)}
                            className="hover:bg-emerald-200/50 rounded-full p-0.5 transition-colors"
                        >
                            <CloseIcon className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        if (error) setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => addTag(inputValue)}
                    placeholder={tags.length === 0 ? placeholder : "Add more..."}
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm p-1 placeholder:text-muted/40"
                />
            </div>
            {error && <p className="text-[10px] text-red-500 font-medium ml-1">{error}</p>}
            <p className="text-[10px] text-muted ml-1">Press Enter or comma to add multiple emails.</p>
        </div>
    );
};

const DEFAULT_BD_DAILY_REPORT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background:#ffffff;font-family:'Inter',-apple-system,sans-serif;margin:0;padding:16px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:760px;margin:0 auto;table-layout:fixed;">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;border-radius:12px 12px 0 0;padding:24px 28px;border-bottom:4px solid #16a34a;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" width="50%">
        <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm" style="height:36px;display:block;">
        <div style="margin-top:8px;font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Business Development</div>
      </td>
      <td valign="top" align="right" width="50%">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;display:inline-block;text-align:left;">
          <div style="font-size:10px;color:#166534;text-transform:uppercase;font-weight:700;">Daily Activity Report</div>
          <div style="font-size:16px;color:#15803d;font-weight:800;margin-top:4px;">{report_date}</div>
          <div style="font-size:10px;color:#374151;margin-top:4px;">BD: <strong>{bd_name}</strong></div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 1: ATTENDANCE -->
  <tr><td style="background:#ffffff;padding:20px 28px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d030;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</div>
        <div style="font-size:14px;font-weight:800;color:#059669;margin-top:4px;word-break:break-word;">{attendance_status}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check In</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px;word-break:break-word;">{check_in_time}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check Out</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px;word-break:break-word;">{check_out_time}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Work Hours</div>
        <div style="font-size:14px;font-weight:800;color:#1d4ed8;margin-top:4px;word-break:break-word;">{working_hours}</div>
      </td>
      <td style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">Travelled</div>
        <div style="font-size:14px;font-weight:800;color:#d97706;margin-top:4px;word-break:break-word;">{kms_travelled}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 2: ACTIVITY SUMMARY -->
  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">2. Activity Summary</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin-bottom:16px;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#166534;font-weight:700;text-transform:uppercase;">Prospect Calls</div>
        <div style="font-size:24px;font-weight:800;color:#059669;margin-top:6px;line-height:1;word-break:break-word;">{prospect_calls}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Follow-ups</div>
        <div style="font-size:24px;font-weight:800;color:#2563eb;margin-top:6px;line-height:1;word-break:break-word;">{followup_calls}</div>
      </td>
      <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">New Leads</div>
        <div style="font-size:24px;font-weight:800;color:#d97706;margin-top:6px;line-height:1;word-break:break-word;">{new_leads_count}</div>
      </td>
      <td style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#5b21b6;font-weight:700;text-transform:uppercase;">Sites Visited</div>
        <div style="font-size:24px;font-weight:800;color:#7c3aed;margin-top:6px;line-height:1;word-break:break-word;">{sites_count}</div>
      </td>
    </tr></table>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{sites_visited}</div>
  </td></tr>

  <!-- SECTION 3: NEW LEADS -->
  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">3. New Leads Added Today</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{new_leads_table}</div>
  </td></tr>

  <!-- SECTION 4: METRICS -->
  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">4. Activity Metrics &mdash; Target vs Actual</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{metrics_table}</div>
  </td></tr>

  <!-- SECTION 5: PIPELINE -->
  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">5. CRM Pipeline Snapshot</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{pipeline_snapshot}</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 28px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:11px;color:#6b7280;">&copy; Paradigm FMS &middot; BD Daily Report</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:10px;color:#16a34a;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Confidential Internal</p></td>
    </tr></table>
  </td></tr>

</table>
</body>
</html>`;

const GROUP_BY_OPTIONS = [
    'Department / Location Wise',
    'Site / Organization Wise',
    'Company / Entity Wise',
    'Role / Designation Wise',
    'Staff Category Wise (Office / Field / Site)',
];

const REPORT_SUBTYPE_OPTIONS = [
    'Basic Attendance Report',
    'Detailed Work Duration & Punches',
    'Summary Report (Present / Absent / Leave Counts)',
    'Overtime (OT) Summary',
    'Late Arrival & Early Departure',
    'Excel / CSV Raw Export',
];

const PARADIGM_STAFF_CATEGORIES = [
    { id: 'office', label: 'Office Staff' },
    { id: 'field', label: 'Field Staff' },
    { id: 'site', label: 'Site Staff' },
];

const getStaffCategoryDisplayLabel = (categories?: string[]) => {
    if (!categories || categories.length === 0 || categories.length === 3 || categories.includes('all') || categories.includes('All')) {
        return 'All Staff';
    }
    const labelMap: Record<string, string> = {
        office: 'Office Staff',
        field: 'Field Staff',
        site: 'Site Staff'
    };
    return categories.map(c => labelMap[c] || c).join(', ');
};

const isAllStaffSelected = (categories?: string[]) => {
    if (!categories || categories.length === 0 || categories.length === 3 || categories.includes('all') || categories.includes('All')) {
        return true;
    }
    return false;
};

const EmailConfigPanel: React.FC = () => {
    const { user } = useAuthStore();
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('config');
    const [activeTemplateDept, setActiveTemplateDept] = useState<string>('HRM');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Data
    const [emailConfig, setEmailConfig] = useState<EmailConfig>({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromEmail: '',
        fromName: 'Paradigm FMS',
        replyTo: '',
        enabled: false,
    });
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [scheduleRules, setScheduleRules] = useState<EmailScheduleRule[]>([]);
    const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [smtpAccounts, setSmtpAccounts] = useState<any[]>([]);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
    const [companySearch, setCompanySearch] = useState('');
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [designationSearch, setDesignationSearch] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [showSmtpForm, setShowSmtpForm] = useState(false);
    const [editingSmtp, setEditingSmtp] = useState<any | null>(null);
    const [smtpTestEmail, setSmtpTestEmail] = useState('');
    const [testingSmtpId, setTestingSmtpId] = useState<string | null>(null);
    const [savingSmtp, setSavingSmtp] = useState(false);
    const [smtpForm, setSmtpForm] = useState({
        name: '', email: '', appPassword: '', host: 'smtp.gmail.com',
        port: 465, secure: true, fromName: 'Paradigm FMS',
        reportTypes: [] as string[], dailyLimit: 2000, isActive: true,
    });

    // Form states
    const [testEmail, setTestEmail] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Partial<EmailScheduleRule> | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    // Backoffice filter panel states (parity with Attendance Dashboard)
    const staffCategoryRef = useRef<HTMLDivElement>(null);
    const [isStaffCategoryOpen, setIsStaffCategoryOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [appliedFilterFlash, setAppliedFilterFlash] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (staffCategoryRef.current && !staffCategoryRef.current.contains(e.target as Node)) {
                setIsStaffCategoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePreview = (template: Partial<EmailTemplate>) => {
        let customGreeting = `Here is your automated status update for <strong>{date}</strong>. The data below reflects real-time triggers from the Paradigm system as of <strong>{generatedTime} IST</strong>.`;
        
        if (template.variables) {
            const customMsgObj = template.variables.find((v: any) => v.key === '_custom_message');
            if (customMsgObj && customMsgObj.description) {
                customGreeting = customMsgObj.description.replace(/\n/g, '<br/>');
            }
        }

        let html = template.bodyTemplate || '';
        
        const hasGreetingPlaceholder = html.includes('{greetingMessage}') || 
                                       html.includes('{customGreeting}') || 
                                       html.includes('{greeting_message}') || 
                                       html.includes('{custom_greeting}') ||
                                       html.includes('{summary}');

        if (!html) {
            html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @media only screen and (max-width: 600px) {
      .stats-container { display: block !important; }
      .stat-card { margin-bottom: 12px !important; width: 100% !important; }
      .header-content { display: block !important; text-align: center !important; }
      .header-right { text-align: center !important; margin-top: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;">
      <div class="header-content" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
            <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;" onerror="this.style.display='none'">
            <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-left: 2px;">PARADIGM</span>
          </div>
        </div>
        <div class="header-right" style="text-align: right;">
          <div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Attendance Management System</div>
          <div style="font-size: 16px; font-weight: 600;">{reportDate}</div>
        </div>
      </div>
    </div>
    
    <div style="padding: 32px;">
      <div style="margin-bottom: 32px;">
        <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Hi,</div>
        <p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">
          ${customGreeting}
        </p>
      </div>

      <div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Detailed Overview</h3>
        </div>
        <div style="padding: 32px; text-align: center; color: #94a3b8; border-bottom: 1px solid #e2e8f0;">
          [ Data Table Will Be Rendered Here ]
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
        } else if (!hasGreetingPlaceholder) {
             const greetingBlock = `\n<div style="font-family: Arial, sans-serif; padding: 0 0 20px 0; color: #333; font-size: 14px; line-height: 1.6; text-align: left;">\n  ${customGreeting}\n</div>\n`;
             if (html.toLowerCase().includes('<body')) {
                 html = html.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
             } else {
                 html = greetingBlock + html;
             }
        } else {
             html = html.replace(/\{greetingMessage\}/g, customGreeting);
             html = html.replace(/\{customGreeting\}/g, customGreeting);
             html = html.replace(/\{greeting_message\}/g, customGreeting);
             html = html.replace(/\{custom_greeting\}/g, customGreeting);
             html = html.replace(/\{summary\}/g, customGreeting);
        }

        // Mock data replacement for standard variables
        const mockData: Record<string, string> = {
            attendancePercentage: '92',
            totalPresent: '46',
            totalAbsent: '4',
            lateCount: '2',
            totalEmployees: '50',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            generatedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            year: new Date().getFullYear().toString()
        };
        
        // Evaluate conditionals
        html = html.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (_m, key, op, val2Str, t, f) => {
            const v1 = parseFloat(mockData[Object.keys(mockData).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
            const v2 = parseFloat(val2Str);
            let ok = false;
            if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
            return ok ? t : f;
        });

        // Evaluate plain text variable tags
        html = html.replace(/\{(\w+)\}/g, (match, key) => {
            const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
            const dataKey = Object.keys(mockData).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
            return dataKey ? mockData[dataKey] : match;
        });

        setPreviewHtml(html);
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [config, tmpl, rules, logs, r, u, smtpPool, locs, entList, orgList] = await Promise.all([
                api.getEmailConfig(),
                api.getEmailTemplates(),
                api.getEmailScheduleRules(),
                api.getEmailLogs(),
                api.getRoles(),
                api.getUsers(),
                api.getSmtpAccounts().catch(() => []),
                api.getLocations().catch(() => []),
                api.getEntities().catch(() => []),
                api.getOrganizations().catch(() => []),
            ]);
            if (config) setEmailConfig(config);
            setTemplates(tmpl);
            setScheduleRules(rules);
            setEmailLogs(logs);
            setRoles(r);
            setUsers(u.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            setSmtpAccounts(smtpPool || []);

            // Dynamic Company / Entity list from Paradigm database
            const entityNames = (entList || []).map((e: any) => e.name).filter(Boolean);
            const userSocieties = (u || []).map((usr: any) => usr.societyName || usr.organizationName).filter(Boolean);
            const allComps = Array.from(new Set([...entityNames, ...userSocieties])).sort((a, b) => a.localeCompare(b));

            // Dynamic Site / Department / Location list from Paradigm database
            const orgNames = (orgList || []).map((o: any) => o.name || o.shortName).filter(Boolean);
            const locNames = (locs || []).map((l: any) => l.name || l.locationName).filter(Boolean);
            const userDepts = (u || []).map((usr: any) => usr.locationName || usr.location || usr.department).filter(Boolean);
            const allDepts = Array.from(new Set([...orgNames, ...locNames, ...userDepts])).sort((a, b) => a.localeCompare(b));

            setAvailableCompanies(allComps);
            setAvailableDepartments(allDepts);
        } catch (err) {
            console.error('Failed to load email data:', err);
            setToast({ message: 'Failed to load email configuration.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // ── CONFIG TAB ──
    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await api.saveEmailConfig(emailConfig);
            setToast({ message: 'Email configuration saved!', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed to save: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            setToast({ message: 'Please enter a test email address.', type: 'error' });
            return;
        }
        setIsTesting(true);
        try {
            await api.sendTestEmail(testEmail);
            setToast({ message: `Test email sent to ${testEmail}!`, type: 'success' });
        } catch (err: any) {
            setToast({ message: `Test failed: ${err.message}`, type: 'error' });
        } finally {
            setIsTesting(false);
        }
    };

    // ── TEMPLATE TAB ──
    const handleSaveTemplate = async () => {
        if (!editingTemplate?.name || !editingTemplate?.subjectTemplate) {
            setToast({ message: 'Template name and subject are required.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const saved = await api.saveEmailTemplate(editingTemplate);
            if (editingTemplate.id) {
                setTemplates(templates.map(t => t.id === saved.id ? saved : t));
            } else {
                setTemplates([saved, ...templates]);
            }
            setEditingTemplate(null);
            setShowTemplateForm(false);
            setToast({ message: 'Template saved!', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed to save template: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await api.deleteEmailTemplate(id);
            setTemplates(templates.filter(t => t.id !== id));
            setToast({ message: 'Template deleted.', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed: ${err.message}`, type: 'error' });
        }
    };

    // ── SCHEDULE TAB ──
    const updateScheduleConfig = (updates: Partial<NonNullable<EmailScheduleRule['scheduleConfig']>>) => {
        setEditingSchedule(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                scheduleConfig: {
                    ...(prev.scheduleConfig || { time: '21:00', frequency: 'daily' }),
                    ...updates
                }
            };
        });
    };

    const dynamicDesignations = Array.from(new Set([
        ...roles.map(r => r.displayName || (r as any).name),
        ...users.map(u => u.role).filter(Boolean)
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));

    const filteredCompanies = availableCompanies.filter(c => c.toLowerCase().includes(companySearch.toLowerCase()));
    const filteredDepartments = availableDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase()));

    const handleSaveSchedule = async () => {
        if (!editingSchedule?.name) {
            setToast({ message: 'Rule name is required.', type: 'error' });
            return;
        }
        if (!editingSchedule?.templateId && editingSchedule?.triggerType !== 'document_expiry') {
            setToast({ message: 'Please select an email template.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const scheduleToSave = { ...editingSchedule };
            if (scheduleToSave.recipientType === 'users') {
                const selectedEmails = users
                    .filter(u => (scheduleToSave.recipientUserIds || []).includes(u.id))
                    .map(u => u.email)
                    .filter(Boolean);
                scheduleToSave.recipientEmails = selectedEmails;
            } else if (scheduleToSave.recipientType === 'role') {
                const selectedEmails = users
                    .filter(u => (scheduleToSave.recipientRoles || []).includes(u.roleId || (u as any).role?.id))
                    .map(u => u.email)
                    .filter(Boolean);
                scheduleToSave.recipientEmails = selectedEmails;
            }
            console.log('Saving schedule:', scheduleToSave);
            const saved = await api.saveEmailScheduleRule(scheduleToSave);
            if (editingSchedule.id) {
                setScheduleRules(prev => prev.map(r => r.id === saved.id ? saved : r));
                setToast({ message: 'Schedule rule updated successfully!', type: 'success' });
            } else {
                setScheduleRules(prev => [saved, ...prev]);
                setToast({ message: 'New schedule rule created!', type: 'success' });
            }
            setEditingSchedule(null);
            setShowScheduleForm(false);
        } catch (err: any) {
            console.error('Save schedule error:', err);
            setToast({ message: `Failed to save: ${err.message || 'Unknown error'}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm('Delete this schedule rule?')) return;
        try {
            await api.deleteEmailScheduleRule(id);
            setScheduleRules(scheduleRules.filter(r => r.id !== id));
            setToast({ message: 'Schedule deleted.', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed: ${err.message}`, type: 'error' });
        }
    };

    const handleSendLiveSchedule = async (id: string) => {
        setToast({ message: 'Compiling real-time data and sending report...', type: 'success' });
        try {
            await api.testEmailScheduleRule(id);
            setToast({ message: 'Live report with real-time data delivered successfully to recipients!', type: 'success' });
            const logs = await api.getEmailLogs();
            setEmailLogs(logs);
        } catch (err: any) {
            setToast({ message: `Failed to send report: ${err.message}`, type: 'error' });
        }
    };

    const handleTestSchedule = async (id: string) => {
        setToast({ message: 'Sending test email...', type: 'success' });
        try {
            await api.testEmailScheduleRule(id);
            setToast({ message: 'Test email sent!', type: 'success' });
            // Refresh logs
            const logs = await api.getEmailLogs();
            setEmailLogs(logs);
        } catch (err: any) {
            setToast({ message: `Test failed: ${err.message}`, type: 'error' });
        }
    };

    if (isLoading) return <LoadingScreen message="Loading email configuration..." />;

    const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
        report: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
        alert: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
        greeting: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
        document_expiry: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Email Preview (Full Screen View) */}
            {previewHtml ? (
                <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300" style={{ minHeight: 'calc(100vh - 200px)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shadow-sm z-10 relative">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setPreviewHtml(null)} 
                                className="flex items-center gap-2 text-slate-500 hover:text-accent hover:bg-accent/5 px-3 py-1.5 rounded-lg transition-all text-sm font-bold"
                            >
                                <ArrowLeft className="h-4 w-4" /> 
                                Back to Templates
                            </button>
                            <div className="h-5 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-accent" />
                                <h3 className="font-bold text-primary-text">Live Preview</h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200 text-xs font-semibold text-slate-500">
                                <Monitor className="h-3.5 w-3.5" /> Desktop View
                             </div>
                        </div>
                    </div>
                    
                    {/* Preview Canvas */}
                    <div className="p-8 flex-1 flex justify-center bg-slate-50 overflow-y-auto relative" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                        {/* Browser/Email Client Mockup */}
                        <div className="w-full max-w-[800px] bg-white rounded-xl shadow-xl overflow-hidden self-start border border-slate-200/60 ring-1 ring-black/5 mt-4 mb-12">
                            {/* Window Chrome */}
                            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                                </div>
                                <div className="ml-4 flex-1 flex justify-center">
                                    <div className="bg-white px-4 py-1 rounded-md text-[10px] font-bold text-slate-400 tracking-widest uppercase shadow-sm border border-slate-200/50">Inbox - Paradigm FMS</div>
                                </div>
                                <div className="w-12"></div> {/* Spacer for centering */}
                            </div>
                            
                            {/* Email Metadata */}
                            <div className="px-6 py-4 border-b border-slate-100">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                                            PF
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">Paradigm FMS <span className="text-slate-400 font-normal ml-1">&lt;notifications@paradigm.com&gt;</span></div>
                                            <div className="text-xs text-slate-500 mt-0.5">To: employee@company.com</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                </div>
                            </div>

                            {/* Email Body */}
                            <div className="p-8 flex justify-center bg-white min-h-[400px]">
                                <div 
                                    className="w-full max-w-[700px]" 
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Sub-tabs */}
            <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
                {([
                    { id: 'config' as SubTab, label: 'Configuration', icon: Settings },
                    { id: 'smtp_pool' as SubTab, label: 'SMTP Pool', icon: Server },
                    { id: 'templates' as SubTab, label: 'Templates', icon: FileText },
                    { id: 'schedules' as SubTab, label: 'Schedules', icon: Calendar },
                    { id: 'logs' as SubTab, label: 'Delivery Logs', icon: History },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeSubTab === tab.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon className="mr-2 h-3.5 w-3.5" /> {tab.label}
                        {tab.id === 'smtp_pool' && smtpAccounts.length > 0 && (
                            <span className="ml-1.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{smtpAccounts.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══════════════ CONFIG TAB ═══════════════ */}
            {activeSubTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <section className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
                                <Server className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">SMTP Configuration</h3>
                                <p className="text-muted text-sm">Configure your Google Workspace email settings.</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="SMTP Host"
                                    value={emailConfig.host}
                                    onChange={e => setEmailConfig({ ...emailConfig, host: e.target.value })}
                                    placeholder="smtp.gmail.com"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="Port"
                                        type="number"
                                        value={emailConfig.port}
                                        onChange={e => setEmailConfig({ ...emailConfig, port: parseInt(e.target.value) || 587 })}
                                    />
                                    <div className="pt-6">
                                        <Checkbox
                                            id="smtp-secure"
                                            label="SSL/TLS"
                                            checked={emailConfig.secure}
                                            onChange={e => setEmailConfig({ ...emailConfig, secure: e.target.checked })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Input
                                label="Email Address (Username)"
                                value={emailConfig.user}
                                onChange={e => setEmailConfig({ ...emailConfig, user: e.target.value, fromEmail: e.target.value })}
                                placeholder="sudhan@paradigmfms.com"
                            />

                            <Input
                                label="App Password"
                                type="password"
                                value={emailConfig.pass}
                                onChange={e => setEmailConfig({ ...emailConfig, pass: e.target.value })}
                                placeholder="Google App Password (16 chars)"
                                description="Generate at myaccount.google.com/apppasswords"
                            />

                            <Input
                                label="Display Name"
                                value={emailConfig.fromName}
                                onChange={e => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                                placeholder="Paradigm FMS"
                            />

                            <Input
                                label="Reply-To Email (optional)"
                                value={emailConfig.replyTo || ''}
                                onChange={e => setEmailConfig({ ...emailConfig, replyTo: e.target.value })}
                                placeholder="support@paradigmfms.com"
                            />

                            <div className={`p-4 rounded-xl border flex items-start gap-3 ${emailConfig.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-page border-border'}`}>
                                <Checkbox
                                    id="email-enabled"
                                    label=""
                                    checked={emailConfig.enabled}
                                    onChange={e => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                                />
                                <div>
                                    <span className="text-sm font-bold">Enable Email Sending</span>
                                    <p className="text-xs text-muted mt-0.5">When enabled, the system can send emails for notifications, reports, and automated alerts.</p>
                                </div>
                            </div>

                            <Button className="w-full h-11" onClick={handleSaveConfig} isLoading={isSaving}>
                                <Save className="mr-2 h-4 w-4" /> Save Configuration
                            </Button>
                        </div>
                    </section>

                    <div className="space-y-6">
                        {/* Test Email */}
                        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <h4 className="font-bold text-primary-text mb-4 flex items-center gap-2">
                                <Send className="h-4 w-4 text-accent" /> Send Test Email
                            </h4>
                            <div className="flex gap-3">
                                <Input
                                    className="flex-1"
                                    placeholder="recipient@example.com"
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                />
                                <Button onClick={handleTestEmail} isLoading={isTesting} className="shrink-0">
                                    Send Test
                                </Button>
                            </div>
                            <p className="text-xs text-muted mt-3">Sends a test email using current config to verify everything works.</p>
                        </section>

                        {/* Quick Stats */}
                        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <h4 className="font-bold text-primary-text mb-4 flex items-center gap-2">
                                <Mail className="h-4 w-4 text-accent" /> Email Overview
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                                    <div className="text-2xl font-black text-emerald-600">{emailLogs.filter(l => l.status === 'sent').length}</div>
                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Emails Sent</div>
                                </div>
                                <div className="p-4 bg-red-50 rounded-xl text-center border border-red-100">
                                    <div className="text-2xl font-black text-red-600">{emailLogs.filter(l => l.status === 'failed').length}</div>
                                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Failed</div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl text-center border border-blue-100">
                                    <div className="text-2xl font-black text-blue-600">{templates.length}</div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Templates</div>
                                </div>
                                <div className="p-4 bg-violet-50 rounded-xl text-center border border-violet-100">
                                    <div className="text-2xl font-black text-violet-600">{scheduleRules.filter(r => r.isActive).length}</div>
                                    <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Active Schedules</div>
                                </div>
                            </div>
                        </section>

                        {/* Connection Status */}
                        <div className={`p-4 rounded-xl border flex items-center gap-3 ${emailConfig.enabled && emailConfig.user ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            {emailConfig.enabled && emailConfig.user ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    <div>
                                        <span className="text-sm font-bold text-emerald-800">SMTP Configured</span>
                                        <p className="text-xs text-emerald-600">Sending as <strong>{emailConfig.fromName}</strong> &lt;{emailConfig.fromEmail || emailConfig.user}&gt;</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                    <div>
                                        <span className="text-sm font-bold text-amber-800">Email Not Configured</span>
                                        <p className="text-xs text-amber-600">Fill in the SMTP settings and enable email sending to get started.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
            {activeSubTab === 'templates' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted" /> Email Templates ({templates.length})
                        </h3>
                        <Button onClick={() => {
                            setEditingTemplate({
                                name: '',
                                subjectTemplate: '',
                                bodyTemplate: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">\n  <h2>{subject}</h2>\n  <p>{message}</p>\n</div>',
                                category: 'alert',
                                variables: [],
                                isActive: true,
                            });
                            setShowTemplateForm(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" /> New Template
                        </Button>
                    </div>

                    {/* Template Form */}
                    {showTemplateForm && editingTemplate && (
                        <div className="bg-card p-6 rounded-2xl border border-accent/20 ring-1 ring-accent/10 space-y-5 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-accent" />
                                    {editingTemplate.id ? 'Edit Template' : 'New Template'}
                                </h4>
                                <button onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Template Name"
                                    value={editingTemplate.name || ''}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    placeholder="e.g. Daily Attendance Report"
                                />
                                <Select
                                    label="Category"
                                    value={editingTemplate.category || 'alert'}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                                >
                                    <option value="report">📊 Report</option>
                                    <option value="alert">🔔 Alert</option>
                                    <option value="greeting">👋 Greeting</option>
                                    <option value="document_expiry">⚠️ Document Expiry</option>
                                </Select>
                            </div>

                            <Input
                                label="Subject Template"
                                value={editingTemplate.subjectTemplate || ''}
                                onChange={e => setEditingTemplate({ ...editingTemplate, subjectTemplate: e.target.value })}
                                placeholder="Daily Attendance Report — {date}"
                                description="Use {variables} for dynamic content"
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-primary-text">Custom Greeting Message (Optional)</label>
                                <textarea
                                    className="w-full h-24 p-3 rounded-xl border border-border focus:ring-2 focus:ring-accent bg-page/30 text-sm"
                                    value={editingTemplate.variables?.find((v: any) => v.key === '_custom_message')?.description || ''}
                                    onChange={e => {
                                        const vars = [...(editingTemplate.variables || [])];
                                        const idx = vars.findIndex(v => v.key === '_custom_message');
                                        if (idx >= 0) vars[idx].description = e.target.value;
                                        else vars.push({ key: '_custom_message', description: e.target.value });
                                        setEditingTemplate({ ...editingTemplate, variables: vars });
                                    }}
                                    placeholder="Enter a creative and energetic greeting message here!"
                                />
                                <p className="text-[11px] text-muted-foreground">This message naturally replaces the default introductory text at the top of the email.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-primary-text">HTML Body Template</label>
                                <textarea
                                    className="w-full h-48 p-4 rounded-xl border border-border focus:ring-2 focus:ring-accent bg-page/30 font-mono text-xs"
                                    value={editingTemplate.bodyTemplate || ''}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                                    placeholder="<div>Your HTML email content here...</div>"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handlePreview(editingTemplate)}
                                    >
                                        <Eye className="h-3 w-3 mr-1" /> Preview
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            const templateName = editingTemplate.name?.trim() || '';
                                            if (templateName === 'Monthly Attendance Report') {
                                                setEditingTemplate({ ...editingTemplate, bodyTemplate: DEFAULT_MONTHLY_HTML });
                                            } else if (templateName === 'Daily Attendance Report') {
                                                setEditingTemplate({ ...editingTemplate, bodyTemplate: DEFAULT_DAILY_HTML });
                                            } else if (templateName === 'CRM BD Daily Report') {
                                                setEditingTemplate({ ...editingTemplate, bodyTemplate: DEFAULT_BD_DAILY_REPORT_HTML });
                                            } else {
                                                setToast({ message: 'No default design available for this template type.', type: 'error' });
                                            }
                                        }}
                                        title="Restore Default Design"
                                    >
                                        <RefreshCw className="h-3 w-3 mr-1" /> Restore Default HTML
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleSaveTemplate} isLoading={isSaving} className="flex-1">
                                    <Save className="h-4 w-4 mr-2" /> {editingTemplate.id ? 'Update' : 'Create'} Template
                                </Button>
                                <Button variant="secondary" onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {/* Horizontal Department Tabs (Matches top navigation design) */}
                    <div className="border-b border-border overflow-x-auto no-scrollbar mb-8">
                        <nav className="-mb-px flex space-x-1 sm:space-x-8" aria-label="Tabs">
                            {['HRM', 'CRM', 'Operations', 'General'].map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setActiveTemplateDept(dept)}
                                    className={`
                                        whitespace-nowrap py-3 px-4 border-b-2 font-bold text-sm tracking-wide transition-colors
                                        ${activeTemplateDept === dept
                                            ? 'border-accent text-accent'
                                            : 'border-transparent text-muted hover:text-primary-text hover:border-slate-300'
                                        }
                                    `}
                                >
                                    {dept} Templates
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {templates.filter(t => t.name.startsWith(activeTemplateDept === 'Operations' ? 'Ops' : activeTemplateDept) || (activeTemplateDept === 'General' && !['HRM', 'CRM', 'Ops'].some(d => t.name.startsWith(d)))).map(tmpl => {
                            const catColor = CATEGORY_COLORS[tmpl.category] || CATEGORY_COLORS.alert;
                            return (
                                <div key={tmpl.id} className={`bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all ${!tmpl.isActive ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${catColor.bg} ${catColor.text} ${catColor.border} border`}>
                                            {tmpl.category.replace('_', ' ')}
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => handlePreview(tmpl)} className="p-1.5 hover:bg-slate-100 rounded-lg text-muted" title="Preview">
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => { setEditingTemplate(tmpl); setShowTemplateForm(true); }} className="p-1.5 hover:bg-accent/10 rounded-lg text-accent" title="Edit">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Delete">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-primary-text mb-1 line-clamp-1">{tmpl.name}</h4>
                                    <p className="text-xs text-muted mb-3 line-clamp-1">{tmpl.subjectTemplate}</p>
                                    {tmpl.variables && tmpl.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {tmpl.variables.slice(0, 4).map(v => (
                                                <span key={v.key} className="text-[9px] px-1.5 py-0.5 bg-page rounded font-mono text-muted">{`{${v.key}}`}</span>
                                            ))}
                                            {tmpl.variables.length > 4 && <span className="text-[9px] text-muted">+{tmpl.variables.length - 4}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {templates.length === 0 && (
                            <div className="col-span-full text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                                <FileText className="h-10 w-10 text-muted/20 mx-auto mb-3" />
                                <p className="text-muted font-medium">No email templates configured yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ SCHEDULES TAB ═══════════════ */}
            {activeSubTab === 'schedules' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted" /> Email Schedules ({scheduleRules.length})
                        </h3>
                        <Button onClick={() => {
                            setEditingSchedule({
                                name: '',
                                templateId: templates[0]?.id || '',
                                triggerType: 'scheduled',
                                scheduleConfig: {
                                    time: '21:00',
                                    frequency: 'daily',
                                    dateRangeMode: 'today',
                                    groupBy: 'Department / Location Wise',
                                    reportSubType: 'Basic Attendance Report',
                                    employeeCodeDigits: 0,
                                    prefixZero: false,
                                    filterEmployeeEnabled: false,
                                    filterEmployeeCode: '',
                                    filterEmployeeExact: false,
                                    filterEmployeeName: '',
                                    filterEmployeeCategory: 'All',
                                    filterEmployeeDesignation: 'All',
                                    filterEmployeeLocation: 'All',
                                    filterEmployeeStatus: 'all',
                                    filterCompanyEnabled: false,
                                    filterCompanies: [],
                                    filterDepartmentEnabled: false,
                                    filterDepartments: [],
                                    exportFileFormat: 'pdf',
                                    recalculateAttendance: false,
                                    showCompanyLogo: true,
                                },
                                reportType: 'attendance_daily',
                                reportFormat: 'html',
                                recipientType: 'role',
                                recipientRoles: [],
                                recipientUserIds: [],
                                recipientEmails: [],
                                isActive: true,
                            });
                            setShowScheduleForm(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" /> New Schedule
                        </Button>
                    </div>

                    {/* Schedule Form */}
                    {showScheduleForm && editingSchedule && (
                        <div className="bg-card p-6 rounded-2xl border border-accent/20 ring-1 ring-accent/10 space-y-5 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-accent" />
                                    {editingSchedule.id ? 'Edit Schedule Rule' : 'New Schedule Rule'}
                                </h4>
                                <button onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <Input
                                label="Rule Name"
                                value={editingSchedule.name || ''}
                                onChange={e => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
                                placeholder="e.g. Daily Attendance to Management"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label="Trigger Type"
                                    value={editingSchedule.triggerType || 'scheduled'}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, triggerType: e.target.value as any })}
                                >
                                    <option value="scheduled">🗓️ Scheduled (Time-based)</option>
                                    <option value="event">⚡ Event-based</option>
                                    <option value="document_expiry">⚠️ Document Expiry</option>
                                </Select>

                                <Select
                                    label="Email Template"
                                    value={editingSchedule.templateId || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, templateId: e.target.value })}
                                >
                                    <option value="">Select template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </Select>

                                <Select
                                    label="Report Type"
                                    value={editingSchedule.reportType || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, reportType: e.target.value })}
                                >
                                    <option value="">No report data</option>
                                    <option value="attendance_daily">📊 Daily Attendance Back Office</option>
                                    <option value="attendance_site_daily">🏗️ Daily Attendance Report - Site</option>
                                    <option value="attendance_monthly">📈 Monthly Attendance Summary</option>
                                    <option value="attendance_work_hours">⏱️ Work Hours Report (Grid)</option>
                                    <option value="attendance_site_ot">🏗️ Site OT Report</option>
                                    <option value="attendance_audit">🔍 Audit Log Report</option>
                                    <option value="leave_summary">🌴 Leave Summary</option>
                                    <option value="invoice_summary">💰 Invoice Summary</option>
                                    <option value="crm_bd_daily">💼 CRM BD Daily Report</option>
                                </Select>
                            </div>

                            {/* Schedule Config */}
                            {editingSchedule.triggerType === 'scheduled' && (
                                <div className="space-y-4 p-4 bg-page/50 rounded-xl border border-dashed border-border">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input
                                            label="Send Time (24h)"
                                            type="time"
                                            value={editingSchedule.scheduleConfig?.time || '21:00'}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, time: e.target.value }
                                            })}
                                        />
                                        <Select
                                            label="Frequency"
                                            value={editingSchedule.scheduleConfig?.frequency || 'daily'}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, frequency: e.target.value as any }
                                            })}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </Select>
                                        <Select
                                            label="Report Data Period (Duration)"
                                            value={editingSchedule.scheduleConfig?.dateRangeMode || (editingSchedule.reportType === 'attendance_monthly' ? 'previous_month' : 'today')}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: {
                                                    ...editingSchedule.scheduleConfig!,
                                                    dateRangeMode: e.target.value as any
                                                }
                                            })}
                                        >
                                            <option value="today">Today (Real-time / Current Day)</option>
                                            <option value="yesterday">Yesterday (Previous Day — Recommended for Morning)</option>
                                            <option value="last_3_days">Last 3 Days</option>
                                            <option value="last_7_days">Last 7 Days</option>
                                            <option value="current_month">Current Month (Month to Date)</option>
                                            <option value="previous_month">Previous Month (Complete Prior Month)</option>
                                            <option value="last_3_months">Last 3 Months</option>
                                            <option value="custom">Custom Range</option>
                                        </Select>
                                    </div>

                                    {editingSchedule.scheduleConfig?.dateRangeMode === 'yesterday' && (
                                        <div className="flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed shadow-2xs">
                                            <span className="text-base leading-none">📅</span>
                                            <div>
                                                <strong className="font-bold text-amber-950">Yesterday Selected:</strong> When this scheduled report triggers (e.g. at 5:00 AM on 8/9/26), it will compile and deliver <strong>yesterday's data (7/9/26)</strong> so morning reports contain complete punch records.
                                            </div>
                                        </div>
                                    )}

                                    {editingSchedule.scheduleConfig?.frequency === 'weekly' && (
                                        <Select
                                            label="Day of Week"
                                            value={editingSchedule.scheduleConfig?.dayOfWeek ?? 1}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, dayOfWeek: parseInt(e.target.value) }
                                            })}
                                        >
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                                <option key={i} value={i}>{d}</option>
                                            ))}
                                        </Select>
                                    )}
                                    {editingSchedule.scheduleConfig?.frequency === 'monthly' && (
                                        <Input
                                            label="Day of Month"
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={editingSchedule.scheduleConfig?.dayOfMonth || 1}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, dayOfMonth: parseInt(e.target.value) }
                                            })}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Event Type */}
                            {editingSchedule.triggerType === 'event' && (
                                <Select
                                    label="When this event occurs..."
                                    value={editingSchedule.eventType || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, eventType: e.target.value })}
                                >
                                    <option value="">Select event...</option>
                                    <option value="leave_approved">Leave Approved</option>
                                    <option value="leave_rejected">Leave Rejected</option>
                                    <option value="task_assigned">Task Assigned</option>
                                    <option value="task_completed">Task Completed</option>
                                    <option value="onboarding_submitted">New Enrollment</option>
                                    <option value="billing_invoice">Invoice Generated</option>
                                </Select>
                            )}

                            {/* Document Expiry Config */}
                            {editingSchedule.triggerType === 'document_expiry' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
                                    <Select
                                        label="Document Source"
                                        value={editingSchedule.expiryConfig?.table || 'entities'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, table: e.target.value }
                                        })}
                                    >
                                        <option value="entities">Entity Documents</option>
                                        <option value="insurances">Insurance Policies</option>
                                        <option value="policies">Company Policies</option>
                                    </Select>
                                    <Select
                                        label="Date Field"
                                        value={editingSchedule.expiryConfig?.field || 'psara_valid_till'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, field: e.target.value }
                                        })}
                                    >
                                        <option value="psara_valid_till">PSARA Validity</option>
                                        <option value="valid_till">Insurance Validity</option>
                                        <option value="shop_establishment_valid_till">Shop & Est. Validity</option>
                                    </Select>
                                    <Input
                                        label="Days Before Expiry"
                                        type="number"
                                        min={1}
                                        value={editingSchedule.expiryConfig?.daysBefore || 30}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, daysBefore: parseInt(e.target.value) }
                                        })}
                                        description="Alert X days before expiry"
                                    />
                                </div>
                            )}

                            {/* ═══════════════ Paradigm Attendance & Report Filters ═══════════════ */}
                            {editingSchedule.reportType && (
                                <div className="p-5 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-emerald-700 text-white rounded-xl shadow-xs">
                                                <SlidersHorizontal className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    {editingSchedule.reportType === 'attendance_daily'
                                                        ? 'Backoffice Attendance Filters'
                                                        : editingSchedule.reportType === 'attendance_site_daily'
                                                        ? 'Site Attendance Report Filters'
                                                        : 'Attendance Report Data & Target Filters'}
                                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                        Live System
                                                    </span>
                                                </h5>
                                                <p className="text-[11px] text-slate-500">
                                                    {editingSchedule.reportType === 'attendance_daily'
                                                        ? 'Filter backoffice staff by role, category, and employment status'
                                                        : 'Filter attendance scope by registered entities, client sites, locations, designations, and employee status'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                                            {editingSchedule.reportType !== 'attendance_daily' && (
                                                <>
                                                    <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200 shadow-2xs">
                                                        🏢 {(editingSchedule.scheduleConfig?.filterCompanies || []).length} / {availableCompanies.length} Entities
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200 shadow-2xs">
                                                        📍 {(editingSchedule.scheduleConfig?.filterDepartments || []).length} / {availableDepartments.length} Sites & Depts
                                                    </span>
                                                </>
                                            )}
                                            <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200 shadow-2xs capitalize">
                                                👤 Status: {editingSchedule.scheduleConfig?.filterEmployeeStatus || 'all'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Top Control Bar: Group By, Report Sub-Type, Employee Code Digits, Prefix Zero — hidden for Back Office */}
                                    {editingSchedule.reportType !== 'attendance_daily' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                        <Select
                                            label="Group By"
                                            value={editingSchedule.scheduleConfig?.groupBy || 'Department / Location Wise'}
                                            onChange={e => updateScheduleConfig({ groupBy: e.target.value })}
                                        >
                                            {GROUP_BY_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </Select>

                                        <Select
                                            label="Report Sub-Type"
                                            value={editingSchedule.scheduleConfig?.reportSubType || 'Basic Attendance Report'}
                                            onChange={e => updateScheduleConfig({ reportSubType: e.target.value })}
                                        >
                                            {REPORT_SUBTYPE_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </Select>

                                        <Select
                                            label="No. of Digits in Employee Code"
                                            value={editingSchedule.scheduleConfig?.employeeCodeDigits ?? 0}
                                            onChange={e => updateScheduleConfig({ employeeCodeDigits: parseInt(e.target.value) || 0 })}
                                        >
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                                <option key={num} value={num}>{num} Digits</option>
                                            ))}
                                        </Select>

                                        <div className="flex items-center h-10 px-3 bg-white rounded-xl border border-border shadow-2xs">
                                            <Checkbox
                                                id="sch-prefix-zero"
                                                label="Prefix Zero"
                                                checked={editingSchedule.scheduleConfig?.prefixZero ?? false}
                                                onChange={e => updateScheduleConfig({ prefixZero: e.target.checked })}
                                                labelClassName="text-xs font-semibold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                    )} {/* end top control bar */}

                                    {/* ── BACKOFFICE DAILY: Attendance Dashboard Filters (Image 1 Same-to-Same) ── */}
                                    {editingSchedule.reportType === 'attendance_daily' && (
                                        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-5">
                                            
                                            {/* Date Pills — Identical to Image 1 Dashboard */}
                                            <div className="relative">
                                                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                                                    {[
                                                        { label: 'Today', key: 'today' },
                                                        { label: 'Yesterday', key: 'yesterday' },
                                                        { label: 'Last 3 Days', key: 'last_3_days' },
                                                        { label: 'Last 7 Days', key: 'last_7_days' },
                                                        { label: 'This Month', key: 'current_month' },
                                                        { label: 'Last Month', key: 'previous_month' },
                                                        { label: 'Last 3 Months', key: 'last_3_months' },
                                                    ].map(filter => {
                                                        const isSelected = (editingSchedule.scheduleConfig?.dateRangeMode || 'today') === filter.key;
                                                        return (
                                                            <button
                                                                key={filter.key}
                                                                type="button"
                                                                onClick={() => updateScheduleConfig({ dateRangeMode: filter.key })}
                                                                className={`whitespace-nowrap flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs ${
                                                                    isSelected
                                                                        ? "bg-[#006b3f] text-white shadow-md border border-[#005632]"
                                                                        : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-300 hover:border-gray-400"
                                                                }`}
                                                            >
                                                                <span>{filter.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    <div className="flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const isCustom = editingSchedule.scheduleConfig?.dateRangeMode === 'custom';
                                                                if (!isCustom) {
                                                                    updateScheduleConfig({ dateRangeMode: 'custom' });
                                                                    setIsDatePickerOpen(true);
                                                                } else {
                                                                    setIsDatePickerOpen(!isDatePickerOpen);
                                                                }
                                                            }}
                                                            className={`whitespace-nowrap flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs ${
                                                                editingSchedule.scheduleConfig?.dateRangeMode === 'custom'
                                                                    ? "bg-[#006b3f] text-white shadow-md border border-[#005632]"
                                                                    : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-300 hover:border-gray-400"
                                                            }`}
                                                        >
                                                            <Calendar className="h-4 w-4" />
                                                            <span>
                                                                {editingSchedule.scheduleConfig?.dateRangeMode === 'custom' && editingSchedule.scheduleConfig?.customDateStart && editingSchedule.scheduleConfig?.customDateEnd
                                                                    ? `${editingSchedule.scheduleConfig.customDateStart} - ${editingSchedule.scheduleConfig.customDateEnd}`
                                                                    : 'Custom Range'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Custom Date Range Picker inputs when Custom Range is active */}
                                                {(editingSchedule.scheduleConfig?.dateRangeMode === 'custom' || isDatePickerOpen) && (
                                                    <div className="flex flex-wrap items-center gap-4 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl mb-1 animate-in fade-in duration-200">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-emerald-900">From Date:</span>
                                                            <input
                                                                type="date"
                                                                value={editingSchedule.scheduleConfig?.customDateStart || ''}
                                                                onChange={e => updateScheduleConfig({ customDateStart: e.target.value })}
                                                                className="px-3 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-emerald-900">To Date:</span>
                                                            <input
                                                                type="date"
                                                                value={editingSchedule.scheduleConfig?.customDateEnd || ''}
                                                                onChange={e => updateScheduleConfig({ customDateEnd: e.target.value })}
                                                                className="px-3 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                        <span className="text-[11px] text-emerald-700 italic">Report will compile attendance between these bounds</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Dropdowns Row 1: Report Type, Location, Company, Site, Staff Category, Role */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                                                {/* Report Type */}
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Report Type</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.reportSubType || 'basic'}
                                                            onChange={e => updateScheduleConfig({ reportSubType: e.target.value })}
                                                        >
                                                            <option value="basic">Basic Report</option>
                                                            <option value="monthly">Monthly Summary</option>
                                                            <option value="work_hours">Work Hours Report</option>
                                                            <option value="leave_balance">Leave Balance Tracker</option>
                                                            <option value="site_ot">Site OT Report</option>
                                                            <option value="log">Attendance Logs</option>
                                                            <option value="audit">Audit Logs</option>
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location */}
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterEmployeeLocation || 'all'}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                updateScheduleConfig({
                                                                    filterEmployeeLocation: val,
                                                                    filterEmployeeLocations: val === 'all' ? [] : [val]
                                                                });
                                                            }}
                                                        >
                                                            <option value="all">All Locations</option>
                                                            {availableDepartments.map(loc => (
                                                                <option key={loc} value={loc}>{loc}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Company */}
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterCompany || 'all'}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                updateScheduleConfig({
                                                                    filterCompany: val,
                                                                    filterCompanyEnabled: val !== 'all',
                                                                    filterCompanies: val === 'all' ? [] : [val]
                                                                });
                                                            }}
                                                        >
                                                            <option value="all">All Companies</option>
                                                            {availableCompanies.map(comp => (
                                                                <option key={comp} value={comp}>{comp}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Site */}
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Site</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterSite || 'all'}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                updateScheduleConfig({
                                                                    filterSite: val,
                                                                    filterSiteEnabled: val !== 'all',
                                                                    filterSites: val === 'all' ? [] : [val],
                                                                    filterDepartmentEnabled: val !== 'all',
                                                                    filterDepartments: val === 'all' ? [] : [val]
                                                                });
                                                            }}
                                                        >
                                                            <option value="all">All Sites</option>
                                                            {availableDepartments.map(site => (
                                                                <option key={site} value={site}>{site}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Staff Category — Dropdown with interactive checkboxes popover */}
                                                <div className="col-span-1 relative" ref={staffCategoryRef}>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Staff Category</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsStaffCategoryOpen(prev => !prev)}
                                                        className="w-full border border-gray-200 rounded-lg pl-3 pr-2 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none text-left flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                                                    >
                                                        <span className="truncate pr-1 text-xs md:text-sm font-medium">
                                                            {getStaffCategoryDisplayLabel(editingSchedule.scheduleConfig?.filterEmployeeCategories)}
                                                        </span>
                                                        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isStaffCategoryOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    {isStaffCategoryOpen && (
                                                        <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                                                            {/* All Staff Option */}
                                                            <label
                                                                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 cursor-pointer text-xs font-semibold text-gray-800 transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                                                    checked={isAllStaffSelected(editingSchedule.scheduleConfig?.filterEmployeeCategories)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            updateScheduleConfig({ filterEmployeeCategories: ['office', 'field', 'site'] });
                                                                        } else {
                                                                            updateScheduleConfig({ filterEmployeeCategories: [] });
                                                                        }
                                                                    }}
                                                                />
                                                                <span>All Staff</span>
                                                            </label>
                                                            <div className="h-px bg-gray-100 my-1" />
                                                            {PARADIGM_STAFF_CATEGORIES.map(cat => {
                                                                const cats = editingSchedule.scheduleConfig?.filterEmployeeCategories || [];
                                                                const isChecked = cats.includes(cat.id);
                                                                return (
                                                                    <label
                                                                        key={cat.id}
                                                                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 cursor-pointer text-xs font-medium text-gray-700 transition-colors"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                let nextCats: string[];
                                                                                if (e.target.checked) {
                                                                                    nextCats = [...cats, cat.id];
                                                                                } else {
                                                                                    nextCats = cats.filter(c => c !== cat.id);
                                                                                }
                                                                                updateScheduleConfig({ filterEmployeeCategories: nextCats });
                                                                            }}
                                                                        />
                                                                        <span>{cat.label}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Role */}
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterEmployeeDesignation || 'all'}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                updateScheduleConfig({
                                                                    filterEmployeeDesignation: val,
                                                                    filterEmployeeDesignations: val === 'all' ? [] : [val]
                                                                });
                                                            }}
                                                        >
                                                            <option value="all">All Roles</option>
                                                            {dynamicDesignations.map(role => (
                                                                <option key={role} value={role}>
                                                                    {role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dropdowns Row 2: Employee, Status, Record Type, Show Records, Apply Filters */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:flex xl:flex-wrap items-end gap-3 pt-1">
                                                {/* Employee */}
                                                <div className="col-span-1 min-w-[170px] flex-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterEmployeeUserId || 'all'}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const uObj = users.find(u => u.id === val);
                                                                updateScheduleConfig({
                                                                    filterEmployeeUserId: val,
                                                                    filterEmployeeName: val === 'all' ? '' : (uObj?.name || '')
                                                                });
                                                            }}
                                                        >
                                                            <option value="all">All Employees</option>
                                                            {users
                                                                .filter(u => {
                                                                    const selectedCats = editingSchedule.scheduleConfig?.filterEmployeeCategories;
                                                                    if (selectedCats && selectedCats.length > 0 && selectedCats.length < 3 && !selectedCats.includes('all')) {
                                                                        const roleStr = (u.role || '').toLowerCase();
                                                                        const staffCat = ((u as any).staff_category || '').toLowerCase();
                                                                        const matches = selectedCats.some(cat => staffCat ? staffCat === cat.toLowerCase() : roleStr.includes(cat.toLowerCase()));
                                                                        if (!matches) return false;
                                                                    }
                                                                    const desig = editingSchedule.scheduleConfig?.filterEmployeeDesignation;
                                                                    if (desig && desig !== 'all' && u.role !== desig) return false;
                                                                    const comp = editingSchedule.scheduleConfig?.filterCompany;
                                                                    if (comp && comp !== 'all' && (u.societyName || (u as any).organizationName) !== comp) return false;
                                                                    const loc = editingSchedule.scheduleConfig?.filterEmployeeLocation;
                                                                    if (loc && loc !== 'all' && (u.location || (u as any).locationName) !== loc) return false;
                                                                    return true;
                                                                })
                                                                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                                                .map(u => (
                                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                                ))
                                                            }
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status */}
                                                <div className="col-span-1 min-w-[160px] flex-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterEmployeeStatus || 'all'}
                                                            onChange={e => updateScheduleConfig({ filterEmployeeStatus: e.target.value })}
                                                        >
                                                            <option value="all">All Status</option>
                                                            <option value="ACTIVE_USERS">Active Users Only</option>
                                                            <optgroup label="── Attendance ──">
                                                                <option value="P">P — Present</option>
                                                                <option value="0.5P">0.5P — Half Day</option>
                                                                <option value="0.75P">0.75P — Three-Quarter Day</option>
                                                                <option value="0.25P">0.25P — Quarter Day</option>
                                                                <option value="A">A — Absent</option>
                                                                <option value="LOP">LOP — Loss of Pay</option>
                                                            </optgroup>
                                                            <optgroup label="── Offs &amp; Holidays ──">
                                                                <option value="W/O">W/O — Weekly Off</option>
                                                                <option value="H">H — Public Holiday</option>
                                                                <option value="H/P">H/P — Holiday Present</option>
                                                                <option value="W/P">W/P — Weekend Present</option>
                                                                <option value="W/H">W/H — Work From Home</option>
                                                                <option value="BL">BL — Blue Leave (3rd Sat)</option>
                                                                <option value="PL">PL — Pink Leave (Female)</option>
                                                            </optgroup>
                                                            <optgroup label="── Leave Types ──">
                                                                <option value="SL">SL — Sick Leave</option>
                                                                <option value="EL">EL — Earned Leave</option>
                                                                <option value="CL">CL — Casual Leave</option>
                                                                <option value="C/O">C/O — Comp Off</option>
                                                                <option value="ML">ML — Maternity Leave</option>
                                                                <option value="CC">CC — Child Care Leave</option>
                                                            </optgroup>
                                                            <optgroup label="── Requests ──">
                                                                <option value="RP">RP — Request Permission</option>
                                                                <option value="RC">RC — Request Correction</option>
                                                            </optgroup>
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Record Type */}
                                                <div className="col-span-1 min-w-[160px] flex-1">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Record Type</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterRecordType || 'all'}
                                                            onChange={e => updateScheduleConfig({ filterRecordType: e.target.value })}
                                                        >
                                                            <option value="all">All Records</option>
                                                            <option value="complete">Complete (Punch-in &amp; Punch-out)</option>
                                                            <option value="missing_checkout">Missing Punch-out</option>
                                                            <option value="missing_checkin">Missing Punch-in</option>
                                                            <option value="incomplete">Incomplete (Any Missing)</option>
                                                            <option value="auto_checkout">Auto Punch-out</option>
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Show Records */}
                                                <div className="col-span-1 min-w-[120px]">
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Show Records</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all cursor-pointer shadow-2xs"
                                                            value={editingSchedule.scheduleConfig?.filterShowRecords ?? 20}
                                                            onChange={e => updateScheduleConfig({ filterShowRecords: Number(e.target.value) })}
                                                        >
                                                            <option value={20}>20 Records</option>
                                                            <option value={50}>50 Records</option>
                                                            <option value={100}>100 Records</option>
                                                            <option value={0}>All Records</option>
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <Filter className="h-3.5 w-3.5 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Apply Filters Button — Styled same to same as Image 1 */}
                                                <div className="col-span-2 md:col-span-1 xl:ml-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAppliedFilterFlash(true);
                                                            setToast({ message: 'Filters applied to Back Office daily report schedule', type: 'success' });
                                                            setTimeout(() => setAppliedFilterFlash(false), 2000);
                                                        }}
                                                        className={`w-full md:w-auto md:min-w-[170px] shadow-sm flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                                                            appliedFilterFlash
                                                                ? "bg-emerald-600 text-white border border-emerald-600 scale-95"
                                                                : "bg-[#006b3f] hover:bg-[#005632] text-white border border-[#005632] active:scale-95"
                                                        }`}
                                                    >
                                                        <Filter className="w-4 h-4" />
                                                        {appliedFilterFlash ? 'Filters Applied ✓' : 'Apply Filters'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                    {/* ── SITE / OTHER REPORTS: Full 3-column filter grid ── */}
                                    {editingSchedule.reportType !== 'attendance_daily' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                                        {/* COLUMN 1: FILTER EMPLOYEE */}
                                        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all h-full ${editingSchedule.scheduleConfig?.filterEmployeeEnabled ? 'bg-white border-emerald-500/40 shadow-xs' : 'bg-slate-50/60 border-slate-200/80'}`}>
                                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingSchedule.scheduleConfig?.filterEmployeeEnabled ?? false}
                                                        onChange={e => updateScheduleConfig({ filterEmployeeEnabled: e.target.checked })}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                                    />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Filter Employee Criteria
                                                    </span>
                                                </label>
                                                {editingSchedule.scheduleConfig?.filterEmployeeEnabled && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Active</span>
                                                )}
                                            </div>

                                            <div className={`flex-1 space-y-2.5 ${!editingSchedule.scheduleConfig?.filterEmployeeEnabled ? 'opacity-60 pointer-events-none' : ''}`}>
                                                {/* Employee Code & Exact Checkbox */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="col-span-2">
                                                        <Input
                                                            label="Employee Code"
                                                            placeholder="e.g. 1042"
                                                            value={editingSchedule.scheduleConfig?.filterEmployeeCode || ''}
                                                            onChange={e => updateScheduleConfig({ filterEmployeeCode: e.target.value })}
                                                            className="text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col justify-end pb-2">
                                                        <Checkbox
                                                            id="sch-emp-exact"
                                                            label="Exact"
                                                            checked={editingSchedule.scheduleConfig?.filterEmployeeExact ?? false}
                                                            onChange={e => updateScheduleConfig({ filterEmployeeExact: e.target.checked })}
                                                            labelClassName="text-xs font-medium text-slate-600"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Employee Name */}
                                                <Input
                                                    label="Employee Name"
                                                    placeholder="Search employee name..."
                                                    value={editingSchedule.scheduleConfig?.filterEmployeeName || ''}
                                                    onChange={e => updateScheduleConfig({ filterEmployeeName: e.target.value })}
                                                    className="text-xs"
                                                />

                                                {/* Employee Status (Active, Inactive, All) */}
                                                <Select
                                                    label="Employee Status"
                                                    value={editingSchedule.scheduleConfig?.filterEmployeeStatus || 'all'}
                                                    onChange={e => updateScheduleConfig({ filterEmployeeStatus: e.target.value as any })}
                                                >
                                                    <option value="all">All Statuses (Active + Inactive)</option>
                                                    <option value="active">Active Staff Only</option>
                                                    <option value="inactive">Inactive / Left Staff Only</option>
                                                </Select>

                                                {/* Staff Category */}
                                                <Select
                                                    label="Staff Category"
                                                    value={editingSchedule.scheduleConfig?.filterEmployeeCategory || 'All'}
                                                    onChange={e => updateScheduleConfig({ filterEmployeeCategory: e.target.value })}
                                                >
                                                    {PARADIGM_STAFF_CATEGORIES.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                                    ))}
                                                </Select>

                                                {/* Designation / Role */}
                                                <Select
                                                    label="Employee Designation / Role"
                                                    value={editingSchedule.scheduleConfig?.filterEmployeeDesignation || 'All'}
                                                    onChange={e => updateScheduleConfig({ filterEmployeeDesignation: e.target.value })}
                                                >
                                                    <option value="All">All Designations & Roles</option>
                                                    {dynamicDesignations.map(des => (
                                                        <option key={des} value={des}>{des}</option>
                                                    ))}
                                                </Select>

                                                {/* Location / Site */}
                                                <Select
                                                    label="Employee Location / Site"
                                                    value={editingSchedule.scheduleConfig?.filterEmployeeLocation || 'All'}
                                                    onChange={e => updateScheduleConfig({ filterEmployeeLocation: e.target.value })}
                                                >
                                                    <option value="All">All Locations & Sites</option>
                                                    {availableDepartments.map(loc => (
                                                        <option key={loc} value={loc}>{loc}</option>
                                                    ))}
                                                </Select>
                                            </div>

                                            {/* Bottom Status Bar for Column 1 */}
                                            <div className="shrink-0 pt-2.5 mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                                                <span>Criteria Status</span>
                                                <span className="font-semibold text-slate-700">
                                                    {editingSchedule.scheduleConfig?.filterEmployeeEnabled ? 'Custom Criteria Active' : 'All Staff (No filter)'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* COLUMN 2: FILTER COMPANY / ENTITY */}
                                        <div className={`p-4 rounded-xl border flex flex-col transition-all h-full ${editingSchedule.scheduleConfig?.filterCompanyEnabled ? 'bg-white border-emerald-500/40 shadow-xs' : 'bg-slate-50/60 border-slate-200/80'}`}>
                                            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 shrink-0">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingSchedule.scheduleConfig?.filterCompanyEnabled ?? false}
                                                        onChange={e => updateScheduleConfig({ filterCompanyEnabled: e.target.checked })}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                                    />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Filter Company / Entity
                                                    </span>
                                                </label>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                    {(editingSchedule.scheduleConfig?.filterCompanies || []).length} / {availableCompanies.length}
                                                </span>
                                            </div>

                                            <div className={`flex-1 flex flex-col min-h-0 space-y-2 ${!editingSchedule.scheduleConfig?.filterCompanyEnabled ? 'opacity-60 pointer-events-none' : ''}`}>
                                                {/* Search Input */}
                                                <div className="relative shrink-0">
                                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search entity or company..."
                                                        value={companySearch}
                                                        onChange={e => setCompanySearch(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>

                                                {/* Quick Selection Buttons */}
                                                <div className="flex items-center justify-between text-xs shrink-0 py-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateScheduleConfig({ filterCompanies: [...availableCompanies] })}
                                                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                                                        >
                                                            Select All
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateScheduleConfig({ filterCompanies: [] })}
                                                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                                                        >
                                                            Deselect All
                                                        </button>
                                                    </div>
                                                    <span className="text-[11px] text-slate-400">
                                                        {filteredCompanies.length} shown
                                                    </span>
                                                </div>

                                                {/* Scrollable Company Listbox - fills 100% of remaining vertical height */}
                                                <div className="flex-1 min-h-[220px] overflow-y-auto border border-slate-200/90 rounded-xl bg-slate-50/60 p-2 space-y-0.5 divide-y divide-slate-100/80 shadow-2xs">
                                                    {filteredCompanies.length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-slate-400">No matching entities found</div>
                                                    ) : (
                                                        filteredCompanies.map(comp => {
                                                            const selectedComps = editingSchedule.scheduleConfig?.filterCompanies || [];
                                                            const isChecked = selectedComps.includes(comp);
                                                            return (
                                                                <label key={comp} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={e => {
                                                                            const next = e.target.checked ? [...selectedComps, comp] : selectedComps.filter(c => c !== comp);
                                                                            updateScheduleConfig({ filterCompanies: next });
                                                                        }}
                                                                        className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                                                                    />
                                                                    <span className={`truncate text-xs ${isChecked ? 'font-semibold text-emerald-950' : 'text-slate-700'}`} title={comp}>
                                                                        {comp}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Bottom Status Bar for Column 2 */}
                                                <div className="shrink-0 pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                                                    <span>Total Entities: {availableCompanies.length}</span>
                                                    <span className="font-semibold text-emerald-700">
                                                        {(editingSchedule.scheduleConfig?.filterCompanies || []).length} Selected
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* COLUMN 3: FILTER DEPARTMENT / SITE */}
                                        <div className={`p-4 rounded-xl border flex flex-col transition-all h-full ${editingSchedule.scheduleConfig?.filterDepartmentEnabled ? 'bg-white border-emerald-500/40 shadow-xs' : 'bg-slate-50/60 border-slate-200/80'}`}>
                                            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 shrink-0">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingSchedule.scheduleConfig?.filterDepartmentEnabled ?? false}
                                                        onChange={e => updateScheduleConfig({ filterDepartmentEnabled: e.target.checked })}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                                    />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Filter Department / Site
                                                    </span>
                                                </label>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                    {(editingSchedule.scheduleConfig?.filterDepartments || []).length} / {availableDepartments.length}
                                                </span>
                                            </div>

                                            <div className={`flex-1 flex flex-col min-h-0 space-y-2 ${!editingSchedule.scheduleConfig?.filterDepartmentEnabled ? 'opacity-60 pointer-events-none' : ''}`}>
                                                {/* Search Input */}
                                                <div className="relative shrink-0">
                                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search department or site..."
                                                        value={departmentSearch}
                                                        onChange={e => setDepartmentSearch(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>

                                                {/* Quick Selection Buttons */}
                                                <div className="flex items-center justify-between text-xs shrink-0 py-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateScheduleConfig({ filterDepartments: [...availableDepartments] })}
                                                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                                                        >
                                                            Select All
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateScheduleConfig({ filterDepartments: [] })}
                                                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                                                        >
                                                            Deselect All
                                                        </button>
                                                    </div>
                                                    <span className="text-[11px] text-slate-400">
                                                        {filteredDepartments.length} shown
                                                    </span>
                                                </div>

                                                {/* Scrollable Department / Site Listbox - fills 100% of remaining vertical height */}
                                                <div className="flex-1 min-h-[220px] overflow-y-auto border border-slate-200/90 rounded-xl bg-slate-50/60 p-2 space-y-0.5 divide-y divide-slate-100/80 shadow-2xs">
                                                    {filteredDepartments.length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-slate-400">No matching departments or sites found</div>
                                                    ) : (
                                                        filteredDepartments.map(dept => {
                                                            const selectedDepts = editingSchedule.scheduleConfig?.filterDepartments || [];
                                                            const isChecked = selectedDepts.includes(dept);
                                                            return (
                                                                <label key={dept} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={e => {
                                                                            const next = e.target.checked ? [...selectedDepts, dept] : selectedDepts.filter(d => d !== dept);
                                                                            updateScheduleConfig({ filterDepartments: next });
                                                                        }}
                                                                        className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                                                                    />
                                                                    <span className={`truncate text-xs ${isChecked ? 'font-semibold text-emerald-950' : 'text-slate-700'}`} title={dept}>
                                                                        {dept}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Bottom Status Bar for Column 3 */}
                                                <div className="shrink-0 pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                                                    <span>Total Sites: {availableDepartments.length}</span>
                                                    <span className="font-semibold text-emerald-700">
                                                        {(editingSchedule.scheduleConfig?.filterDepartments || []).length} Selected
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    )} {/* end site/other 3-col grid */}

                                    {/* Bottom Strip: Export File Format, Recalculate Attendance & Show Company Logo */}
                                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Export File Format:</span>
                                            <div className="flex items-center gap-2">
                                                {[
                                                    { id: 'excel', label: 'Excel (.xlsx)', icon: '📗' },
                                                    { id: 'pdf', label: 'PDF Document', icon: '📕' },
                                                    { id: 'html', label: 'HTML Email', icon: '🌐' },
                                                    { id: 'csv', label: 'CSV Export', icon: '📄' },
                                                ].map(fmt => {
                                                    const activeFormat = editingSchedule.scheduleConfig?.exportFileFormat || (editingSchedule.reportFormat === 'csv' ? 'excel' : editingSchedule.reportFormat || 'pdf');
                                                    return (
                                                        <label
                                                            key={fmt.id}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${activeFormat === fmt.id ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="sch-export-fmt"
                                                                value={fmt.id}
                                                                checked={activeFormat === fmt.id}
                                                                onChange={() => {
                                                                    updateScheduleConfig({ exportFileFormat: fmt.id as any });
                                                                    setEditingSchedule(prev => prev ? { ...prev, reportFormat: (fmt.id === 'excel' ? 'csv' : fmt.id) as any } : prev);
                                                                }}
                                                                className="sr-only"
                                                            />
                                                            <span>{fmt.icon}</span>
                                                            <span>{fmt.label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <Checkbox
                                                id="sch-recalc-att"
                                                label="Recalculate Attendance"
                                                checked={editingSchedule.scheduleConfig?.recalculateAttendance ?? false}
                                                onChange={e => updateScheduleConfig({ recalculateAttendance: e.target.checked })}
                                                labelClassName="text-xs font-medium text-slate-700"
                                            />
                                            <Checkbox
                                                id="sch-show-logo"
                                                label="Show Company Logo"
                                                checked={editingSchedule.scheduleConfig?.showCompanyLogo ?? true}
                                                onChange={e => updateScheduleConfig({ showCompanyLogo: e.target.checked })}
                                                labelClassName="text-xs font-medium text-slate-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recipients */}
                            <div className="space-y-4">
                                <p className="text-sm font-bold text-primary-text">Recipients</p>
                                <Select
                                    label="Recipient Type"
                                    value={editingSchedule.recipientType || 'role'}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, recipientType: e.target.value as any })}
                                >
                                    <option value="role">By Role</option>
                                    <option value="users">Specific Users</option>
                                    <option value="custom_emails">Custom Email Addresses</option>
                                </Select>

                                {editingSchedule.recipientType === 'role' && (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-2 p-3 border border-border rounded-xl bg-page/50">
                                            {roles.map(role => (
                                                <label key={role.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-border hover:border-accent/30 cursor-pointer text-xs font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={(editingSchedule.recipientRoles || []).includes(role.id)}
                                                        onChange={e => {
                                                            const current = editingSchedule.recipientRoles || [];
                                                            const nextRoles = e.target.checked ? [...current, role.id] : current.filter(r => r !== role.id);
                                                            const autoEmails = users.filter(usr => nextRoles.includes(usr.roleId || (usr as any).role?.id)).map(usr => usr.email).filter(Boolean);
                                                            setEditingSchedule({
                                                                ...editingSchedule,
                                                                recipientRoles: nextRoles,
                                                                recipientEmails: autoEmails
                                                            });
                                                        }}
                                                        className="rounded"
                                                    />
                                                    {role.displayName}
                                                </label>
                                            ))}
                                        </div>
                                        {(editingSchedule.recipientEmails || []).length > 0 && (
                                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                                                    Auto-resolved Email Addresses ({(editingSchedule.recipientEmails || []).length}):
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(editingSchedule.recipientEmails || []).map((email, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-white text-emerald-700 text-[11px] font-medium rounded-md border border-emerald-200 shadow-2xs">
                                                            ✉️ {email}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {editingSchedule.recipientType === 'users' && (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-border rounded-xl bg-page/50">
                                            {users.map(u => (
                                                <Checkbox
                                                    key={u.id}
                                                    label={u.email ? `${u.name} (${u.email})` : u.name}
                                                    labelClassName="text-xs truncate"
                                                    className="hover:bg-white rounded-lg transition-colors p-1.5"
                                                    title={u.email ? `${u.name} — ${u.email}` : u.name}
                                                    checked={(editingSchedule.recipientUserIds || []).includes(u.id)}
                                                    onChange={e => {
                                                        const current = editingSchedule.recipientUserIds || [];
                                                        const nextIds = e.target.checked ? [...current, u.id] : current.filter(id => id !== u.id);
                                                        const autoEmails = users.filter(usr => nextIds.includes(usr.id)).map(usr => usr.email).filter(Boolean);
                                                        setEditingSchedule({
                                                            ...editingSchedule,
                                                            recipientUserIds: nextIds,
                                                            recipientEmails: autoEmails
                                                        });
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        {(editingSchedule.recipientEmails || []).length > 0 && (
                                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                                                    Auto-selected Email Recipients ({(editingSchedule.recipientEmails || []).length}):
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(editingSchedule.recipientEmails || []).map((email, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-white text-emerald-700 text-[11px] font-medium rounded-md border border-emerald-200 shadow-2xs">
                                                            ✉️ {email}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {editingSchedule.recipientType === 'custom_emails' && (
                                    <EmailTagInput
                                        label="Email Addresses"
                                        tags={editingSchedule.recipientEmails || []}
                                        onChange={tags => setEditingSchedule({
                                            ...editingSchedule,
                                            recipientEmails: tags
                                        })}
                                        placeholder="Enter email address..."
                                    />
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleSaveSchedule} isLoading={isSaving} className="flex-1">
                                    <Save className="h-4 w-4 mr-2" /> {editingSchedule.id ? 'Update' : 'Create'} Schedule
                                </Button>
                                <Button variant="secondary" onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {/* Schedule Rules List */}
                    <div className="space-y-4">
                        {scheduleRules.map(rule => {
                            const templateName = templates.find(t => t.id === rule.templateId)?.name || 'No template';
                            return (
                                <div key={rule.id} className={`bg-card p-5 rounded-2xl border transition-all ${rule.isActive ? 'border-border' : 'border-dashed opacity-60'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl ${rule.isActive ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted'}`}>
                                                {rule.triggerType === 'scheduled' ? <Clock className="h-5 w-5" /> :
                                                    rule.triggerType === 'event' ? <Zap className="h-5 w-5" /> :
                                                        <Shield className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-primary-text">{rule.name}</h4>
                                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold uppercase">
                                                        {rule.triggerType === 'scheduled' ? `${rule.scheduleConfig?.frequency || 'daily'} @ ${rule.scheduleConfig?.time}` :
                                                            rule.triggerType === 'event' ? `On: ${rule.eventType}` : 'Expiry Check'}
                                                    </span>
                                                    {rule.triggerType === 'scheduled' && (
                                                        rule.scheduleConfig?.dateRangeMode === 'yesterday' ? (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                                                📅 Yesterday's Data
                                                            </span>
                                                        ) : rule.scheduleConfig?.dateRangeMode === 'previous_month' ? (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                                                📅 Previous Month
                                                            </span>
                                                        ) : rule.scheduleConfig?.dateRangeMode === 'current_month' ? (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200">
                                                                📅 Current Month
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                                                                📅 Today's Data
                                                            </span>
                                                        )
                                                    )}
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-page text-muted font-bold">
                                                        📧 {templateName}
                                                    </span>
                                                    {rule.reportType && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold uppercase border border-emerald-200">
                                                            📊 {rule.reportType?.replace('_', ' ')}
                                                        </span>
                                                    )}
                                                    {rule.scheduleConfig?.filterCompanyEnabled && (rule.scheduleConfig?.filterCompanies?.length || 0) > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                                            🏢 {rule.scheduleConfig.filterCompanies!.length} Companies
                                                        </span>
                                                    )}
                                                    {rule.scheduleConfig?.filterDepartmentEnabled && (rule.scheduleConfig?.filterDepartments?.length || 0) > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                                                            📍 {rule.scheduleConfig.filterDepartments!.length} Depts / Sites
                                                        </span>
                                                    )}
                                                    {rule.scheduleConfig?.filterEmployeeStatus && rule.scheduleConfig.filterEmployeeStatus !== 'all' && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                                            👤 {rule.scheduleConfig.filterEmployeeStatus === 'active' ? 'Active Staff' : 'Inactive Staff'}
                                                        </span>
                                                    )}
                                                    {rule.scheduleConfig?.groupBy && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                                            🗂️ {rule.scheduleConfig.groupBy}
                                                        </span>
                                                    )}
                                                    {rule.scheduleConfig?.exportFileFormat && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 uppercase">
                                                            📁 {rule.scheduleConfig.exportFileFormat}
                                                        </span>
                                                    )}
                                                    {rule.lastSentAt && (
                                                        <span className="text-[10px] text-muted">
                                                            Last sent: {format(new Date(rule.lastSentAt), 'MMM d, h:mm a')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 ml-4">
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleSendLiveSchedule(rule.id)}
                                                className="text-[10px] h-8 px-3 font-bold bg-emerald-600 hover:bg-emerald-700 text-white tracking-wider flex items-center gap-1 shadow-sm"
                                                title="Send present live report with data to email"
                                            >
                                                <Send className="h-3 w-3" /> SEND
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleTestSchedule(rule.id)}
                                                className="text-[10px] h-8 px-3 font-black tracking-tighter"
                                                title="Send test sample email now"
                                            >
                                                TEST
                                            </Button>
                                            <button 
                                                onClick={() => { setEditingSchedule(rule); setShowScheduleForm(true); }} 
                                                className="p-2.5 hover:bg-accent/10 rounded-xl text-accent transition-colors border border-transparent hover:border-accent/20"
                                                title="Edit Rule"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <div className="px-1">
                                                <Checkbox
                                                    id={`sch-active-${rule.id}`}
                                                    label=""
                                                    checked={rule.isActive}
                                                    onChange={async (e) => {
                                                        try {
                                                            const updated = await api.saveEmailScheduleRule({ ...rule, isActive: e.target.checked });
                                                            setScheduleRules(prev => prev.map(r => r.id === rule.id ? updated : r));
                                                            setToast({ message: `Schedule ${e.target.checked ? 'activated' : 'deactivated'}`, type: 'success' });
                                                        } catch (err) {
                                                            setToast({ message: 'Failed to toggle status.', type: 'error' });
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteSchedule(rule.id)} 
                                                className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 transition-colors border border-transparent hover:border-red-100"
                                                title="Delete Rule"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {scheduleRules.length === 0 && (
                            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                                <Calendar className="h-10 w-10 text-muted/20 mx-auto mb-3" />
                                <p className="text-muted font-medium">No email schedules configured yet.</p>
                                <p className="text-xs text-muted/60 mt-1">Create a schedule to automate daily reports, expiry alerts, and more.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ LOGS TAB ═══════════════ */}
            {activeSubTab === 'logs' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-muted" /> Delivery Logs ({emailLogs.length})
                        </h3>
                        <Button variant="secondary" size="sm" onClick={async () => {
                            const logs = await api.getEmailLogs();
                            setEmailLogs(logs);
                            setToast({ message: 'Logs refreshed.', type: 'success' });
                        }}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                        </Button>
                    </div>

                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Status</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Recipient</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Subject</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Trigger</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Sent At</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {emailLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-muted">
                                                <Mail className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                No emails sent yet.
                                            </td>
                                        </tr>
                                    ) : emailLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                {log.status === 'sent' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                                                        <AlertTriangle className="h-3.5 w-3.5" /> Failed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-primary-text font-medium">{log.recipientEmail}</td>
                                            <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">{log.subject}</td>
                                            <td className="px-4 py-3">
                                                {log.triggerType === 'manual' ? (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase text-[9px] border border-slate-200">
                                                        Manual
                                                    </span>
                                                ) : (log.triggerType === 'automatic' || log.ruleId) ? (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold uppercase text-[9px] border border-indigo-100">
                                                        Automatic
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase text-[9px] border border-slate-200">
                                                        Manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted">{format(new Date(log.createdAt), 'MMM d, h:mm a')}</td>
                                            <td className="px-4 py-3 text-xs text-red-500 max-w-[180px] truncate">{log.errorMessage || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ SMTP POOL TAB ═══════════════ */}
            {activeSubTab === 'smtp_pool' && (() => {
                const REPORT_TYPE_OPTIONS = [
                    { value: 'attendance_daily', label: 'Daily Attendance Back Office' },
                    { value: 'attendance_site_daily', label: 'Daily Attendance - Site' },
                    { value: 'attendance_monthly', label: 'Monthly Attendance' },
                    { value: 'crm_bd_daily', label: 'BD Daily CRM' },
                    { value: 'document_expiry', label: 'Document Expiry' },
                    { value: 'mmr_report', label: 'MMR Report' },
                    { value: 'payroll_report', label: 'Payroll Report' },
                    { value: 'leave_report', label: 'Leave Report' },
                    { value: 'overtime_report', label: 'Overtime Report' },
                    { value: 'compliance_report', label: 'Compliance Report' },
                    { value: 'custom_report', label: 'Custom Report' },
                ];

                const openAddForm = () => {
                    setSmtpForm({ name: '', email: '', appPassword: '', host: 'smtp.gmail.com', port: 465, secure: true, fromName: 'Paradigm FMS', reportTypes: [], dailyLimit: 2000, isActive: true });
                    setEditingSmtp(null);
                    setShowSmtpForm(true);
                };

                const openEditForm = (acct: any) => {
                    setSmtpForm({ name: acct.name, email: acct.email, appPassword: '', host: acct.host || 'smtp.gmail.com', port: acct.port || 465, secure: acct.secure !== false, fromName: acct.fromName || 'Paradigm FMS', reportTypes: acct.reportTypes || [], dailyLimit: acct.dailyLimit || 2000, isActive: acct.isActive !== false });
                    setEditingSmtp(acct);
                    setShowSmtpForm(true);
                };

                const handleSaveSmtp = async () => {
                    if (!smtpForm.name || !smtpForm.email || (!editingSmtp && !smtpForm.appPassword)) {
                        setToast({ message: 'Name, email and app password are required.', type: 'error' }); return;
                    }
                    setSavingSmtp(true);
                    try {
                        const payload: any = { ...smtpForm };
                        if (editingSmtp) { payload.id = editingSmtp.id; if (!smtpForm.appPassword) delete payload.appPassword; }
                        await api.saveSmtpAccount(payload);
                        const updated = await api.getSmtpAccounts().catch(() => []);
                        setSmtpAccounts(updated);
                        setShowSmtpForm(false);
                        setToast({ message: editingSmtp ? 'Account updated!' : 'Account added!', type: 'success' });
                    } catch (err: any) { setToast({ message: err.message, type: 'error' }); }
                    finally { setSavingSmtp(false); }
                };

                const handleDeleteSmtp = async (id: string) => {
                    if (!confirm('Delete this SMTP account?')) return;
                    try {
                        await api.deleteSmtpAccount(id);
                        setSmtpAccounts(prev => prev.filter(a => a.id !== id));
                        setToast({ message: 'Account deleted.', type: 'success' });
                    } catch (err: any) { setToast({ message: err.message, type: 'error' }); }
                };

                const handleTestSmtp = async (acct: any) => {
                    if (!smtpTestEmail) { setToast({ message: 'Enter a test email address first.', type: 'error' }); return; }
                    setTestingSmtpId(acct.id);
                    try {
                        await api.testSmtpAccount(acct.id, smtpTestEmail);
                        setToast({ message: `✅ Test email sent via ${acct.name}!`, type: 'success' });
                    } catch (err: any) { setToast({ message: `❌ ${err.message}`, type: 'error' }); }
                    finally { setTestingSmtpId(null); }
                };

                const totalCapacity = smtpAccounts.reduce((s, a) => s + (a.dailyLimit || 2000), 0);
                const totalUsed = smtpAccounts.reduce((s, a) => s + (a.sentToday || 0), 0);

                return (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow">
                                    <Server className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">SMTP Account Pool</h3>
                                    <p className="text-xs text-muted">Assign a dedicated Gmail account per report type. Each account sends up to 2,000 emails/day free.</p>
                                </div>
                            </div>
                            <button onClick={openAddForm} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                                <Plus className="h-3.5 w-3.5" /> Add Account
                            </button>
                        </div>

                        {/* Capacity Overview */}
                        {smtpAccounts.length > 0 && (
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Total Accounts', value: smtpAccounts.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                                    { label: 'Daily Capacity', value: totalCapacity.toLocaleString(), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
                                    { label: 'Sent Today', value: totalUsed.toLocaleString(), color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                                ].map(stat => (
                                    <div key={stat.label} className={`${stat.bg} border rounded-xl p-4 text-center`}>
                                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                        <div className="text-xs text-muted font-medium mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Test email input */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input label="Test Email Address" type="email" value={smtpTestEmail} onChange={e => setSmtpTestEmail(e.target.value)} placeholder="recipient@example.com" />
                            </div>
                            <p className="text-[10px] text-muted pb-2">Used by the Test button on each account</p>
                        </div>

                        {/* Account Table */}
                        {smtpAccounts.length === 0 ? (
                            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
                                <Server className="h-10 w-10 text-muted mx-auto mb-3 opacity-40" />
                                <p className="text-muted font-medium">No SMTP accounts configured yet.</p>
                                <p className="text-xs text-muted mt-1">Add your 10 Google Workspace accounts to enable the multi-sender pool.</p>
                                <button onClick={openAddForm} className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                                    + Add First Account
                                </button>
                            </div>
                        ) : (
                            <div className="border border-border rounded-2xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-border">
                                            {['Account Name', 'Gmail Address', 'Report Types', 'Usage Today', 'Status', 'Actions'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {smtpAccounts.map((acct, idx) => {
                                            const pct = Math.min(100, Math.round(((acct.sentToday || 0) / (acct.dailyLimit || 2000)) * 100));
                                            const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
                                            return (
                                                <tr key={acct.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                    <td className="px-4 py-3 font-semibold text-primary-text">{acct.name}</td>
                                                    <td className="px-4 py-3 text-muted font-mono">{acct.email}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(acct.reportTypes || []).length === 0 ? (
                                                                <span className="text-muted italic">None</span>
                                                            ) : (acct.reportTypes || []).map((rt: string) => (
                                                                <span key={rt} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold uppercase">
                                                                    {REPORT_TYPE_OPTIONS.find(o => o.value === rt)?.label || rt}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 min-w-[120px]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-muted whitespace-nowrap">{acct.sentToday || 0}/{acct.dailyLimit || 2000}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {acct.isActive ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold">● Active</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[9px] font-bold">○ Inactive</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => handleTestSmtp(acct)} disabled={testingSmtpId === acct.id} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors" title="Send test email">
                                                                {testingSmtpId === acct.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                                            </button>
                                                            <button onClick={() => openEditForm(acct)} className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors" title="Edit">
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button onClick={() => handleDeleteSmtp(acct.id)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="Delete">
                                                                <Trash2 className="h-3 w-3" />
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

                        {/* Add/Edit Form */}
                        {showSmtpForm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                                <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                    <div className="flex items-center justify-between p-6 border-b border-border">
                                        <h3 className="font-bold text-base">{editingSmtp ? 'Edit SMTP Account' : 'Add SMTP Account'}</h3>
                                        <button onClick={() => setShowSmtpForm(false)} className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors"><CloseIcon className="h-4 w-4" /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <Input label="Account Name" value={smtpForm.name} onChange={e => setSmtpForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily Report Sender" />
                                        <Input label="Gmail Address" type="email" value={smtpForm.email} onChange={e => setSmtpForm(f => ({ ...f, email: e.target.value }))} placeholder="daily@paradigmfms.com" />
                                        <Input label={editingSmtp ? 'App Password (leave blank to keep existing)' : 'Gmail App Password'} type="password" value={smtpForm.appPassword} onChange={e => setSmtpForm(f => ({ ...f, appPassword: e.target.value }))} placeholder="16-char Google App Password" description="Generate at myaccount.google.com/apppasswords" />
                                        <Input label="Display Name" value={smtpForm.fromName} onChange={e => setSmtpForm(f => ({ ...f, fromName: e.target.value }))} placeholder="Paradigm FMS" />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input label="Daily Limit" type="number" value={smtpForm.dailyLimit} onChange={e => setSmtpForm(f => ({ ...f, dailyLimit: parseInt(e.target.value) || 2000 }))} />
                                            <div className="pt-6"><Checkbox id="smtp-active" label="Active" checked={smtpForm.isActive} onChange={e => setSmtpForm(f => ({ ...f, isActive: e.target.checked }))} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Assign Report Types</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {REPORT_TYPE_OPTIONS.map(opt => (
                                                    <label key={opt.value} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                                                        smtpForm.reportTypes.includes(opt.value)
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                                            : 'border-border hover:bg-slate-50'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            className="accent-emerald-600"
                                                            checked={smtpForm.reportTypes.includes(opt.value)}
                                                            onChange={e => setSmtpForm(f => ({ ...f, reportTypes: e.target.checked ? [...f.reportTypes, opt.value] : f.reportTypes.filter(x => x !== opt.value) }))}
                                                        />
                                                        {opt.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setShowSmtpForm(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                                            <button onClick={handleSaveSmtp} disabled={savingSmtp} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                                                {savingSmtp ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> {editingSmtp ? 'Update Account' : 'Add Account'}</>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

                </>
            )}
        </div>
    );
};

export default EmailConfigPanel;
