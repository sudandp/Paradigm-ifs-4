import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Users, ShieldCheck, Plus, Trash2, Save, Sparkles, HelpCircle } from 'lucide-react';
import { api } from '../../services/api';
import Toast from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useSettingsStore } from '../../store/settingsStore';
import type { User, VoipMapping } from '../../types';

export const VoipSettings: React.FC = () => {
  const store = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'hr' | 'bd'>('hr');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const defaultHrNumber = (import.meta.env as any).VITE_EXOTEL_HR_NUMBER || '+918147612263';
  const defaultExophone = (import.meta.env as any).VITE_EXOTEL_EXOPHONE || '09513886363';

  // Local state copy of mappings for scratchpad editing before saving
  const [localHrMappings, setLocalHrMappings] = useState<VoipMapping[]>([]);
  const [localBdMappings, setLocalBdMappings] = useState<VoipMapping[]>([]);

  // Add form fields
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [inputExophone, setInputExophone] = useState('');
  const [showAllRoles, setShowAllRoles] = useState(false);

  // Synchronize store settings to local state on initial load
  useEffect(() => {
    setLocalHrMappings(store.voipSettings?.hrMappings || []);
    setLocalBdMappings(store.voipSettings?.bdMappings || []);
  }, [store.voipSettings]);

  // Fetch users for the dropdown mapping selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const data = await api.getUsers();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users for VoIP mapping:', err);
        setToast({ message: 'Failed to load user list.', type: 'error' });
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Map users to options for the SearchableSelect dropdown
  const userOptions = useMemo(() => {
    // Filter users based on tab to make selection clean, or show all if checkbox is checked
    const filtered = users.filter(u => {
      if (showAllRoles) return true;
      const roleId = (u.roleId || u.role || '').toLowerCase();
      
      if (activeTab === 'hr') {
        // HR staff / Admins
        return ['hr', 'hr_ops', 'admin', 'super_admin', 'management', 'developer'].includes(roleId);
      } else {
        // BD staff / Sales
        return ['bd', 'business_developer', 'business developer', 'sales'].includes(roleId);
      }
    });

    // Sort by name
    return filtered
      .map(u => ({
        id: u.id,
        name: `${u.name} (${u.email} - ${u.role ? u.role.replace(/_/g, ' ').toUpperCase() : 'NO ROLE'})`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, activeTab, showAllRoles]);

  // Find user details (name/email) for mapped entries
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Handle adding a new mapping
  const handleAddMapping = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      setToast({ message: 'Please select a user.', type: 'error' });
      return;
    }

    if (!inputPhone || !/^\+?[1-9]\d{1,14}$/.test(inputPhone.trim())) {
      setToast({ message: 'Please enter a valid phone number (e.g., +918147612263).', type: 'error' });
      return;
    }

    if (!inputExophone || !/^\d{5,15}$/.test(inputExophone.trim())) {
      setToast({ message: 'Please enter a valid caller ID / exophone.', type: 'error' });
      return;
    }

    const currentMappings = activeTab === 'hr' ? localHrMappings : localBdMappings;
    const existingIndex = currentMappings.findIndex(m => m.userId === selectedUserId);

    const newMapping: VoipMapping = {
      userId: selectedUserId,
      phone: inputPhone.trim(),
      exophone: inputExophone.trim(),
    };

    if (existingIndex >= 0) {
      if (activeTab === 'hr') {
        const updated = [...localHrMappings];
        updated[existingIndex] = newMapping;
        setLocalHrMappings(updated);
      } else {
        const updated = [...localBdMappings];
        updated[existingIndex] = newMapping;
        setLocalBdMappings(updated);
      }
      setToast({ message: 'Mapping updated in scratchpad. Remember to save changes!', type: 'success' });
    } else {
      if (activeTab === 'hr') {
        setLocalHrMappings([...localHrMappings, newMapping]);
      } else {
        setLocalBdMappings([...localBdMappings, newMapping]);
      }
      setToast({ message: 'Mapping added to scratchpad. Remember to save changes!', type: 'success' });
    }

    // Reset inputs
    setSelectedUserId('');
    setInputPhone('');
    setInputExophone('');
  };

  // Handle deleting a mapping
  const handleDeleteMapping = (userId: string) => {
    if (activeTab === 'hr') {
      setLocalHrMappings(localHrMappings.filter(m => m.userId !== userId));
    } else {
      setLocalBdMappings(localBdMappings.filter(m => m.userId !== userId));
    }
  };

  // Save changes to local store and cloud Supabase database
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setToast(null);

    const updatedSettings = {
      hrMappings: localHrMappings,
      bdMappings: localBdMappings,
    };

    try {
      // Call service to updatesettings
      await api.saveVoipSettings(updatedSettings);
      
      // Update state in local zustand store
      store.updateVoipSettings(updatedSettings);

      setToast({ message: 'VoIP configurations saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to save VoIP settings:', err);
      setToast({ message: 'Failed to save settings. Make sure migration is applied.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-0">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary-text flex items-center gap-2">
            <Phone className="h-7 w-7 text-accent" />
            VoIP Configurations
          </h2>
          <p className="text-sm text-muted mt-1">
            Map specific HR and BD users to custom calling numbers and Exotel exophones (Caller IDs).
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSaveChanges}
            isLoading={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => {
              setActiveTab('hr');
              setSelectedUserId('');
            }}
            className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'hr'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary-text hover:border-gray-300'
            }`}
          >
            <ShieldCheck className="h-5 w-5" />
            HR Config
          </button>
          <button
            onClick={() => {
              setActiveTab('bd');
              setSelectedUserId('');
            }}
            className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'bd'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary-text hover:border-gray-300'
            }`}
          >
            <Users className="h-5 w-5" />
            BD Config
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Mappings Table */}
        <div className="lg:col-span-2 border border-border bg-card p-6 rounded-xl shadow-card space-y-4 min-h-[400px]">
          <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
            {activeTab === 'hr' ? <ShieldCheck className="h-5 w-5 text-accent" /> : <Users className="h-5 w-5 text-accent" />}
            Active {activeTab === 'hr' ? 'HR / Admin' : 'BD / Sales'} Mappings
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Call From Number</th>
                  <th className="py-3 px-4">Caller ID (Exophone)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {((activeTab === 'hr' ? localHrMappings : localBdMappings) || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted italic">
                      No mapped calling numbers configured. Calls will fall back to default credentials.
                      <div className="mt-3 flex justify-center">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 flex flex-col items-center gap-1">
                          <span className="font-bold text-gray-900 text-xs uppercase tracking-widest">Fallback Config</span>
                          <span>Call From: <span className="font-mono text-emerald-600 font-bold">{defaultHrNumber}</span></span>
                          <span>Caller ID: <span className="font-mono text-emerald-600 font-bold">{defaultExophone}</span></span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'hr' ? localHrMappings : localBdMappings).map((mapping) => {
                    const userDetail = userMap.get(mapping.userId);
                    return (
                      <tr key={mapping.userId} className="hover:bg-accent/5 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-primary-text">
                            {userDetail?.name || 'Loading / Unknown User'}
                          </div>
                          <div className="text-xs text-muted">
                            {userDetail?.email || 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-primary-text">
                          {mapping.phone}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-primary-text">
                          {mapping.exophone}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteMapping(mapping.userId)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Remove mapping"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Update Mapping Form */}
        <div className="border border-border bg-card p-6 rounded-xl shadow-card space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
              <Plus className="h-5 w-5 text-accent" />
              {(activeTab === 'hr' ? localHrMappings : localBdMappings).some(m => m.userId === selectedUserId) ? 'Update Calling Number' : 'Add Calling Number'}
            </h3>
            <p className="text-xs text-muted">
              Select an employee and configure their specific dialing credentials.
            </p>
          </div>

          <form onSubmit={handleAddMapping} className="space-y-4">
            <div className="space-y-4">
              <SearchableSelect
                label="Select User"
                placeholder={isLoadingUsers ? "Loading staff..." : "Search user..."}
                options={userOptions}
                value={selectedUserId}
                onChange={(value) => {
                  setSelectedUserId(value);
                  const currentMappings = activeTab === 'hr' ? localHrMappings : localBdMappings;
                  const existingMapping = currentMappings.find(m => m.userId === value);
                  if (existingMapping) {
                    setInputPhone(existingMapping.phone);
                    setInputExophone(existingMapping.exophone);
                  } else {
                    setInputPhone('');
                    setInputExophone('');
                  }
                }}
                isLoading={isLoadingUsers}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-all-roles"
                  className="rounded border-border text-accent focus:ring-accent"
                  checked={showAllRoles}
                  onChange={(e) => setShowAllRoles(e.target.checked)}
                />
                <label htmlFor="show-all-roles" className="text-xs text-muted font-medium cursor-pointer">
                  Show users from all roles
                </label>
              </div>

              <Input
                label="Caller / From Number"
                placeholder="+918147612263"
                description="The mobile number of the calling employee (with country code)."
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                requiredIndicator
                autoCapitalizeCustom={false}
              />

              <Input
                label="Exophone / Caller ID"
                placeholder="09513886363"
                description="The virtual Exotel caller ID assigned to the employee."
                value={inputExophone}
                onChange={(e) => setInputExophone(e.target.value)}
                requiredIndicator
                autoCapitalizeCustom={false}
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-accent text-accent hover:bg-accent/5 font-semibold"
            >
              <Plus className="h-4 w-4" />
              {(activeTab === 'hr' ? localHrMappings : localBdMappings).some(m => m.userId === selectedUserId) ? 'Update Mapping' : 'Add Mapping'}
            </Button>
          </form>

          {/* Quick Guide */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              VOIP Configuration Tip
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              Mapped users must have their numbers verified and registered on Exotel. When they click to initiate a call, the system connects via their mapped number. Other users will automatically fallback to the general environment variables config.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoipSettings;
