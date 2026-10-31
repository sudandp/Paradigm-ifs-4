import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Filter, 
  Calendar, 
  User, 
  ChevronRight, 
  Search, 
  ArrowUpRight, 
  Check, 
  X,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export interface MomActionItem {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  title: string;
  description?: string;
  assigneeName: string;
  assigneeRole: string;
  assigneeEmail?: string;
  department: 'management' | 'backoffice' | 'hr' | 'finance' | 'site_ops' | 'all';
  siteName: string;
  deadline: string; // ISO string
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

const DEFAULT_MOM_ITEMS: MomActionItem[] = [
  {
    id: 'MOM-2026-101',
    meetingTitle: 'Monthly Client Steering Committee (iTowers Exente)',
    meetingDate: '2026-10-24',
    title: 'Recalibrate STP Tertiary Sand Filter & Chlorination Doser',
    description: 'Ensure treated water turbidity is below 5 NTU before next resident audit.',
    assigneeName: 'Santosh Patil',
    assigneeRole: 'MEP Project Engineer',
    department: 'site_ops',
    siteName: 'iTowers Exente',
    deadline: new Date(Date.now() + 18 * 3600 * 1000).toISOString(), // ~18 hours from now
    priority: 'critical',
    status: 'in_progress',
    createdAt: '2026-10-24T10:00:00Z'
  },
  {
    id: 'MOM-2026-102',
    meetingTitle: 'Quarterly Financial & Vendor Audit',
    meetingDate: '2026-10-22',
    title: 'Finalize Otis Elevator AMC Renewal Contract & Penalty Clauses',
    description: 'Negotiate inclusion of 4-hour SLA penalty clause for high-rise passenger lifts.',
    assigneeName: 'Priya Narang',
    assigneeRole: 'Procurement Specialist',
    department: 'finance',
    siteName: 'All Sites',
    deadline: new Date(Date.now() + 42 * 3600 * 1000).toISOString(), // ~1.7 days from now
    priority: 'high',
    status: 'pending',
    createdAt: '2026-10-22T14:30:00Z'
  },
  {
    id: 'MOM-2026-103',
    meetingTitle: 'HR Headcount & Labor Compliance Review',
    meetingDate: '2026-10-25',
    title: 'Deploy 4 Certified Fire Marshals for Diwali Security Roster',
    description: 'Coordinate with PSARA licensed agency to fulfill festival gate roster.',
    assigneeName: 'Vikram Choudhary',
    assigneeRole: 'HR Operations Lead',
    department: 'hr',
    siteName: 'Sobha Silicon Oasis',
    deadline: new Date(Date.now() + 68 * 3600 * 1000).toISOString(),
    priority: 'high',
    status: 'in_progress',
    createdAt: '2026-10-25T11:00:00Z'
  },
  {
    id: 'MOM-2026-104',
    meetingTitle: 'Executive Leadership Strategy Call',
    meetingDate: '2026-10-20',
    title: 'Submit Q3 Facility Energy Audit Report to Board',
    description: 'Compile EB consumption vs DG fuel utilization variance for executive sign-off.',
    assigneeName: 'Rajesh Nair',
    assigneeRole: 'VP Operations',
    department: 'management',
    siteName: 'Head Office',
    deadline: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // overdue by 4h
    priority: 'critical',
    status: 'pending',
    createdAt: '2026-10-20T16:00:00Z'
  },
  {
    id: 'MOM-2026-105',
    meetingTitle: 'Back Office Operations Sync',
    meetingDate: '2026-10-26',
    title: 'Dispatch Replacement CCTV Cameras for Southwall Gate 2',
    description: 'Verify warranty clearance and send 2 Hikvision 4MP bullet cameras via express courier.',
    assigneeName: 'Anil Kumar',
    assigneeRole: 'Admin Supervisor',
    department: 'backoffice',
    siteName: 'Southwall Residency',
    deadline: new Date(Date.now() + 30 * 3600 * 1000).toISOString(),
    priority: 'medium',
    status: 'completed',
    createdAt: '2026-10-26T09:30:00Z'
  }
];

export const MomActionTracker: React.FC<{
  departmentFilter?: string;
  siteFilter?: string;
}> = ({ departmentFilter = 'all', siteFilter = 'all' }) => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<MomActionItem[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_mom_action_items');
      return saved ? JSON.parse(saved) : DEFAULT_MOM_ITEMS;
    } catch {
      return DEFAULT_MOM_ITEMS;
    }
  });

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update countdown clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Save to localStorage
  const saveItems = (newItems: MomActionItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem('paradigm_mom_action_items', JSON.stringify(newItems));
    } catch (e) {
      console.warn('Failed to save MOM items to localStorage', e);
    }
  };

  // Helper to compute countdown
  const getDeadlineStats = (deadlineStr: string) => {
    const deadlineTime = new Date(deadlineStr).getTime();
    const diff = deadlineTime - currentTime;
    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);

    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    let text = '';
    if (days > 0) {
      text = `${days}d ${remHours}h ${isOverdue ? 'overdue' : 'left'}`;
    } else {
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      text = `${hours}h ${minutes}m ${isOverdue ? 'overdue' : 'left'}`;
    }

    return { isOverdue, text, diff };
  };

  // Toggle item status
  const handleToggleStatus = (id: string) => {
    const updated = items.map(item => {
      if (item.id !== id) return item;
      const nextStatus: MomActionItem['status'] = 
        item.status === 'pending' ? 'in_progress' :
        item.status === 'in_progress' ? 'completed' : 'pending';
      return { ...item, status: nextStatus };
    });
    saveItems(updated);
  };

  // Form state for creating MOM item
  const [newItem, setNewItem] = useState({
    meetingTitle: '',
    title: '',
    description: '',
    assigneeName: user?.name || '',
    assigneeRole: user?.role || 'Facility Manager',
    department: 'site_ops' as MomActionItem['department'],
    siteName: 'iTowers Exente',
    daysToResolve: 2,
    priority: 'high' as MomActionItem['priority']
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title.trim() || !newItem.meetingTitle.trim()) return;

    const deadline = new Date(Date.now() + newItem.daysToResolve * 24 * 3600 * 1000).toISOString();
    const created: MomActionItem = {
      id: `MOM-${Date.now().toString().slice(-4)}`,
      meetingTitle: newItem.meetingTitle,
      meetingDate: new Date().toISOString().split('T')[0],
      title: newItem.title,
      description: newItem.description,
      assigneeName: newItem.assigneeName,
      assigneeRole: newItem.assigneeRole,
      department: newItem.department,
      siteName: newItem.siteName,
      deadline,
      priority: newItem.priority,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    saveItems([created, ...items]);
    setIsAddModalOpen(false);
    setNewItem({
      meetingTitle: '',
      title: '',
      description: '',
      assigneeName: user?.name || '',
      assigneeRole: user?.role || 'Facility Manager',
      department: 'site_ops',
      siteName: 'iTowers Exente',
      daysToResolve: 2,
      priority: 'high'
    });
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Department filter
      if (departmentFilter !== 'all' && item.department !== 'all' && item.department !== departmentFilter) {
        return false;
      }
      // Site filter
      if (siteFilter !== 'all' && item.siteName !== 'All Sites' && item.siteName !== siteFilter) {
        return false;
      }
      // Status filter
      if (filterStatus === 'overdue') {
        const { isOverdue } = getDeadlineStats(item.deadline);
        if (!isOverdue || item.status === 'completed') return false;
      } else if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.title.toLowerCase().includes(q) ||
          item.meetingTitle.toLowerCase().includes(q) ||
          item.assigneeName.toLowerCase().includes(q) ||
          item.siteName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [items, departmentFilter, siteFilter, filterStatus, searchQuery, currentTime]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter(i => i.status === 'completed').length;
    const overdue = items.filter(i => {
      if (i.status === 'completed') return false;
      return new Date(i.deadline).getTime() < currentTime;
    }).length;
    const pending = total - completed;
    return { total, completed, overdue, pending };
  }, [items, currentTime]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Minutes of Meeting (MOM) Action Items
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006B3F]">
                {filteredItems.length} Tasks
              </span>
              {stats.overdue > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                  {stats.overdue} Overdue
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live countdown timers and accountability tracker for client & internal leadership directives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006B3F] hover:bg-[#005230] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add MOM Action</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 sm:px-5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {(['all', 'pending', 'in_progress', 'overdue', 'completed'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-all ${
                filterStatus === st 
                  ? 'bg-[#006B3F] text-white shadow-xs' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'in_progress' ? 'In Progress' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search meeting, title, person..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#006B3F]"
          />
        </div>
      </div>

      {/* Action Items List */}
      <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-600" />
            <p className="text-sm font-medium text-slate-600">All caught up! No pending MOM action items found.</p>
            <p className="text-xs text-slate-400 mt-1">Directives recorded during meetings will be tracked here with live countdowns.</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const { isOverdue, text } = getDeadlineStats(item.deadline);
            const isCompleted = item.status === 'completed';

            return (
              <div 
                key={item.id}
                className={`p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isCompleted ? 'opacity-60 bg-slate-50/30' : ''
                }`}
              >
                {/* Left Section: Checkbox & Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(item.id)}
                    title={`Click to mark as ${item.status === 'pending' ? 'In Progress' : item.status === 'in_progress' ? 'Completed' : 'Pending'}`}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                      isCompleted 
                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                        : item.status === 'in_progress'
                        ? 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'border-slate-300 hover:border-emerald-600 bg-white'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {item.status === 'in_progress' && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.meetingTitle}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {item.siteName}
                      </span>
                      {item.priority === 'critical' && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                          Critical
                        </span>
                      )}
                      {item.priority === 'high' && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          High
                        </span>
                      )}
                    </div>

                    <h4 className={`text-sm font-semibold text-slate-900 tracking-tight ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                      {item.title}
                    </h4>

                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <User className="w-3 h-3 text-slate-400" />
                        {item.assigneeName} ({item.assigneeRole})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Section: Live Countdown & Status */}
                <div className="flex items-center justify-between md:justify-end gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="flex items-center md:justify-end gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${isOverdue && !isCompleted ? 'text-rose-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-bold font-mono ${
                        isCompleted 
                          ? 'text-emerald-700' 
                          : isOverdue 
                          ? 'text-rose-600 animate-pulse' 
                          : 'text-amber-700'
                      }`}>
                        {isCompleted ? 'Completed' : text}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Due: {new Date(item.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    item.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : item.status === 'in_progress'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {item.status === 'completed' ? 'Done' : item.status === 'in_progress' ? 'Active' : 'Queued'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal for adding MOM item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Record New MOM Action Directive
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meeting Title / Committee Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Operations Review, Client Steering Meeting"
                  value={newItem.meetingTitle}
                  onChange={e => setNewItem({ ...newItem, meetingTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Action Directive Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean and test Basement 2 sump pumps"
                  value={newItem.title}
                  onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Site / Location</label>
                  <input
                    type="text"
                    value={newItem.siteName}
                    onChange={e => setNewItem({ ...newItem, siteName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={newItem.department}
                    onChange={e => setNewItem({ ...newItem, department: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="site_ops">Site Operations & MEP</option>
                    <option value="hr">HR & Manpower</option>
                    <option value="finance">Finance & Billing</option>
                    <option value="backoffice">Back Office & Admin</option>
                    <option value="management">Executive Management</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assignee Name</label>
                  <input
                    type="text"
                    value={newItem.assigneeName}
                    onChange={e => setNewItem({ ...newItem, assigneeName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assignee Role</label>
                  <input
                    type="text"
                    value={newItem.assigneeRole}
                    onChange={e => setNewItem({ ...newItem, assigneeRole: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deadline Horizon</label>
                  <select
                    value={newItem.daysToResolve}
                    onChange={e => setNewItem({ ...newItem, daysToResolve: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value={1}>24 Hours (Urgent)</option>
                    <option value={2}>48 Hours (Standard)</option>
                    <option value={3}>3 Days</option>
                    <option value={5}>5 Days</option>
                    <option value={7}>1 Week</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newItem.priority}
                    onChange={e => setNewItem({ ...newItem, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="critical">Critical (P0 Escalation)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#006B3F] text-white font-semibold shadow-xs hover:bg-[#005230]"
                >
                  Save & Start Countdown
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
