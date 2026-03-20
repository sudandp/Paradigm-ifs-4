import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Location } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { X, Plus } from 'lucide-react';
import Toast from '../ui/Toast';

interface LocationAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    onSuccess?: () => void;
}

const LocationAssignmentModal: React.FC<LocationAssignmentModalProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    onSuccess
}) => {
    const [userLocations, setUserLocations] = useState<Location[]>([]);
    const [allLocations, setAllLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isOpen && userId) {
            loadLocations();
        }
    }, [isOpen, userId]);

    const loadLocations = async () => {
        setLoading(true);
        try {
            const [userLocs, allLocs] = await Promise.all([
                api.getUserLocations(userId),
                api.getLocations()
            ]);
            setUserLocations(userLocs);
            setAllLocations(allLocs);
        } catch (error) {
            console.error('Failed to load locations:', error);
            setToast({ message: 'Failed to load locations.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignLocation = async (locationId: string) => {
        setIsSaving(true);
        try {
            await api.assignLocationToUser(userId, locationId);
            const updatedUserLocs = await api.getUserLocations(userId);
            setUserLocations(updatedUserLocs);
            setToast({ message: 'Location assigned successfully!', type: 'success' });
            onSuccess?.();
        } catch (error: any) {
            console.error('Failed to assign location:', error);
            setToast({ message: error.message || 'Failed to assign location.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnassignLocation = async (locationId: string) => {
        setIsSaving(true);
        try {
            await api.unassignLocationFromUser(userId, locationId);
            const updatedUserLocs = await api.getUserLocations(userId);
            setUserLocations(updatedUserLocs);
            setToast({ message: 'Location unassigned successfully!', type: 'success' });
            onSuccess?.();
        } catch (error: any) {
            console.error('Failed to unassign location:', error);
            setToast({ message: error.message || 'Failed to unassign location.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const isLocationAssigned = (locationId: string) => {
        return userLocations.some(loc => loc.id === locationId);
    };

    const filteredAvailableLocations = allLocations.filter(loc => !isLocationAssigned(loc.id)).filter(loc =>
        searchTerm === '' ||
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <Modal isOpen={isOpen} onClose={onClose} title={`Manage Locations for ${userName}`} hideFooter={true}>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-primary-text mb-3">Assigned Locations ({userLocations.length})</h3>
                        {loading ? <p className="text-sm text-muted">Loading...</p> : userLocations.length === 0 ? (
                            <p className="text-sm text-muted bg-gray-50 p-3 rounded-lg">No locations assigned yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {userLocations.map((loc) => (
                                    <div key={loc.id} className="flex items-start justify-between bg-accent/10 border border-accent/30 rounded-lg p-3">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-sm text-primary-text">{loc.name || 'Unnamed'}</h4>
                                            <p className="text-xs text-muted mt-1">{loc.address || 'No address'}</p>
                                        </div>
                                        <button type="button" onClick={() => handleUnassignLocation(loc.id)} disabled={isSaving} className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1" title="Remove">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-primary-text mb-3">Available Locations ({filteredAvailableLocations.length})</h3>
                        <Input type="text" placeholder="Search locations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-3" />
                        {loading ? <p className="text-sm text-muted">Loading...</p> : filteredAvailableLocations.length === 0 ? (
                            <p className="text-sm text-muted bg-gray-50 p-3 rounded-lg">{searchTerm ? 'No locations found.' : 'All assigned.'}</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {filteredAvailableLocations.map((loc) => (
                                    <div key={loc.id} className="flex items-start justify-between border border-border rounded-lg p-3 hover:bg-gray-50">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-sm text-primary-text">{loc.name || 'Unnamed'}</h4>
                                            <p className="text-xs text-muted mt-1">{loc.address || 'No address'}</p>
                                            <p className="text-xs text-muted mt-1">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} • Radius: {loc.radius}m</p>
                                        </div>
                                        <button type="button" onClick={() => handleAssignLocation(loc.id)} disabled={isSaving} className="text-accent hover:text-accent-dark disabled:opacity-50 p-1" title="Assign">
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 border-t border-border">
                        <Button onClick={onClose} variant="secondary">Done</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default LocationAssignmentModal;
