import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { Building } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


const AddGroupPage: React.FC = () => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            // Create a new group
            const newGroup = {
                id: `group_${Date.now()}`,
                name: name.trim()
            };
            await api.createOrganizationGroup(newGroup);
            setToast({ message: 'Group created successfully!', type: 'success' });
            setTimeout(() => navigate('/hr/entity-management'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to create group. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>Add Group</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Building className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Add New Group</h2>
                            <p className="text-sm text-gray-400">Create a new organizational group.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-muted mb-1">
                                    Group Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Enter group name"
                                    className="form-input"
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
                        onClick={() => navigate('/hr/entity-management')}
                        disabled={isSubmitting}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim()}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Saving...' : 'Create Group'}
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
                        <Building className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Add New Group</h2>
                        <p className="text-muted">Create a new organizational group.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-muted mb-1">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Enter group name"
                            className="form-input"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/hr/entity-management')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={!name.trim()}>
                            Create Group
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddGroupPage;
