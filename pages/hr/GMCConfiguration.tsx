import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { Edit, Trash2, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';


interface GMCRate {
    id: number;
    minAge: number;
    maxAge: number;
    rate: number;
}

const GMCRateForm: React.FC<{
    isOpen: boolean,
    onSave: (data: Omit<GMCRate, 'id'>) => Promise<void>,
    onClose: () => void,
    initialData?: GMCRate | null
}> = ({ isOpen, onSave, onClose, initialData }) => {
    const [minAge, setMinAge] = useState(initialData?.minAge?.toString() || '');
    const [maxAge, setMaxAge] = useState(initialData?.maxAge?.toString() || '');
    const [rate, setRate] = useState(initialData?.rate?.toString() || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMinAge(initialData?.minAge?.toString() || '');
            setMaxAge(initialData?.maxAge?.toString() || '');
            setRate(initialData?.rate?.toString() || '');
            setIsSubmitting(false);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!minAge || !maxAge || !rate) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave({
                minAge: parseInt(minAge),
                maxAge: parseInt(maxAge),
                rate: parseFloat(rate)
            });
        } catch (error) {
            console.error('Error saving rate:', error);
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleSubmit}
            title={`${initialData ? 'Edit' : 'Add'} GMC Rate`}
            confirmButtonText="Save Rate"
            isLoading={isSubmitting}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Min Age"
                        type="number"
                        value={minAge}
                        onChange={e => setMinAge(e.target.value)}
                        required
                        disabled={isSubmitting}
                    />
                    <Input
                        label="Max Age"
                        type="number"
                        value={maxAge}
                        onChange={e => setMaxAge(e.target.value)}
                        required
                        disabled={isSubmitting}
                    />
                </div>
                <Input
                    label="Monthly Premium (₹)"
                    type="number"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    required
                    disabled={isSubmitting}
                />
            </form>
        </Modal>
    );
};

const GMCConfiguration: React.FC = () => {
    const [rates, setRates] = useState<GMCRate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentRate, setCurrentRate] = useState<GMCRate | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const fetchRates = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getGMCRates();
            if (isMountedRef.current) setRates(data);
        } catch (error) {
            console.error('Error fetching rates:', error);
            if (isMountedRef.current) setToast({ message: 'Failed to fetch rates.', type: 'error' });
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    const handleSave = async (data: Omit<GMCRate, 'id'>) => {
        try {
            if (currentRate) {
                await api.updateGMCRate(currentRate.id, data);
                setToast({ message: 'Rate updated successfully.', type: 'success' });
            } else {
                await api.addGMCRate(data);
                setToast({ message: 'New rate slab added.', type: 'success' });
            }

            if (isMountedRef.current) {
                setIsFormOpen(false);
                setCurrentRate(null);
                fetchRates();
            }
        } catch (error) {
            setToast({ message: 'Failed to save rate.', type: 'error' });
            throw error;
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this rate slab?')) return;
        try {
            await api.deleteGMCRate(id);
            setToast({ message: 'Rate deleted.', type: 'success' });
            fetchRates();
        } catch (error) {
            console.error('Error deleting rate:', error);
            setToast({ message: 'Failed to delete rate.', type: 'error' });
        }
    };

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <GMCRateForm
                isOpen={isFormOpen}
                onSave={handleSave}
                onClose={() => {
                    setIsFormOpen(false);
                    setCurrentRate(null);
                }}
                initialData={currentRate}
            />

            <AdminPageHeader title="GMC Premium Configuration">
                <Button onClick={() => { setCurrentRate(null); setIsFormOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add New Slab
                </Button>
            </AdminPageHeader>

            <div className="overflow-x-auto">
                <table className="min-w-full responsive-table">
                    <thead className="bg-page">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Age Bracket</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Monthly Premium</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="md:bg-card divide-y divide-border md:divide-y-0">
                        {isLoading ? (
                            <tr><td colSpan={3} className="text-center py-10 text-muted">Loading...</td></tr>
                        ) : rates.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-10 text-muted">No rates configured.</td></tr>
                        ) : (
                            rates.map((rate) => (
                                <tr key={rate.id}>
                                    <td className="px-6 py-4 font-medium">{rate.minAge} - {rate.maxAge} Years</td>
                                    <td className="px-6 py-4 font-bold text-accent">₹{rate.rate}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 md:justify-start justify-end">
                                            <Button variant="icon" size="sm" onClick={() => { setCurrentRate(rate); setIsFormOpen(true); }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="icon" size="sm" onClick={() => handleDelete(rate.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GMCConfiguration;
