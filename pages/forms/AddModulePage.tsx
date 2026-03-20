import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { AppModule, Permission } from '../../types';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';
import { Package } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


const AddModulePage: React.FC = () => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !description.trim()) return;

        setIsSubmitting(true);
        try {
            const newModule: AppModule = {
                id: name.toLowerCase().replace(/\s+/g, '_'),
                name: name.trim(),
                description: description.trim(),
                permissions: permissions.split(',').map(p => p.trim()).filter(Boolean) as Permission[]
            };

            // Fetch existing modules to append
            const existingModules = await api.getModules();
            if (existingModules.some(m => m.id === newModule.id)) {
                setToast({ message: 'Module with this ID already exists.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            const updatedModules = [...existingModules, newModule];
            await api.saveModules(updatedModules);

            setToast({ message: 'Module created successfully!', type: 'success' });
            setTimeout(() => navigate('/admin/modules'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to create module. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>Add Module</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Package className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Add New Module</h2>
                            <p className="text-sm text-gray-400">Create a new system module.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Module Name"
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. HR Tasks & Management"
                                required
                                disabled={isSubmitting}
                                error={!name.trim() && name !== '' ? 'Module name is required' : ''}
                            />

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-muted mb-1">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Manage leaves, policies, insurance, uniforms, and tasks."
                                    className="form-input"
                                    rows={4}
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label htmlFor="permissions" className="block text-sm font-medium text-muted mb-1">
                                    Permissions (comma-separated)
                                </label>
                                <input
                                    id="permissions"
                                    value={permissions}
                                    onChange={e => setPermissions(e.target.value)}
                                    placeholder="e.g. view_module, manage_module"
                                    className="form-input"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/modules')}
                        disabled={isSubmitting}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim() || !description.trim()}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Module'}
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
                        <Package className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Add New Module</h2>
                        <p className="text-muted">Create a new system module.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Module Name"
                        id="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. HR Tasks & Management"
                        required
                        disabled={isSubmitting}
                    />

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-muted mb-1">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Manage leaves, policies, insurance, uniforms, and tasks."
                            className="form-input"
                            rows={4}
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label htmlFor="permissions" className="block text-sm font-medium text-muted mb-1">
                            Permissions (comma-separated)
                        </label>
                        <input
                            id="permissions"
                            value={permissions}
                            onChange={e => setPermissions(e.target.value)}
                            placeholder="e.g. view_module, manage_module"
                            className="form-input"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/admin/modules')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={!name.trim() || !description.trim()}>
                            Create Module
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddModulePage;
