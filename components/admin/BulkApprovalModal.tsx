import React, { useEffect, useState } from 'react';
import type { User, Role } from '../../types';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Modal from '../ui/Modal';
import Toast from '../ui/Toast';
import { UserCheck, Users, ShieldCheck, AlertCircle } from 'lucide-react';

interface BulkApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onSuccess: () => void;
}

export const BulkApprovalModal: React.FC<BulkApprovalModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onSuccess
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.getRoles().then(fetchedRoles => {
        const assignableRoles = (fetchedRoles || []).filter(
          r => r.id !== 'unverified' && r.id !== 'admin' && r.id !== 'gate_only'
        );
        setRoles(assignableRoles);
        if (assignableRoles.length > 0) {
          // Default to field_staff or the first role
          const defaultRole = assignableRoles.find(r => r.id === 'field_staff') || assignableRoles[0];
          setSelectedRole(defaultRole.id);
        }
        setIsLoading(false);
      }).catch(err => {
        console.error('Failed to load roles:', err);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const pendingCount = selectedUsers.filter(u => u.role === 'unverified' || u.role === 'gate_only').length;

  const handleConfirm = async () => {
    if (!selectedRole) {
      setToast({ message: 'Please select a role to assign.', type: 'error' });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (const user of selectedUsers) {
      try {
        await api.approveUser(user.id, selectedRole);

        // Auto-populate joining date and leave opening dates if empty
        if (!user.joiningDate) {
          await api.updateUser(user.id, {
            joiningDate: todayStr,
            earnedLeaveOpeningDate: user.earnedLeaveOpeningDate || todayStr,
            sickLeaveOpeningDate: user.sickLeaveOpeningDate || todayStr,
            compOffOpeningDate: user.compOffOpeningDate || todayStr,
            floatingLeaveOpeningDate: user.floatingLeaveOpeningDate || todayStr,
            childCareLeaveOpeningDate: user.childCareLeaveOpeningDate || todayStr,
          }).catch(() => {});
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to approve user ${user.name}:`, err);
      }
    }

    setToast({
      message: `Approved ${successCount} of ${selectedUsers.length} users successfully!`,
      type: 'success'
    });

    setTimeout(() => {
      setIsSaving(false);
      onSuccess();
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        title={`Approve Users (${selectedUsers.length})`}
        confirmButtonText={isSaving ? "Approving..." : `Approve ${selectedUsers.length} Users`}
        confirmButtonVariant="primary"
        isConfirming={isSaving}
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-slate-600">
            You are approving <strong>{selectedUsers.length}</strong> selected accounts. Please select the operational role to assign to these employees upon approval.
          </p>

          {/* Pending breakdown banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Pending Approval: <strong>{pendingCount}</strong> users</span>
            </div>
            {selectedUsers.length - pendingCount > 0 && (
              <span className="text-[11px] text-emerald-700/80">
                +{selectedUsers.length - pendingCount} already active (role will update)
              </span>
            )}
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Role upon Approval <span className="text-red-500">*</span>
            </label>
            {isLoading ? (
              <div className="py-3 text-xs text-slate-400">Loading roles...</div>
            ) : (
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.displayName || r.id}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Users preview list */}
          <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50 divide-y divide-slate-100 text-xs">
            {selectedUsers.map(u => (
              <div key={u.id} className="py-1 px-1.5 flex items-center justify-between">
                <span className="font-semibold text-slate-800 truncate">{u.name}</span>
                <span className="text-[11px] text-slate-400 font-mono truncate">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BulkApprovalModal;
