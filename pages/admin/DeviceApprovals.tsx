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
                <div 
                  className="flex flex-row items-center justify-between gap-3 w-full mt-4 border-t border-gray-100 pt-4"
                  style={{ display: 'flex', flexDirection: 'row', width: '100%', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}
                >
                  <div 
                    role="button"
                    onClick={() => { if (!processingId) handleRejectInit(request.id, request.deviceName) }}
                    className={`flex items-center justify-center rounded-lg font-bold text-sm cursor-pointer transition-colors ${processingId ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ flex: 1, padding: '12px 16px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                  >
                    <X className="w-4 h-4 mr-1.5" /> Reject
                  </div>
                  <div 
                    role="button"
                    onClick={() => { if (!processingId) handleApproveInit(request.id, request.deviceName) }}
                    className={`flex items-center justify-center rounded-lg font-bold text-sm cursor-pointer transition-colors shadow-sm ${processingId ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ flex: 1, padding: '12px 16px', backgroundColor: '#22c55e', color: '#ffffff', border: '1px solid #16a34a' }}
                  >
                    {processingId === request.id ? (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: 'white' }}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <Check className="w-4 h-4 mr-1.5" />
                    )}
                    Approve
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
            
            <div className="flex justify-between w-full gap-3 mt-6" style={{ display: 'flex', width: '100%', gap: '12px', marginTop: '24px' }}>
              <div 
                role="button"
                onClick={() => setApproveDialog(null)}
                className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors border border-red-200"
                style={{ flex: 1, padding: '12px 16px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}
              >
                Cancel
              </div>
              <div 
                role="button"
                onClick={() => { if (!processingId) handleApproveConfirm() }}
                className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer transition-colors shadow-sm ${processingId ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ flex: 1, padding: '12px 16px', backgroundColor: '#16a34a', color: 'white', borderRadius: '8px' }}
              >
                {processingId === approveDialog.id ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: 'white' }}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Approve Device
              </div>
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
              className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-sm"
              placeholder="e.g., Use company provided laptop instead..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              autoFocus
            />
            
            <div className="flex justify-between w-full gap-3 mt-6" style={{ display: 'flex', width: '100%', gap: '12px', marginTop: '24px' }}>
              <div 
                role="button"
                onClick={() => setRejectDialog(null)}
                className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors border border-red-200"
                style={{ flex: 1, padding: '12px 16px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}
              >
                Cancel
              </div>
              <div 
                role="button"
                onClick={() => { if (!processingId) handleRejectConfirm() }}
                className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer transition-colors shadow-sm ${processingId ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ flex: 1, padding: '12px 16px', backgroundColor: '#dc2626', color: 'white', borderRadius: '8px' }}
              >
                {processingId === rejectDialog.id ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: 'white' }}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : null}
                Reject Request
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceApprovals;
