import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import type { OpsMaintenanceSchedule, MaintenanceFrequency } from '../../types/operations';
import { Plus, Search, Calendar as CalIcon, Settings, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

const MaintenanceScheduler: React.FC = () => {
  const { schedules, fetchSchedules, createSchedule, updateSchedule, isLoading } = useOpsStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  const [formData, setFormData] = useState<Partial<OpsMaintenanceSchedule>>({
    taskName: '',
    description: '',
    category: 'Electrical',
    frequency: 'Monthly',
    status: 'Active',
    entityId: ''
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const filteredSchedules = schedules.filter(s => 
    s.taskName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateNextDue = (lastDateStr: string, freq: MaintenanceFrequency) => {
    const d = new Date(lastDateStr);
    switch(freq) {
      case 'Daily': d.setDate(d.getDate() + 1); break;
      case 'Weekly': d.setDate(d.getDate() + 7); break;
      case 'Fortnightly': d.setDate(d.getDate() + 14); break;
      case 'Monthly': d.setMonth(d.getMonth() + 1); break;
      case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'Half-Yearly': d.setMonth(d.getMonth() + 6); break;
      case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
    }
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.taskName || !formData.entityId || !formData.frequency) {
      setToast({ message: 'Task Name, Entity, and Frequency are required', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // If setting a start date
      if (formData.lastCompletedDate) {
        formData.nextDueDate = calculateNextDue(formData.lastCompletedDate, formData.frequency as MaintenanceFrequency);
      }
      
      await createSchedule(formData);
      setToast({ message: 'Schedule created successfully', type: 'success' });
      setShowForm(false);
      setFormData({ taskName: '', description: '', category: 'Electrical', frequency: 'Monthly', status: 'Active', entityId: '' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async (schedule: OpsMaintenanceSchedule) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextDue = calculateNextDue(today, schedule.frequency);
      
      await updateSchedule(schedule.id, {
        lastCompletedDate: today,
        nextDueDate: nextDue
      });
      setToast({ message: `Marked complete. Next due: ${nextDue}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Preventive Maintenance</h1>
          <p className="text-sm text-muted">Manage recurring PPM tasks across properties</p>
        </div>
        <Button onClick={() => setShowForm(true)} variant="primary" className="gap-2">
          <Plus className="w-4 h-4" /> New PPM Task
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-fade-in-down">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Create Scheduled Task</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Task Name *" value={formData.taskName} onChange={e => setFormData(p => ({ ...p, taskName: e.target.value }))} placeholder="E.g. Generator Servicing" />
              <Input label="Entity ID (Temp) *" value={formData.entityId} onChange={e => setFormData(p => ({ ...p, entityId: e.target.value }))} />
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as any }))}>
                  {['Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Frequency *</label>
                <select className="form-input" value={formData.frequency} onChange={e => setFormData(p => ({ ...p, frequency: e.target.value as any }))}>
                  {['Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <Input label="First/Last Completed Date" type="date" value={formData.lastCompletedDate || ''} onChange={e => setFormData(p => ({ ...p, lastCompletedDate: e.target.value }))} />
              <Input label="Asset Reference (Optional)" value={formData.assetReference || ''} onChange={e => setFormData(p => ({ ...p, assetReference: e.target.value }))} placeholder="E.g. DG-01" />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Schedule
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-accent/5">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Search tasks or properties..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-page border-b border-border text-muted">
                  <th className="p-4 font-semibold">Task & Entity</th>
                  <th className="p-4 font-semibold">Frequency</th>
                  <th className="p-4 font-semibold">Last Done</th>
                  <th className="p-4 font-semibold">Next Due</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSchedules.map(schedule => {
                  const isOverdue = schedule.nextDueDate && new Date(schedule.nextDueDate) < new Date();
                  
                  return (
                    <tr key={schedule.id} className={`hover:bg-accent/5 transition-colors ${isOverdue ? 'bg-red-50/20' : ''}`}>
                      <td className="p-4">
                        <div className="font-bold text-primary-text">{schedule.taskName}</div>
                        <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Settings className="w-3 h-3" /> {schedule.entityName || 'Unknown Entity'}
                          {schedule.assetReference && ` • ${schedule.assetReference}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-page border border-border rounded-md text-xs font-semibold">
                          {schedule.frequency}
                        </span>
                      </td>
                      <td className="p-4 text-muted">
                        {schedule.lastCompletedDate ? new Date(schedule.lastCompletedDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-1.5 font-semibold ${isOverdue ? 'text-red-600' : 'text-primary-text'}`}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          {schedule.nextDueDate ? new Date(schedule.nextDueDate).toLocaleDateString('en-IN') : 'Not Set'}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleMarkComplete(schedule)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Complete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSchedules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">No scheduled tasks found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceScheduler;
