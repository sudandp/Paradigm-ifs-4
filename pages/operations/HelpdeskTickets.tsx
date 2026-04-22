import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import type { OpsTicket, TicketPriority, TicketCategory, TicketStatus } from '../../types/operations';
import { Plus, Search, AlertCircle, Clock, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-800 border-red-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  P4: 'bg-blue-100 text-blue-800 border-blue-200'
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  'Open': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  'On Hold': 'bg-gray-100 text-gray-800',
  'Resolved': 'bg-green-100 text-green-800',
  'Closed': 'bg-slate-100 text-slate-800'
};

const HelpdeskTickets: React.FC = () => {
  const { tickets, fetchTickets, createTicket, updateTicket, isLoading, error } = useOpsStore();
  const { user } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'All'>('All');
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  const [formData, setFormData] = useState<Partial<OpsTicket>>({
    title: '',
    description: '',
    category: 'General',
    priority: 'P3',
    status: 'Open',
    entityId: '' // In a real app, this would be a select dropdown of allowed entities
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter(t => 
    (statusFilter === 'All' || t.status === statusFilter) &&
    (t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     t.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.entityId) {
      setToast({ message: 'Title and Entity are required', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createTicket({
        ...formData,
        createdBy: user?.id
      });
      setToast({ message: 'Ticket created successfully', type: 'success' });
      setShowForm(false);
      setFormData({ title: '', description: '', category: 'General', priority: 'P3', status: 'Open', entityId: '' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: TicketStatus) => {
    try {
      await updateTicket(id, { 
        status: newStatus,
        resolvedAt: newStatus === 'Resolved' || newStatus === 'Closed' ? new Date().toISOString() : undefined
      });
      setToast({ message: 'Status updated', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const isBreached = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Helpdesk Tickets</h1>
          <p className="text-sm text-muted">Manage site issues, complaints, and SLAs</p>
        </div>
        <Button onClick={() => setShowForm(true)} variant="primary" className="gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in-down shadow-sm">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Create New Ticket</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ticket Title *" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="E.g. AC not working in lobby" />
              <Input label="Entity ID (Temp) *" value={formData.entityId} onChange={e => setFormData(p => ({ ...p, entityId: e.target.value }))} placeholder="Paste UUID" />
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as TicketCategory }))}>
                  {['Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Priority / SLA</label>
                <select className="form-input" value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: e.target.value as TicketPriority }))}>
                  <option value="P1">P1 - Critical (2 Hours)</option>
                  <option value="P2">P2 - High (4 Hours)</option>
                  <option value="P3">P3 - Medium (24 Hours)</option>
                  <option value="P4">P4 - Low (48 Hours)</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted">Description</label>
              <textarea 
                className="form-input min-h-[100px]" 
                value={formData.description} 
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} 
                placeholder="Detailed description of the issue..."
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Ticket
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-accent/5">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Open', 'In Progress', 'On Hold', 'Resolved', 'Closed'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === status ? 'bg-accent text-white' : 'bg-page border border-border text-muted hover:text-primary-text'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-10 text-muted flex flex-col items-center">
              <MessageSquare className="w-12 h-12 text-border mb-3" />
              <p>No tickets found</p>
            </div>
          ) : (
            filteredTickets.map(ticket => {
              const breached = ticket.status !== 'Resolved' && ticket.status !== 'Closed' && isBreached(ticket.dueDate);
              
              return (
                <div key={ticket.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${breached ? 'border-red-300 bg-red-50/30' : 'border-border bg-page'}`}>
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-accent">{ticket.ticketNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${PRIORITY_COLORS[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[ticket.status]}`}>
                          {ticket.status}
                        </span>
                        {breached && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded animate-pulse">
                            <AlertCircle className="w-3 h-3" /> SLA BREACHED
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-base font-bold text-primary-text">{ticket.title}</h3>
                      
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {ticket.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Due: {ticket.dueDate ? new Date(ticket.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                        </span>
                        <span>Entity: <span className="font-semibold text-primary-text">{ticket.entityName || 'Unknown'}</span></span>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                      <select 
                        className="form-input text-xs py-1.5 min-w-[120px]"
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value as TicketStatus)}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpdeskTickets;
