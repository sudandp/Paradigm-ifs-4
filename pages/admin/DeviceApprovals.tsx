import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Smartphone, 
  Monitor, 
  Clock, 
  Search,
  AlertCircle
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Modal from '../../components/ui/Modal';
import { 
  getPendingDeviceRequests, 
  approveDeviceRequest, 
  rejectDeviceRequest 
} from '../../services/deviceService';
import { DeviceChangeRequest } from '../../types';
import { formatDate } from '../../utils/date';

import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';


const DeviceApprovals: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState<{ id: string, name: string } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string, name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getPendingDeviceRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      setToast({ message: 'Failed to load pending requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveInit = (id: string, name: string) => {
    setApproveDialog({ id, name });
  };

  const handleApproveConfirm = async () => {
    if (!approveDialog) return;
    if (!user) return;

    try {
      setProcessingId(approveDialog.id);
      await approveDeviceRequest(approveDialog.id, user.id); 
      
      setToast({ message: 'Device approved successfully', type: 'success' });
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== approveDialog.id));
      setApproveDialog(null);
    } catch (error) {
      console.error('Error approving device:', error);
      setToast({ message: 'Failed to approve device', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectInit = (id: string, name: string) => {
    setRejectDialog({ id, name });
    setRejectionReason('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog) return;
    if (!user) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessingId(rejectDialog.id);
      await rejectDeviceRequest(rejectDialog.id, user.id, rejectionReason);
      setToast({ message: 'Device rejected successfully', type: 'success' });
      setRequests(prev => prev.filter(r => r.id !== rejectDialog.id));
      setRejectDialog(null);
    } catch (error) {
      console.error('Error rejecting device:', error);
      setToast({ message: 'Failed to reject device', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
      return <LoadingScreen message="Loading page data..." />;
  }

  return (
    <div className="p-4 md:p-8 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <AdminPageHeader title="Device Approvals" />
      <p className="text-muted -mt-4 mb-8">Review and manage requests for additional device access.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-24 text-center mt-4">
          <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-[#22c55e]" strokeWidth={3} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-500 text-lg">There are no pending device requests requiring approval.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6">
            {requests
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((request) => (
              <div 
                key={request.id} 
                className="group bg-white rounded-2xl border border-gray-100 p-1 flex flex-col transition-all duration-300 hover:shadow-card hover:border-accent/20"
              >
                <div className="p-5 flex flex-col lg:flex-row items-center justify-between gap-6">
                  
                  {/* User Section */}
                  <div className="flex items-center gap-4 min-w-[240px]">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-accent/5 flex items-center justify-center text-accent font-bold text-xl border border-accent/10 shadow-sm transition-transform group-hover:scale-105">
                        {request.userName?.charAt(0) || 'U'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100">
                        {request.deviceType === 'web' ? <Monitor className="w-3 h-3 text-blue-500" /> : <Smartphone className="w-3 h-3 text-green-500" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg leading-tight mb-1">{request.userName || 'Unknown User'}</h4>
                      <div className="flex items-center text-xs text-muted font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-accent/60" />
                        Requested {formatDate(request.requestedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Device Detail Section */}
                  <div className="flex-1 w-full lg:w-auto bg-page/50 border border-gray-100/50 rounded-2xl p-4 flex items-center gap-5 transition-colors group-hover:bg-page">
                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-white border border-gray-100 items-center justify-center text-muted group-hover:text-accent transition-colors shadow-sm">
                      {request.deviceType === 'web' ? <Monitor className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-800 truncate text-base">{request.deviceName}</p>
                        <span className="text-[10px] font-bold text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 uppercase tracking-wider">
                          {request.deviceType}
                        </span>
                      </div>
                      <p className="text-xs text-muted font-medium truncate opacity-80">
                        {request.deviceInfo?.browser || 'Unknown Browser'} • {request.deviceInfo?.os || request.deviceInfo?.platform || 'Unknown OS'}
                      </p>
                      {request.currentDeviceCount !== undefined && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-700 shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{request.currentDeviceCount} Existing Sessions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="flex items-center gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100/80">
                    <button 
                      onClick={() => { if (!processingId) handleRejectInit(request.id, request.deviceName) }}
                      disabled={!!processingId}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button 
                      onClick={() => { if (!processingId) handleApproveInit(request.id, request.deviceName) }}
                      disabled={!!processingId}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm text-white bg-accent hover:bg-accent-dark border border-accent-dark/10 transition-all shadow-md shadow-accent/10 hover:shadow-lg hover:shadow-accent/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      )}
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={requests.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[12, 24, 48, 96]}
          />
        </div>
      )}

      {/* Approval Confirmation Modal */}
      <Modal
        isOpen={!!approveDialog}
        onClose={() => setApproveDialog(null)}
        onConfirm={handleApproveConfirm}
        title="Approve Device Request"
        confirmButtonText="Approve Device"
        confirmButtonVariant="primary"
        isLoading={processingId === approveDialog?.id}
      >
        {approveDialog && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-accent/5 rounded-xl border border-accent/10">
              <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-accent shadow-sm">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Authorizing Device</p>
                <p className="font-bold text-gray-900">{approveDialog.name}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Are you sure you want to approve this device? The user will be granted immediate access to the system from this terminal.
            </p>
          </div>
        )}
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={!!rejectDialog}
        onClose={() => setRejectDialog(null)}
        onConfirm={handleRejectConfirm}
        title="Reject Device Request"
        confirmButtonText="Reject Request"
        confirmButtonVariant="danger"
        isLoading={processingId === rejectDialog?.id}
      >
        {rejectDialog && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted mb-4 font-medium">
                Please provide a reason for rejecting access to <span className="text-gray-900 font-bold">{rejectDialog.name}</span>.
              </p>
              
              <textarea
                className="w-full border border-gray-200 rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none text-sm transition-all bg-page/30"
                placeholder="e.g., Please use your company-provided laptop for system access..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-[11px] text-red-700 font-medium">
                Rejecting this request will notify the user. They will need to submit a new request if they wish to try again.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeviceApprovals;
