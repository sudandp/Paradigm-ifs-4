import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User } from '../../types';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { Gift } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


const GrantCompOffPage: React.FC = () => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [days, setDays] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId || !days || !reason.trim()) return;

        setIsSubmitting(true);
        try {
            // Mock API call
            // await api.grantCompOff({ userId: selectedUserId, days: parseFloat(days), reason });
            console.log('Granting comp off:', { userId: selectedUserId, days, reason });

            setToast({ message: 'Comp off granted successfully!', type: 'success' });
            setTimeout(() => navigate('/hr/leave-management'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to grant comp off.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const allUsers = await api.getUsers();
                setUsers(allUsers);
            } catch (error) {
                setToast({ message: 'Failed to load users.', type: 'error' });
            }
        };
        fetchUsers();
    }, []);
    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>Grant Comp Off</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Gift className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Grant Compensatory Off</h2>
                            <p className="text-sm text-gray-400">Grant comp off days to an employee.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Select
                                label="Select Employee"
                                id="user"
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                                error={!selectedUserId && selectedUserId !== '' ? 'Please select an employee' : ''}
                            >
                                <option value="">Select an employee</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name} - {user.role}</option>
                                ))}
                            </Select>

                            <div>
                                <label htmlFor="days" className="block text-sm font-medium text-muted mb-1">
                                    Number of Days <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="days"
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={days}
                                    onChange={e => setDays(e.target.value)}
                                    placeholder="e.g. 1, 0.5, 2"
                                    className="form-input"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label htmlFor="reason" className="block text-sm font-medium text-muted mb-1">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="reason"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Reason for granting comp off"
                                    className="form-input"
                                    rows={4}
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/hr/leave-management')}
                        disabled={isSubmitting}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedUserId || !days || !reason.trim()}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Granting...' : 'Grant Comp Off'}
                    </button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <div className="bg-card p-8 rounded-xl shadow-card w-full">
                <div className="flex items-center mb-6">
                    <div className="bg-accent-light p-3 rounded-full mr-4">
                        <Gift className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Grant Compensatory Off</h2>
                        <p className="text-muted">Grant comp off days to an employee.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Select
                        label="Select Employee"
                        id="user"
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                    >
                        <option value="">Select an employee</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>{user.name} - {user.role}</option>
                        ))}
                    </Select>

                    <div>
                        <label htmlFor="days" className="block text-sm font-medium text-muted mb-1">
                            Number of Days <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="days"
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={days}
                            onChange={e => setDays(e.target.value)}
                            placeholder="e.g. 1, 0.5, 2"
                            className="form-input"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-muted mb-1">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Reason for granting comp off"
                            className="form-input"
                            rows={4}
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/hr/leave-management')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={!selectedUserId || !days || !reason.trim()}>
                            Grant Comp Off
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default GrantCompOffPage;
