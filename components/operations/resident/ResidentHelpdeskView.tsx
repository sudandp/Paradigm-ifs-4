import React, { useState } from 'react';
import { 
  Plus, 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Star, 
  Copy, 
  Phone, 
  User, 
  Camera, 
  Calendar, 
  Wrench, 
  Zap, 
  Droplet, 
  Home, 
  X, 
  Loader2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import type { OpsTicket, TicketCategory, TicketPriority } from '../../../types/operations';
import { useOpsStore } from '../../../store/opsStore';
import Button from '../../ui/Button';
import { TicketRatingModal } from '../TicketRatingModal';

interface ResidentHelpdeskViewProps {
  unitNumber: string;
  residentName: string;
  residentPhone: string;
  entityId?: string;
  entityName?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  'Electrical': Zap,
  'Plumbing': Droplet,
  'Carpentry': Wrench,
  'Water Supply': Droplet,
  'Lift': Wrench,
  'Pest Control': AlertTriangle,
  'Security': ShieldCheck,
  'Housekeeping': Home,
  'General': Ticket
};

const STATUS_PROGRESS: Record<string, number> = {
  'Open': 25,
  'Assigned': 50,
  'In Progress': 75,
  'Resolved': 100,
  'Closed': 100
};

export const ResidentHelpdeskView: React.FC<ResidentHelpdeskViewProps> = ({
  unitNumber,
  residentName,
  residentPhone,
  entityId,
  entityName
}) => {
  const { tickets, createTicket, requestClosureOtp, isLoading } = useOpsStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [ratingTicket, setRatingTicket] = useState<OpsTicket | null>(null);
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpLoadingId, setOtpLoadingId] = useState<string | null>(null);

  // New ticket state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TicketCategory>('Electrical');
  const [newPriority, setNewPriority] = useState<TicketPriority>('P3');
  const [newDescription, setNewDescription] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('Morning (10:00 AM - 01:00 PM)');
  const [photoUrl, setPhotoUrl] = useState('');

  // Filter tickets for this resident's unit
  const myTickets = tickets.filter(t => 
    t.unitNumber?.toLowerCase() === unitNumber.toLowerCase() ||
    t.residentPhone === residentPhone
  );

  const activeTickets = myTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
  const pastTickets = myTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      await createTicket({
        title: newTitle,
        category: newCategory,
        priority: newPriority,
        description: `[Preferred Slot: ${preferredSlot}] ${newDescription}`,
        unitNumber,
        residentName,
        residentPhone,
        entityId: entityId || 'ent_aeris_residences',
        status: 'Open'
      });
      setShowNewModal(false);
      setNewTitle('');
      setNewDescription('');
      setPhotoUrl('');
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = async (ticketId: string) => {
    setOtpLoadingId(ticketId);
    try {
      await requestClosureOtp(ticketId);
    } catch (err) {
      console.error('Failed to request OTP', err);
    } finally {
      setOtpLoadingId(null);
    }
  };

  const handleCopyOtp = (otp: string, id: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtpId(id);
    setTimeout(() => setCopiedOtpId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Banner / Unit Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-white">
              Unit {unitNumber}
            </span>
            <span className="text-xs font-semibold text-gray-700">
              {residentName}
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            My Unit Service & Maintenance Helpdesk
          </h2>
          <p className="text-xs text-gray-500">
            Raise requests for your apartment, track live technician visits, and verify completions via secure OTP
          </p>
        </div>

        <Button 
          onClick={() => setShowNewModal(true)}
          variant="primary" 
          className="gap-2 shadow-sm text-xs font-bold shrink-0"
        >
          <Plus className="w-4 h-4" /> Raise Complaint / Request
        </Button>
      </div>

      {/* Active Work Orders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>In-Progress Requests</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {activeTickets.length}
            </span>
          </h3>
        </div>

        {activeTickets.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-gray-200 bg-white text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800">No Pending Requests</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Everything in unit {unitNumber} is running smoothly. Click "Raise Complaint" if you require an electrician, plumber, or general assistance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTickets.map(ticket => {
              const progress = STATUS_PROGRESS[ticket.status] || 25;
              const CategoryIcon = CATEGORY_ICONS[ticket.category] || Ticket;

              return (
                <div 
                  key={ticket.id}
                  className="p-5 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-4 hover:border-primary/30 transition"
                >
                  {/* Top: Ticket Number, Category & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-mono text-[10px] text-gray-400 block font-semibold">
                          {ticket.ticketNumber}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 leading-snug">
                          {ticket.title}
                        </h4>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      {ticket.status}
                    </span>
                  </div>

                  {/* Progress Bar Tracker */}
                  <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                      <span>Service Progress</span>
                      <span className="text-primary">{ticket.status}</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 pt-0.5">
                      <span>Logged</span>
                      <span>Assigned</span>
                      <span>In-Progress</span>
                      <span>Verified</span>
                    </div>
                  </div>

                  {/* Description / Slot info */}
                  {ticket.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {ticket.description}
                    </p>
                  )}

                  {/* Assigned Technician Banner */}
                  {ticket.assignedToName ? (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-bold text-xs">
                          {ticket.assignedToName.charAt(0)}
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block">Assigned Technician</span>
                          <span className="font-bold text-gray-900">{ticket.assignedToName}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        On Duty
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-gray-50 rounded-xl text-xs text-gray-400 text-center">
                      Awaiting technician assignment by facility team
                    </div>
                  )}

                  {/* DYNAMIC CLOSURE OTP CARD (Crucial Resident Feature) */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Completion Verification OTP
                      </span>
                      {ticket.closureOtp && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded">
                          Single-Use
                        </span>
                      )}
                    </div>

                    {ticket.closureOtp ? (
                      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-emerald-200">
                        <div>
                          <div className="font-mono text-xl font-black text-emerald-900 tracking-widest">
                            {ticket.closureOtp}
                          </div>
                          <span className="text-[10px] text-gray-400 block">
                            Share with technician only when work is satisfactorily done
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyOtp(ticket.closureOtp!, ticket.id)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-xs font-bold flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedOtpId === ticket.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-800 text-[11px]">
                          Generate OTP for technician when they arrive
                        </span>
                        <Button 
                          variant="primary" 
                          onClick={() => handleRequestOtp(ticket.id)}
                          disabled={otpLoadingId === ticket.id}
                          className="py-1 px-3 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                        >
                          {otpLoadingId === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Get Closure OTP'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Completed Requests with Rating Sheet */}
      {pastTickets.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Completed Service History</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              {pastTickets.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastTickets.map(ticket => (
              <div 
                key={ticket.id}
                className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-400">{ticket.ticketNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Resolved
                    </span>
                  </div>
                  <h5 className="font-bold text-gray-900 text-xs truncate max-w-[200px]">{ticket.title}</h5>
                  <span className="text-[10px] text-gray-400 block">
                    Completed: {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString('en-IN') : 'Recent'}
                  </span>
                </div>

                <div>
                  {ticket.rating ? (
                    <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{ticket.rating}/5</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setRatingTicket(ticket)}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-bold hover:bg-amber-100 transition flex items-center gap-1 text-[11px]"
                    >
                      <Star className="w-3.5 h-3.5" /> Rate Service
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Complaint / Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Raise Flat Service Request</h3>
                <p className="text-xs text-gray-500">Unit: {unitNumber} ({residentName})</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Issue Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Electrical', 'Plumbing', 'Carpentry', 'Water Supply', 'Lift', 'Pest Control'] as TicketCategory[]).map(cat => {
                    const Icon = CATEGORY_ICONS[cat] || Ticket;
                    const isSel = newCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                          isSel ? 'bg-primary text-white border-primary shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">What is the problem? *</label>
                <input 
                  type="text"
                  placeholder="e.g. Master bedroom switch spark / Geyser not heating"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Technician Visit Window</label>
                <select
                  value={preferredSlot}
                  onChange={e => setPreferredSlot(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-primary"
                >
                  <option value="Morning (10:00 AM - 01:00 PM)">Morning (10:00 AM - 01:00 PM)</option>
                  <option value="Afternoon (02:00 PM - 05:00 PM)">Afternoon (02:00 PM - 05:00 PM)</option>
                  <option value="Evening (05:00 PM - 08:00 PM)">Evening (05:00 PM - 08:00 PM)</option>
                  <option value="Immediate / Emergency">Emergency (Immediate Visit Required)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Additional Notes / Instructions</label>
                <textarea 
                  rows={3}
                  placeholder="Provide any specific access instructions (e.g. Please ring bell twice, dog at home)..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rating Sheet Modal */}
      {ratingTicket && (
        <TicketRatingModal 
          ticket={ratingTicket}
          isOpen={!!ratingTicket}
          onClose={() => setRatingTicket(null)}
          onSuccess={() => setRatingTicket(null)}
        />
      )}
    </div>
  );
};
