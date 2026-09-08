import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { User, Location } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import { MapPin, Search, Check, Loader2, Navigation } from 'lucide-react';

interface BulkLocationAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onSuccess: () => void;
}

export const BulkLocationAssignmentModal: React.FC<BulkLocationAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onSuccess
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLocations();
      setSelectedLocationId('');
      setSearchTerm('');
    }
  }, [isOpen]);

  const loadLocations = async () => {
    setIsLoading(true);
    try {
      const allLocs = await api.getLocations();
      setLocations(allLocs || []);
      if (allLocs && allLocs.length > 0) {
        setSelectedLocationId(allLocs[0].id);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
      setToast({ message: 'Failed to load locations.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedLocationId) {
      setToast({ message: 'Please select a location to assign.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(u => api.assignLocationToUser(u.id, selectedLocationId))
      );
      const successfulCount = results.filter(r => r.status === 'fulfilled').length;
      const targetLoc = locations.find(l => l.id === selectedLocationId);

      setToast({ 
        message: `Assigned "${targetLoc?.name || 'Location'}" to ${successfulCount} of ${selectedUsers.length} users.`, 
        type: 'success' 
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (error: any) {
      console.error('Failed to bulk assign locations:', error);
      setToast({ message: error.message || 'Failed to assign location.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLocations = locations.filter(loc =>
    !searchTerm ||
    loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Assign Location (${selectedUsers.length} Users)`}
        onConfirm={handleAssign}
        isConfirming={isSaving}
        confirmButtonText={isSaving ? "Assigning..." : `Assign to ${selectedUsers.length} Users`}
        confirmButtonVariant="primary"
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-slate-500">
            Select a geofenced location to assign to all <strong>{selectedUsers.length}</strong> selected employees. This allows them to mark attendance and punch in at this site.
          </p>

          {/* User count badge */}
          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
            <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Targeting <strong>{selectedUsers.length}</strong> selected employees</span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search location or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Location picker */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                Loading locations...
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No locations match your search.
              </div>
            ) : (
              filteredLocations.map(loc => {
                const isSelected = selectedLocationId === loc.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs'
                        : 'hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        {loc.name}
                      </div>
                      {loc.address && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {loc.address}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Radius: {loc.radius || 100}m
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BulkLocationAssignmentModal;
