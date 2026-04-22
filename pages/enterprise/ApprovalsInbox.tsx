import React, { useState, useEffect } from 'react';
import { useEnterpriseStore } from '../../store/enterpriseStore';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { CheckCircle2, XCircle, Clock, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';
import type { OpsApprovalRequest, ApprovalStatus } from '../../types/enterprise';

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  'Pending': 'bg-orange-100 text-orange-800 border-orange-200',
  'Approved': 'bg-green-100 text-green-800 border-green-200',
  'Rejected': 'bg-red-100 text-red-800 border-red-200'
};

const ApprovalsInbox: React.FC = () => {
  const { approvalRequests, fetchApprovalRequests, processApproval, isLoading } = useEnterpriseStore();
  const { user } = useAuthStore();
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'All'>('Pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Modals
  const [showRejectModal, setShowRejectModal] = useState<OpsApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    // In a real app, we might pass the user's current role to filter requests meant for them.
    // For this demo, we fetch all and let them see the whole queue.
    fetchApprovalRequests(undefined, statusFilter === 'All' ? undefined : statusFilter);
  }, [statusFilter]);

  const handleApprove = async (request: OpsApprovalRequest) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      await processApproval(request.id, user.id, 'Approved', 'Approved via Enterprise Inbox');
      setToast({ message: 'Request Approved Successfully', type: 'success' });
      fetchApprovalRequests(undefined, statusFilter === 'All' ? undefined : statusFilter);
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
      setToast({ message: 'Request Rejected', type: 'success' });
      setShowRejectModal(null);
      setRejectReason('');
      fetchApprovalRequests(undefined, statusFilter === 'All' ? undefined : statusFilter);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-accent" /> Approvals Inbox
          </h1>
          <p className="text-sm text-muted">Manage multi-stage sign-offs for Contracts, Quotations, and operations.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex gap-2 overflow-x-auto bg-accent/5">
          {['Pending', 'Approved', 'Rejected', 'All'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                statusFilter === status 
                  ? 'bg-accent text-white shadow-md' 
                  : 'bg-page border border-border text-muted hover:text-primary-text'
              }`}
            >
              {status} Requests
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-4 bg-page/30">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : approvalRequests.length === 0 ? (
            <div className="text-center py-20 text-muted flex flex-col items-center">
              <ShieldAlert className="w-12 h-12 text-border mb-3 opacity-50" />
              <p className="text-lg">You're all caught up!</p>
              <p className="text-sm mt-1">No requests currently require your approval.</p>
            </div>
          ) : (
            approvalRequests.map(req => (
              <div key={req.id} className="bg-page border border-border rounded-xl p-5 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[req.status]}`}>
                        {req.status}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-accent bg-accent/10 px-2.5 py-1 rounded-md">
                        {req.moduleName}
                      </span>
                      <span className="text-[10px] font-bold text-muted border border-border px-2.5 py-1 rounded-md bg-page">
                        Stage {req.approvalStage}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-primary-text">{req.title}</h3>
                      <p className="text-sm text-muted mt-1 flex items-center gap-2">
                        <span>Requested by: <strong className="text-primary-text">{req.requestedByName || 'System'}</strong></span>
                        <span>•</span>
                        <span>Entity: <strong className="text-primary-text">{req.entityName || 'General'}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {new Date(req.createdAt).toLocaleDateString('en-IN')}</span>
                      </p>
                    </div>

                    {req.status !== 'Pending' && req.comments && (
                      <div className={`mt-3 p-3 rounded-lg text-sm border ${req.status === 'Approved' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <strong>Reviewer Note ({req.approverName}):</strong> "{req.comments}"
                      </div>
                    )}
                  </div>
                  
                  {/* Actions Column */}
                  <div className="flex flex-col items-end gap-2 md:w-48 shrink-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-4">
                    <div className="text-xs text-muted mb-2 text-right w-full">
                      Required Role:<br/>
                      <strong className="text-primary-text">{req.requiredRole}</strong>
                    </div>
                    
                    {req.status === 'Pending' && (
                      <div className="flex flex-col gap-2 w-full mt-auto">
                        <Button 
                          onClick={() => handleApprove(req)} 
                          variant="primary" 
                          className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-transparent"
                          disabled={processingId === req.id}
                        >
                          {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Approve
                        </Button>
                        <Button 
                          onClick={() => setShowRejectModal(req)} 
                          variant="outline" 
                          className="w-full justify-center text-red-600 border-red-200 hover:bg-red-50"
                          disabled={processingId === req.id}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                    
                    {req.status !== 'Pending' && (
                      <div className="mt-auto w-full text-right">
                        <p className="text-xs font-semibold text-muted">Processed on:</p>
                        <p className="text-sm font-bold text-primary-text">{new Date(req.updatedAt).toLocaleDateString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-fade-in-up">
            <div className="p-5 border-b border-border bg-red-50/50">
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Reject Request
              </h3>
            </div>
            <form onSubmit={handleReject} className="p-5 space-y-4">
              <p className="text-sm text-primary-text">
                You are rejecting: <strong className="block mt-1">{showRejectModal.title}</strong>
              </p>
              
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-muted">Reason for Rejection *</label>
                <textarea 
                  className="form-input w-full min-h-[100px]"
                  placeholder="Provide mandatory feedback to the requester..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowRejectModal(null); setRejectReason(''); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1 bg-red-600 hover:bg-red-700 text-white border-transparent" disabled={processingId === showRejectModal.id}>
                  {processingId === showRejectModal.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
