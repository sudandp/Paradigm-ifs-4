import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Pin, 
  AlertTriangle, 
  Info, 
  ShieldAlert, 
  CheckCircle, 
  Plus, 
  X, 
  Calendar, 
  Users, 
  ExternalLink,
  Megaphone,
  Check
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export interface FacilityNotice {
  id: string;
  title: string;
  content: string;
  category: 'safety' | 'operational' | 'statutory' | 'general';
  targetAudience: 'all' | 'site_ops' | 'security' | 'mep' | 'hr' | 'finance' | 'management';
  publishedBy: string;
  publishedAt: string;
  expiresAt: string;
  isPinned: boolean;
  acknowledgedBy: string[]; // user IDs who marked as read
}

const DEFAULT_NOTICES: FacilityNotice[] = [
  {
    id: 'NOT-01',
    title: 'High Alert: Cyclone & Heavy Rainfall Preparedness Protocol',
    content: 'All site MEP teams must test basement dewatering pumps, verify DG fuel level (>85%), and clear terrace stormwater drains immediately.',
    category: 'safety',
    targetAudience: 'site_ops',
    publishedBy: 'Operations Command Center',
    publishedAt: '2026-10-26T08:00:00Z',
    expiresAt: '2026-10-31T23:59:59Z',
    isPinned: true,
    acknowledgedBy: []
  },
  {
    id: 'NOT-02',
    title: 'Diwali Festival Bonus & Uniform Compliance Circular',
    content: 'Full festival bonus disbursement guidelines issued. All staff on duty during Diwali week must be in full company uniform with PSARA ID badges.',
    category: 'statutory',
    targetAudience: 'all',
    publishedBy: 'HR Corporate Office',
    publishedAt: '2026-10-25T11:30:00Z',
    expiresAt: '2026-11-05T23:59:59Z',
    isPinned: true,
    acknowledgedBy: []
  },
  {
    id: 'NOT-03',
    title: 'Biometric Recalibration Schedule for Hyderabad Sites',
    content: 'IT Hardware team will visit iTowers Exente and Southwall Residency tomorrow at 10:00 AM for optical sensor firmware upgrade.',
    category: 'operational',
    targetAudience: 'mep',
    publishedBy: 'IT Infrastructure',
    publishedAt: '2026-10-26T14:15:00Z',
    expiresAt: '2026-10-28T18:00:00Z',
    isPinned: false,
    acknowledgedBy: []
  },
  {
    id: 'NOT-04',
    title: 'Monthly Client Invoicing Deadline Reminder (October Cycle)',
    content: 'All site billing sheets and verified muster attendance must be submitted to accounts by 28th October 05:00 PM without delay.',
    category: 'general',
    targetAudience: 'finance',
    publishedBy: 'Finance & Accounts',
    publishedAt: '2026-10-24T09:00:00Z',
    expiresAt: '2026-10-29T17:00:00Z',
    isPinned: false,
    acknowledgedBy: []
  }
];

export const BroadcastNoticesBoard: React.FC<{
  departmentFilter?: string;
}> = ({ departmentFilter = 'all' }) => {
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<FacilityNotice[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_facility_notices');
      return saved ? JSON.parse(saved) : DEFAULT_NOTICES;
    } catch {
      return DEFAULT_NOTICES;
    }
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'safety' | 'operational' | 'statutory' | 'general'>('all');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const saveNotices = (newNotices: FacilityNotice[]) => {
    setNotices(newNotices);
    try {
      localStorage.setItem('paradigm_facility_notices', JSON.stringify(newNotices));
    } catch (e) {
      console.warn('Failed to save notices to localStorage', e);
    }
  };

  const handleAcknowledge = (id: string) => {
    if (!user?.id) return;
    const updated = notices.map(n => {
      if (n.id !== id) return n;
      const ack = n.acknowledgedBy || [];
      if (ack.includes(user.id)) return n;
      return { ...n, acknowledgedBy: [...ack, user.id] };
    });
    saveNotices(updated);
  };

  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    category: 'operational' as FacilityNotice['category'],
    targetAudience: 'all' as FacilityNotice['targetAudience'],
    daysValid: 7,
    isPinned: false
  });

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotice.title.trim() || !newNotice.content.trim()) return;

    const expiresAt = new Date(Date.now() + newNotice.daysValid * 24 * 3600 * 1000).toISOString();
    const created: FacilityNotice = {
      id: `NOT-${Date.now().toString().slice(-4)}`,
      title: newNotice.title,
      content: newNotice.content,
      category: newNotice.category,
      targetAudience: newNotice.targetAudience,
      publishedBy: user?.name ? `${user.name} (${user.role || 'Admin'})` : 'Facility Desk',
      publishedAt: new Date().toISOString(),
      expiresAt,
      isPinned: newNotice.isPinned,
      acknowledgedBy: user?.id ? [user.id] : []
    };

    saveNotices([created, ...notices]);
    setIsPublishModalOpen(false);
    setNewNotice({
      title: '',
      content: '',
      category: 'operational',
      targetAudience: 'all',
      daysValid: 7,
      isPinned: false
    });
  };

  // Filter notices
  const filteredNotices = useMemo(() => {
    return notices
      .filter(n => {
        if (activeCategory !== 'all' && n.category !== activeCategory) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [notices, activeCategory]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Digital Notice Board & Circulars
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006B3F]">
                Live Board
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official circulars, safety bulletins, and departmental advisories with read receipts.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsPublishModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006B3F] hover:bg-[#005230] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Notice</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="p-3 sm:px-5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
        {(['all', 'safety', 'statutory', 'operational', 'general'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-lg font-medium capitalize whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-[#006B3F] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notices Stream */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] flex-1">
        {filteredNotices.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">No active circulars in this category.</p>
          </div>
        ) : (
          filteredNotices.map(notice => {
            const isRead = user?.id ? notice.acknowledgedBy?.includes(user.id) : false;

            return (
              <div 
                key={notice.id}
                className={`p-4 sm:p-5 hover:bg-slate-50/70 transition-colors ${
                  notice.isPinned ? 'bg-amber-50/20' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {notice.isPinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                          <Pin className="w-3 h-3 fill-amber-700 text-amber-700" /> Pinned
                        </span>
                      )}

                      {notice.category === 'safety' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Safety Alert
                        </span>
                      )}
                      {notice.category === 'statutory' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                          Statutory
                        </span>
                      )}
                      {notice.category === 'operational' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                          Operations
                        </span>
                      )}

                      <span className="text-[11px] font-medium text-slate-400">
                        {new Date(notice.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {notice.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {notice.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
                      <span className="text-slate-500 font-medium">
                        By {notice.publishedBy}
                      </span>

                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[10px]">
                          Audience: <strong className="text-slate-600 capitalize">{notice.targetAudience}</strong>
                        </span>

                        {isRead ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> Read
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(notice.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#006B3F] hover:underline"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Publish Official Facility Circular
              </h3>
              <button 
                onClick={() => setIsPublishModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Circular Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandatory HT Panel Maintenance Scheduled for Sunday"
                  value={newNotice.title}
                  onChange={e => setNewNotice({ ...newNotice, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Detailed Advisory Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide specific instructions, timing, affected towers, and point of contact..."
                  value={newNotice.content}
                  onChange={e => setNewNotice({ ...newNotice, content: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newNotice.category}
                    onChange={e => setNewNotice({ ...newNotice, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="operational">Operational Advisory</option>
                    <option value="safety">Safety / Emergency Alert</option>
                    <option value="statutory">Statutory & Compliance</option>
                    <option value="general">General Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={newNotice.targetAudience}
                    onChange={e => setNewNotice({ ...newNotice, targetAudience: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="all">All Company & Site Staff</option>
                    <option value="site_ops">Site Operations & Supervisors</option>
                    <option value="security">Security Guards & Marshals</option>
                    <option value="mep">Technical & MEP Engineers</option>
                    <option value="finance">Finance & Accounts</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNotice.isPinned}
                    onChange={e => setNewNotice({ ...newNotice, isPinned: e.target.checked })}
                    className="w-4 h-4 rounded text-[#006B3F] focus:ring-[#006B3F] border-slate-300"
                  />
                  <span className="font-semibold text-slate-700">Pin to top of board</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#006B3F] text-white font-semibold shadow-xs hover:bg-[#005230]"
                >
                  Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
