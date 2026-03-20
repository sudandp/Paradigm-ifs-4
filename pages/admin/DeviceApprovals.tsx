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
          <div className="grid grid-cols-1 gap-4">
            {requests
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((request) => (
              <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
                
                {/* User Info */}
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {request.userName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{request.userName || 'Unknown User'}</h4>
                    <p className="text-xs text-gray-500">Requested {formatDate(request.requestedAt)}</p>
                  </div>
                </div>

                {/* Device Info */}
                <div className="flex-1 flex items-start gap-4 p-3 bg-gray-50 rounded-lg w-full md:w-auto">
                  <div className="mt-1">
                    {request.deviceType === 'web' ? <Monitor className="w-5 h-5 text-blue-500" /> : <Smartphone className="w-5 h-5 text-green-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{request.deviceName}</p>
                    <p className="text-xs text-gray-500 break-all">
                      {request.deviceType.toUpperCase()} • {request.deviceInfo?.browser || request.deviceInfo?.platform}
                    </p>
                    {request.currentDeviceCount !== undefined && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center">
                         <AlertCircle className="w-3 h-3 mr-1" />
                         User has {request.currentDeviceCount} active {request.deviceType} device(s)
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Button 
                    onClick={() => handleRejectInit(request.id, request.deviceName)}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex-1 md:flex-none"
                    disabled={!!processingId}
                  >
                    <X className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button 
                    onClick={() => handleApproveInit(request.id, request.deviceName)}
                    className="bg-primary hover:bg-primary-dark text-white flex-1 md:flex-none"
                    isLoading={processingId === request.id}
                    disabled={!!processingId}
                  >
                    <Check className="w-4 h-4 mr-2" /> Approve
                  </Button>
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
      {approveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Approve Device</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to approve the device <strong>{approveDialog.name}</strong>? The user will be able to access the system from this device.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setApproveDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <Button 
                onClick={handleApproveConfirm}
                className="bg-primary hover:bg-primary-dark text-white border-none"
                isLoading={processingId === approveDialog.id}
              >
                <Check className="w-4 h-4 mr-2" /> Approve Device
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Device Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for rejecting access to <strong>{rejectDialog.name}</strong>.
            </p>
            
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              placeholder="e.g., Use company provided laptop instead..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              autoFocus
            />
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setRejectDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <Button 
                onClick={handleRejectConfirm}
                className="bg-red-600 hover:bg-red-700 text-white border-none"
                isLoading={processingId === rejectDialog.id}
              >
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceApprovals;
