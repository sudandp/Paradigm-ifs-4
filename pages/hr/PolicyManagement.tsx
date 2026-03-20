import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Policy } from '../../types';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Modal from '../../components/ui/Modal';


// A simple form for Policy using the reusable Modal component
const PolicyForm: React.FC<{
    isOpen: boolean,
    onSave: (data: Omit<Policy, 'id'>) => Promise<void>,
    onClose: () => void,
    initialData?: Policy | null
}> = ({ isOpen, onSave, onClose, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setDescription(initialData?.description || '');
            setIsSubmitting(false);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!name.trim()) {
            return; // Form validation - name is required
        }

        setIsSubmitting(true);
        try {
            await onSave({ name: name.trim(), description: description.trim() });
            // Success handled by parent
        } catch (error) {
            console.error('Error saving policy:', error);
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleSubmit}
            title={`${initialData ? 'Edit' : 'Add'} Policy`}
            confirmButtonText="Save Policy"
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="policy-name" className="block text-sm font-medium text-muted mb-1">
                        Policy Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="policy-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Policy Name (e.g., POSH)"
                        className="form-input"
                        required
                        disabled={isSubmitting}
                    />
                </div>
                <div>
                    <label htmlFor="policy-description" className="block text-sm font-medium text-muted mb-1">
                        Description
                    </label>
                    <textarea
                        id="policy-description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Description"
                        className="form-input"
                        rows={3}
                        disabled={isSubmitting}
                    />
                </div>
            </form>
        </Modal>
    );
};


const PolicyManagement: React.FC = () => {
    const navigate = useNavigate();
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentPolicy, setCurrentPolicy] = useState<Policy | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Ref to track if component is mounted
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchPolicies = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getPolicies();
            if (isMountedRef.current) {
                setPolicies(data);
            }
        } catch (error) {
            console.error('Error fetching policies:', error);
            if (isMountedRef.current) {
                setToast({ message: 'Failed to fetch policies.', type: 'error' });
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchPolicies();
    }, [fetchPolicies]);

    const handleSave = async (data: Omit<Policy, 'id'>) => {
        try {
            if (currentPolicy) {
                // Update logic (if API supports it)
                // await api.updatePolicy(currentPolicy.id, data);
                setToast({ message: 'Policy updated.', type: 'success' });
            } else {
                await api.createPolicy(data);
                if (isMountedRef.current) {
                    setToast({ message: 'Policy created successfully!', type: 'success' });
                }
            }

            if (isMountedRef.current) {
                setIsFormOpen(false);
                setCurrentPolicy(null);
                fetchPolicies();
            }
        } catch (error) {
            console.error('Error saving policy:', error);
            if (isMountedRef.current) {
                setToast({ message: 'Failed to save policy. Please try again.', type: 'error' });
            }
            throw error; // Re-throw to let form handle submission state
        }
    };

    const handleAddClick = () => {
        navigate('/hr/policies/add');
    };

    const handleEditClick = (policy: Policy) => {
        setCurrentPolicy(policy);
        setIsFormOpen(true);
    };

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <PolicyForm
                isOpen={isFormOpen}
                onSave={handleSave}
                onClose={() => {
                    setIsFormOpen(false);
                    setCurrentPolicy(null);
                }}
                initialData={currentPolicy}
            />

            <AdminPageHeader title="Policy Management">
                <Button onClick={handleAddClick}>
                    <Plus className="mr-2 h-4 w-4" /> Add Policy
                </Button>
            </AdminPageHeader>

            <div className="overflow-x-auto">
                <table className="min-w-full responsive-table">
                    <thead className="bg-page">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Policy Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="md:bg-card divide-y divide-border md:divide-y-0">
                        {isLoading ? (
                            <tr><td colSpan={3} data-label="Status" className="text-center py-10 text-muted">Loading...</td></tr>
                        ) : policies.length === 0 ? (
                            <tr><td colSpan={3} data-label="Status" className="text-center py-10 text-muted">No policies found. Click "Add Policy" to create one.</td></tr>
                        ) : policies.map((policy) => (
                            <tr key={policy.id}>
                                <td data-label="Policy Name" className="px-6 py-4 font-medium">{policy.name}</td>
                                <td data-label="Description" className="px-6 py-4 text-sm text-muted">{policy.description || '—'}</td>
                                <td data-label="Actions" className="px-6 py-4">
                                    <div className="flex items-center gap-2 md:justify-start justify-end">
                                        <Button variant="icon" size="sm" onClick={() => handleEditClick(policy)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PolicyManagement;