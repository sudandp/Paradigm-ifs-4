import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import type { OpsTicket, TicketPriority, TicketCategory, TicketStatus, InventoryItem, OpsTicketMaterial } from '../../types/operations';
import { Plus, Search, AlertCircle, Clock, CheckCircle2, MessageSquare, Loader2, Package, Wrench, Trash2 } from 'lucide-react';
import { inventoryApi } from '../../services/inventoryApi';

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

  // Material Usage Modal State
  const [activeMaterialTicket, setActiveMaterialTicket] = useState<OpsTicket | null>(null);
  const [ticketMaterials, setTicketMaterials] = useState<OpsTicketMaterial[]>([]);
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [materialRemarks, setMaterialRemarks] = useState('');
  const [isLoggingMaterial, setIsLoggingMaterial] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const openMaterialModal = async (ticket: OpsTicket) => {
    setActiveMaterialTicket(ticket);
    try {
      const [mats, inv] = await Promise.all([
        inventoryApi.getTicketMaterials(ticket.id),
        inventoryApi.getInventoryItems(ticket.entityId)
      ]);
      setTicketMaterials(mats);
      setAvailableInventory(inv);
      if (inv.length > 0) setSelectedInventoryId(inv[0].id);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to load material data', type: 'error' });
    }
  };

  const handleAddMaterial = async () => {
    if (!activeMaterialTicket || !selectedInventoryId) return;
    const invItem = availableInventory.find(i => i.id === selectedInventoryId);
    if (!invItem) return;

    if (materialQty > invItem.currentStock) {
      setToast({ message: `Insufficient stock! Only ${invItem.currentStock} ${invItem.unitOfMeasure} available.`, type: 'error' });
      return;
    }

    setIsLoggingMaterial(true);
    try {
      const added = await inventoryApi.addTicketMaterial({
        ticketId: activeMaterialTicket.id,
        itemId: selectedInventoryId,
        quantityUsed: materialQty,
        unitPrice: invItem.unitCost || 0,
        remarks: materialRemarks
      });
      setTicketMaterials(prev => [...prev, added]);
      setToast({ message: `Logged ${materialQty} ${invItem.unitOfMeasure} of ${invItem.name}`, type: 'success' });
      setMaterialQty(1);
      setMaterialRemarks('');
      // Refresh inventory list to show updated stock
      const updatedInv = await inventoryApi.getInventoryItems(activeMaterialTicket.entityId);
      setAvailableInventory(updatedInv);
    } catch (e: any) {
      setToast({ message: e.message || 'Failed to log material', type: 'error' });
    } finally {
      setIsLoggingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    try {
      await inventoryApi.deleteTicketMaterial(matId);
      setTicketMaterials(prev => prev.filter(m => m.id !== matId));
      setToast({ message: 'Material log removed', type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to delete material', type: 'error' });
    }
  };

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
                      <button
                        onClick={() => openMaterialModal(ticket)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center justify-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5" /> Log Spares
                      </button>
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

      {/* Material Usage Modal */}
      {activeMaterialTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Material Consumption Log
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ticket: <span className="font-mono font-bold text-gray-700">{activeMaterialTicket.ticketNumber}</span> • {activeMaterialTicket.title}
                </p>
              </div>
              <button onClick={() => setActiveMaterialTicket(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Form to log new spare part */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider">Log Spare Part / Consumable</h4>
                
                {availableInventory.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">
                    No spare parts in stock for this site. Go to <a href="/operations/inventory" className="text-emerald-600 underline font-bold">Inventory Management</a> to add items.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Spare Part</label>
                        <select
                          value={selectedInventoryId}
                          onChange={e => setSelectedInventoryId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          {availableInventory.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.itemCode}) — Available: {i.currentStock} {i.unitOfMeasure} @ ₹{i.unitCost}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qty Used</label>
                        <input
                          type="number"
                          min="1"
                          value={materialQty}
                          onChange={e => setMaterialQty(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Remarks / Reason for replacement (optional)..."
                        value={materialRemarks}
                        onChange={e => setMaterialRemarks(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={handleAddMaterial}
                        disabled={isLoggingMaterial}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {isLoggingMaterial ? 'Adding...' : 'Issue & Deduct'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Logged Materials Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Logged Materials ({ticketMaterials.length})</h4>
                  <span className="text-xs font-bold text-emerald-700">
                    Total Material Cost: ₹{ticketMaterials.reduce((sum, m) => sum + (m.totalPrice || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {ticketMaterials.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                    No materials logged for this work order yet.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                    {ticketMaterials.map(m => (
                      <div key={m.id} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50/50">
                        <div>
                          <p className="font-bold text-gray-900">{m.itemName || 'Spare Part'}</p>
                          <p className="text-[11px] text-gray-400">
                            {m.quantityUsed} units @ ₹{m.unitPrice} {m.remarks && `• ${m.remarks}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">₹{m.totalPrice?.toLocaleString('en-IN')}</span>
                          <button
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="text-gray-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveMaterialTicket(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default HelpdeskTickets;
