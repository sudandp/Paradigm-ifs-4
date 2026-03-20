import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Organization } from '../../types';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';
import { Building, Zap } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


const QuickAddSitePage: React.FC = () => {
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
            const newSite: Organization = {
                id: `SITE-${name.toUpperCase().replace(/\s/g, '').substring(0, 4)}-${Date.now() % 1000}`,
                shortName: name.trim(),
                fullName: name.trim(),
                address: 'To be configured',
                provisionalCreationDate: new Date().toISOString(),
            };

            await api.createOrganization(newSite);
            setToast({ message: `Provisional site '${name}' created.`, type: 'success' });
            setTimeout(() => navigate('/admin/sites'), 1500);
        } catch (error: any) {
            const errorMessage = error?.message || error?.error?.message || 'Failed to create site.';
            setToast({ message: `Failed to create site: ${errorMessage}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>Quick Add Site</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Zap className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Quick Add Provisional Site</h2>
                            <p className="text-sm text-gray-400">Create a new site with a 90-day grace period.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="New Site Name"
                                id="quick-add-site-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. New Project Site"
                                required
                                disabled={isSubmitting}
                                autoFocus
                            />
                            <p className="text-xs text-muted">This will create a new site with a 90-day grace period to complete the full configuration.</p>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/sites')}
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
                        {isSubmitting ? 'Adding...' : 'Add Site'}
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
                        <Zap className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Quick Add Provisional Site</h2>
                        <p className="text-muted">Create a new site with a 90-day grace period to complete the full configuration.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="New Site Name"
                        id="quick-add-site-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. New Project Site"
                        required
                        disabled={isSubmitting}
                        autoFocus
                    />
                    <p className="text-sm text-muted -mt-4">This will create a new site with a 90-day grace period to complete the full configuration.</p>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/admin/sites')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={!name.trim()}>
                            Add Site
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default QuickAddSitePage;
