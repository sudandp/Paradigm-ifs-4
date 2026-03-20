import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  UserPlus, 
  Trash2, 
  ArrowLeft, 
  ChevronRight, 
  UserCheck,
  Shield,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import { isAdmin as checkIsAdmin } from '../../utils/auth';

const ReportingStructure: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManager, setSelectedManager] = useState<User | null>(null);
  
  // Modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isAdmin = checkIsAdmin(currentUser?.role) || currentUser?.role === 'developer';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allUsers = await api.getUsers();
      setUsers(allUsers);
    } catch (err) {
      setToast({ message: 'Failed to fetch users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter managers (Admins + Operation Managers)
  const potentialManagers = useMemo(() => {
    return users.filter(u => ['admin', 'operation_manager', 'hr'].includes(u.role))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Filter members reporting to selected manager
  const teamMembers = useMemo(() => {
    if (!selectedManager) return [];
    return users.filter(u => u.reportingManagerId === selectedManager.id);
  }, [users, selectedManager]);

  // Filter users available to be assigned (including those with no manager)
  const assignableUsers = useMemo(() => {
    if (!selectedManager) return [];
    return users.filter(u => 
      u.id !== selectedManager.id && 
      u.reportingManagerId !== selectedManager.id
    ).filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, selectedManager, searchQuery]);

  const handleAssign = async (userId: string) => {
    if (!selectedManager) return;
    setSubmitting(true);
    try {
      await api.updateUserReportingManager(userId, selectedManager.id);
      setToast({ message: 'User assigned successfully', type: 'success' });
      await fetchData();
      setIsAssignModalOpen(false);
    } catch (err) {
      setToast({ message: 'Assignment failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!targetUser) return;
    setSubmitting(true);
    try {
      await api.updateUserReportingManager(targetUser.id, null);
      setToast({ message: 'User removed from team', type: 'success' });
      await fetchData();
      setIsUnassignModalOpen(false);
    } catch (err) {
      setToast({ message: 'Removal failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-muted font-medium">Loading user directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/my-team')}
            className="p-2.5 rounded-xl hover:bg-card border border-transparent hover:border-border transition-all text-muted hover:text-primary-text"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary-text">Reporting Structure</h1>
            <p className="text-sm text-muted">Manage team assignments and manager hierarchy</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Manager Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-bold text-primary-text flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                Managers
              </h2>
            </div>
            <div className="overflow-y-auto max-h-[600px] divide-y divide-border">
              {potentialManagers.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedManager(m)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors duration-200 ${
                    selectedManager?.id === m.id ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <ProfilePlaceholder seed={m.id} className="w-10 h-10 rounded-full border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${selectedManager?.id === m.id ? 'text-emerald-600' : 'text-primary-text'}`}>
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                      {m.role.replace('_', ' ')}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedManager?.id === m.id ? 'translate-x-1 text-emerald-500' : 'text-muted'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Team Details */}
        <div className="lg:col-span-8 space-y-6">
          {selectedManager ? (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-6 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <ProfilePlaceholder seed={selectedManager.id} className="w-12 h-12 rounded-full ring-2 ring-emerald-500/20" />
                  <div>
                    <h3 className="text-xl font-bold text-primary-text">{selectedManager.name}'s Team</h3>
                    <p className="text-sm text-muted">{teamMembers.length} direct reports</p>
                  </div>
                </div>
                {isAdmin && (
                  <Button onClick={() => setIsAssignModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign Member
                  </Button>
                )}
              </div>

              <div className="flex-1 p-6">
                {teamMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.map(member => (
                      <div key={member.id} className="group p-4 rounded-xl border border-border hover:border-emerald-500/30 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-3">
                          <ProfilePlaceholder seed={member.id} className="w-10 h-10 rounded-full border border-border" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-primary-text truncate">{member.name}</p>
                            <p className="text-xs text-muted truncate">{member.email}</p>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setTargetUser(member);
                                setIsUnassignModalOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Remove from team"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-60">
                    <div className="bg-muted p-4 rounded-full mb-4">
                      <Users className="w-8 h-8 text-muted" />
                    </div>
                    <p className="text-lg font-bold">No reports found</p>
                    <p className="text-sm">Assigned members will appear here</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
              <Users className="w-12 h-12 text-muted mb-4" />
              <h3 className="text-xl font-bold text-primary-text mb-2">Select a Manager</h3>
              <p className="text-muted max-w-sm">
                Choose a manager from the list to view and manage their direct reporting structure.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assign Member Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Team Member"
        onConfirm={() => {}} // Not used in this specific search-based modal
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full !pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border border border-border rounded-xl">
            {assignableUsers.length > 0 ? (
              assignableUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ProfilePlaceholder seed={u.id} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-primary-text leading-none">{u.name}</p>
                      <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">{u.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(u.id)}
                    disabled={submitting}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <UserCheck className="w-5 h-5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-muted text-sm">No users found</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Unassign Modal */}
      <Modal
        isOpen={isUnassignModalOpen}
        onClose={() => setIsUnassignModalOpen(false)}
        title="Remove Member"
        onConfirm={handleUnassign}
        isConfirming={submitting}
      >
        <div className="flex gap-4 p-2 text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Are you sure you want to remove <strong>{targetUser?.name}</strong> from {selectedManager?.name}'s team?
          </p>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
};

export default ReportingStructure;
