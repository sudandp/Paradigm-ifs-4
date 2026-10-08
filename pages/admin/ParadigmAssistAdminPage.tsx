import React, { useState, useEffect } from 'react';
import {
  BookOpen, HelpCircle, FileText, Users, Sliders, CheckCircle2,
  AlertCircle, Plus, Search, Download, Upload, Eye, Trash2, Edit3,
  TrendingUp, ThumbsUp, ShieldAlert, Sparkles, Loader2, ArrowLeft,
  Bell, Check, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { apiFetch } from '../../utils/apiClient';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { exportSiteStaffRosterPDF, exportEscalationMatrixPDF } from '../../utils/assistPdfExport';

export const ParadigmAssistAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analytics' | 'unanswered' | 'items' | 'staff' | 'settings'>('analytics');
  const [loading, setLoading] = useState(false);

  // Analytics Stats
  const [stats, setStats] = useState({
    totalQueries: 0,
    pendingUnanswered: 0,
    resolvedCount: 0,
    totalKnowledgeItems: 0,
    avgConfidence: 0.85,
    satisfaction: { positive: 0, negative: 0 }
  });

  // Unanswered Queue
  const [unanswered, setUnanswered] = useState<any[]>([]);
  const [resolveModalItem, setResolveModalItem] = useState<any | null>(null);
  const [resolveAnswer, setResolveAnswer] = useState('');
  const [resolveCategory, setResolveCategory] = useState('FAQ');
  const [publishing, setPublishing] = useState(false);

  // Knowledge Items
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
  const [searchItem, setSearchItem] = useState('');
  const [createItemModal, setCreateItemModal] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');

  // Staff & Escalation
  const [staffList, setStaffList] = useState<any[]>([]);
  const [escalationList, setEscalationList] = useState<any[]>([]);
  const [importingStaff, setImportingStaff] = useState(false);

  // Engine Settings
  const [settings, setSettings] = useState({
    high_threshold: 0.78,
    medium_threshold: 0.55
  });

  useEffect(() => {
    fetchStats();
    if (activeTab === 'unanswered') fetchUnanswered();
    if (activeTab === 'items') fetchKnowledgeItems();
    if (activeTab === 'staff') fetchStaffAndEscalation();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await apiFetch('/api/paradigm-assist?action=stats', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('[AdminAssist] Fetch stats error:', err);
    }
  };

  const fetchUnanswered = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unanswered_questions')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUnanswered(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) {
        setKnowledgeItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffAndEscalation = async () => {
    setLoading(true);
    try {
      const [staffRes, escRes] = await Promise.all([
        supabase.from('site_staff_members').select('*').order('designation', { ascending: true }),
        supabase.from('escalation_matrix').select('*').order('display_order', { ascending: true })
      ]);
      if (staffRes.data) setStaffList(staffRes.data);
      if (escRes.data) setEscalationList(escRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('assist_settings')
        .select('high_threshold, medium_threshold')
        .eq('id', 'singleton')
        .single();
      if (data) {
        setSettings({
          high_threshold: Number(data.high_threshold),
          medium_threshold: Number(data.medium_threshold)
        });
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Resolve Unanswered Question & Notify Askers
  const handleResolveQuestion = async () => {
    if (!resolveModalItem || !resolveAnswer.trim()) {
      toast.error('Please enter an answer to resolve this question.');
      return;
    }

    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Unauthorized');

      const res = await apiFetch('/api/paradigm-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'resolve_unanswered',
          questionId: resolveModalItem.id,
          answer: resolveAnswer.trim(),
          category: resolveCategory,
          siteId: resolveModalItem.site_id,
          publishAsFaq: true
        })
      });

      if (!res.ok) throw new Error('Failed to publish resolution');

      const data = await res.json();
      toast.success(`Resolved! Notified ${data.askersNotified} employee(s) who asked this.`);
      setResolveModalItem(null);
      setResolveAnswer('');
      fetchUnanswered();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Add Custom Knowledge Item
  const handleCreateItem = async () => {
    if (!newItemTitle.trim() || !newItemContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('knowledge_items').insert({
        title: newItemTitle.trim(),
        content: newItemContent.trim(),
        source_table: 'manual_admin',
        tags: [newItemCategory.toLowerCase(), 'admin-manual'],
        status: 'published',
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Knowledge item published successfully');
      setCreateItemModal(false);
      setNewItemTitle('');
      setNewItemContent('');
      fetchKnowledgeItems();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Excel / CSV Import for Staff Roster
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingStaff(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      const rows: any[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const fullName = row.getCell(1).text || String(row.getCell(1).value || '');
        const designation = row.getCell(2).text || String(row.getCell(2).value || '');
        const department = row.getCell(3).text || String(row.getCell(3).value || '');
        const phone = row.getCell(4).text || String(row.getCell(4).value || '');
        const shift = row.getCell(5).text || String(row.getCell(5).value || 'GS');

        if (fullName && phone) {
          rows.push({
            full_name: fullName.trim(),
            designation: designation.trim() || 'Site Staff',
            department: department.trim() || 'Operations',
            phone: phone.trim(),
            shift_type: shift.trim().toUpperCase(),
            employee_id: `PAR-${Math.floor(1000 + Math.random() * 9000)}`,
            is_active: true
          });
        }
      });

      if (rows.length === 0) {
        toast.error('No valid rows found in spreadsheet.');
        return;
      }

      const { error } = await supabase.from('site_staff_members').insert(rows);
      if (error) throw error;

      toast.success(`Imported ${rows.length} staff records successfully!`);
      fetchStaffAndEscalation();
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImportingStaff(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('assist_settings')
        .upsert({
          id: 'singleton',
          high_threshold: settings.high_threshold,
          medium_threshold: settings.medium_threshold
        });
      if (error) throw error;
      toast.success('Engine settings updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/verification/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Office ERP
            </button>
            <button
              onClick={() => navigate('/assist')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-xs text-emerald-300 hover:text-white transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" /> Paradigm Assist Chat
            </button>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            Paradigm Assist Knowledge Portal & Ops Suite
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-hallucination knowledge management, unanswered questions triage, and staff directory sync.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto">
          {[
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'unanswered', label: `Unanswered (${stats.pendingUnanswered})`, icon: HelpCircle },
            { id: 'items', label: 'Knowledge Docs', icon: FileText },
            { id: 'staff', label: 'Staff & Roster', icon: Users },
            { id: 'settings', label: 'Engine Rules', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* ── TAB 1: ANALYTICS DASHBOARD ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Total User Queries</div>
                <div className="text-2xl font-bold text-white mt-1">{stats.totalQueries}</div>
                <div className="text-[11px] text-emerald-400 mt-1">Logged from employees</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Pending Triage Queue</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{stats.pendingUnanswered}</div>
                <div className="text-[11px] text-slate-400 mt-1">Awaiting verified answers</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Grounding Confidence</div>
                <div className="text-2xl font-bold text-cyan-400 mt-1">{Math.round(stats.avgConfidence * 100)}%</div>
                <div className="text-[11px] text-slate-400 mt-1">Average verified match score</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Published Knowledge Items</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalKnowledgeItems}</div>
                <div className="text-[11px] text-slate-400 mt-1">Active SOPs & Checklists</div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  Unanswered Question Pipeline
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  When employees ask questions below the confidence threshold, they are automatically held in the unanswered queue. Once you publish the answer, all askers receive an immediate in-app notification.
                </p>
                <button
                  onClick={() => setActiveTab('unanswered')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition"
                >
                  Review Pending Queue ({stats.pendingUnanswered})
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Official Site Staff Directories & Roster
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Manage on-duty facility managers, technical supervisors, electricians, plumbers, and DG operators. Employees query rosters dynamically in Paradigm Assist.
                </p>
                <button
                  onClick={() => setActiveTab('staff')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
                >
                  Manage Roster & Escalate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: UNANSWERED QUESTIONS QUEUE ── */}
        {activeTab === 'unanswered' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Unanswered Question Queue</h2>
                <p className="text-xs text-slate-400">
                  Questions that fell below the confidence threshold. Resolve once to answer and notify all asking staff.
                </p>
              </div>
              <button
                onClick={fetchUnanswered}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : unanswered.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm bg-slate-900 rounded-2xl border border-slate-800">
                🎉 All questions have been addressed! No pending items in queue.
              </div>
            ) : (
              <div className="space-y-3">
                {unanswered.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          q.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {q.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          Site: {q.locations?.name || 'All Sites'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Asked: {new Date(q.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white">
                        "{q.question}"
                      </div>
                      {q.admin_answer && (
                        <div className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40 mt-1">
                          <span className="font-bold">Published Answer:</span> {q.admin_answer}
                        </div>
                      )}
                    </div>

                    {q.status === 'pending' && (
                      <button
                        onClick={() => {
                          setResolveModalItem(q);
                          setResolveAnswer('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 self-start md:self-auto transition shadow-lg shadow-emerald-950 flex-shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Resolve & Publish FAQ
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: KNOWLEDGE BASE ITEMS ── */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter published SOPs, checklists, policies..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => setCreateItemModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950"
              >
                <Plus className="w-4 h-4" /> Add SOP / Policy
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {knowledgeItems
                .filter(it => it.title.toLowerCase().includes(searchItem.toLowerCase()) || it.content.toLowerCase().includes(searchItem.toLowerCase()))
                .map((it) => (
                  <div
                    key={it.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                          {it.source_table}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-semibold">
                          v{it.version || 1} • {it.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">{it.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {it.content}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Updated: {new Date(it.updated_at).toLocaleDateString()}</span>
                      <span className="text-slate-400">Verified</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: STAFF & ESCALATION ── */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* Staff Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Site Staff Duty Directory ({staffList.length} staff)</h2>
                <p className="text-xs text-slate-400">
                  Import roster via Excel/CSV or export official PDF documents.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  {importingStaff ? 'Importing...' : 'Upload Excel Roster'}
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={importingStaff}
                  />
                </label>
                <button
                  onClick={() => exportSiteStaffRosterPDF({
                    siteName: 'All Paradigm Sites',
                    staffList
                  })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF Roster
                </button>
              </div>
            </div>

            {/* Staff Table */}
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Shift</th>
                      <th className="p-3">Reporting To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {staffList.slice(0, 15).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-850">
                        <td className="p-3 font-bold text-white">{s.full_name}</td>
                        <td className="p-3">{s.designation}</td>
                        <td className="p-3">{s.department}</td>
                        <td className="p-3">{s.phone}</td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                            {s.shift_type || 'GS'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{s.reporting_manager_name || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Escalation Matrix Section */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-white">Incident Escalation Matrix ({escalationList.length} levels)</h2>
                  <p className="text-xs text-slate-400">Emergency hierarchy configured across sites.</p>
                </div>
                <button
                  onClick={() => exportEscalationMatrixPDF({
                    siteName: 'Central Paradigm Matrix',
                    escalationList
                  })}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-red-950 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Escalation PDF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {escalationList.map((e) => (
                  <div key={e.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-400">{e.level}</span>
                        <span className="text-xs font-bold text-white">{e.role_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">{e.contact_person} — {e.phone}</div>
                      <div className="text-[10px] text-slate-400">TAT: {e.tat_minutes} mins • {e.escalation_trigger}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: ENGINE RULES & THRESHOLDS ── */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Confidence Gate & Guardrails</h2>
              <p className="text-xs text-slate-400 mt-1">
                Calibrate strictness of the zero-hallucination engine.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">High Confidence Threshold</span>
                  <span className="text-emerald-400">{Math.round(settings.high_threshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.01"
                  value={settings.high_threshold}
                  onChange={(e) => setSettings({ ...settings, high_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Queries scoring above this score are considered authoritative.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">Medium Fallback Threshold</span>
                  <span className="text-cyan-400">{Math.round(settings.medium_threshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.75"
                  step="0.01"
                  value={settings.medium_threshold}
                  onChange={(e) => setSettings({ ...settings, medium_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Queries scoring below this trigger the unanswered ticket queue.</p>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950 transition"
            >
              Save Engine Settings
            </button>
          </div>
        )}
      </div>

      {/* ── Resolve Modal ── */}
      {resolveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Resolve & Publish Verified Answer
              </h3>
              <button onClick={() => setResolveModalItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">User Question:</span>
              <p className="font-semibold text-white mt-0.5">{resolveModalItem.question}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Category
              </label>
              <select
                value={resolveCategory}
                onChange={(e) => setResolveCategory(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="SOP">Standard Operating Procedure (SOP)</option>
                <option value="Policy">Leave & Duty Policy</option>
                <option value="Technical">MEP & Engineering</option>
                <option value="FAQ">General FAQ</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Verified Answer (Ground truth for AI future responses)
              </label>
              <textarea
                rows={4}
                value={resolveAnswer}
                onChange={(e) => setResolveAnswer(e.target.value)}
                placeholder="Type the official approved policy or procedure..."
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-center gap-2">
              <Bell className="w-4 h-4 flex-shrink-0" />
              <span>Publishing this will automatically send in-app notifications to all employees who asked this question.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolveModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveQuestion}
                disabled={publishing || !resolveAnswer.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-950 flex items-center gap-1.5"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Publish & Notify Askers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Knowledge Item Modal ── */}
      {createItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Add New SOP or Policy Document
              </h3>
              <button onClick={() => setCreateItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. DG Coolant Top-up SOP"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="MEP">MEP & Engineering</option>
                <option value="STP/WTP">Water Management (STP/WTP)</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Security">Security & Surveillance</option>
                <option value="Safety">Safety & Life Support</option>
                <option value="General">General Operations</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Content / Operational Instructions</label>
              <textarea
                rows={5}
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="Detail the steps, precautions, frequencies, and owner roles..."
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateItemModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950"
              >
                Save & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParadigmAssistAdminPage;
