import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { api } from '../../services/api';
import type { OrganizationGroup, Company, Entity, Organization } from '../../types';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { Building, Loader2 } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LoadingScreen from '../../components/ui/LoadingScreen';


const schema = yup.object({
    groupId: yup.string().required('Please select a group'),
    companyId: yup.string().required('Please select a company'),
    clientId: yup.string().required('Please select a client'),
    manpowerCount: yup.number().typeError('Must be a number').min(0, 'Cannot be negative').required('Manpower count is required'),
}).defined();

type FormInputs = {
    groupId: string;
    companyId: string;
    clientId: string;
    manpowerCount: number;
};

const AddSitePage: React.FC = () => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [groups, setGroups] = useState<OrganizationGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [isClientListOpen, setIsClientListOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const clientSearchRef = useRef<HTMLDivElement>(null);

    const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<FormInputs>({
        resolver: yupResolver(schema) as any,
    });

    const selectedGroupId = watch('groupId');
    const selectedCompanyId = watch('companyId');

    useEffect(() => {
        setIsLoading(true);
        api.getOrganizationStructure()
            .then(setGroups)
            .catch(() => setToast({ message: 'Failed to load organization structure.', type: 'error' }))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        setValue('companyId', '');
        setValue('clientId', '');
        setClientSearch('');
    }, [selectedGroupId, setValue]);

    useEffect(() => {
        setValue('clientId', '');
        setClientSearch('');
    }, [selectedCompanyId, setValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
                setIsClientListOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const companies = useMemo(() => groups.find((g) => g.id === selectedGroupId)?.companies || [], [groups, selectedGroupId]);
    const clients = useMemo(() => companies.find((c) => c.id === selectedCompanyId)?.entities || [], [companies, selectedCompanyId]);

    const filteredClients = useMemo(() => {
        if (!clientSearch) return clients;
        return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
    }, [clients, clientSearch]);

    const handleClientSelect = (client: Entity) => {
        setValue('clientId', client.id, { shouldValidate: true });
        setClientSearch(client.name);
        setIsClientListOpen(false);
    };

    const onSubmit: SubmitHandler<FormInputs> = async (data) => {
        const client = clients.find((e) => e.id === data.clientId);
        if (!client) return;

        setIsSubmitting(true);
        try {
            // Check if site already exists (this check was in the parent component previously)
            const existingOrgs = await api.getOrganizations();
            if (existingOrgs.some(org => org.id === client.organizationId)) {
                setToast({ message: 'A site for this client already exists.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            const newSite: Organization = {
                id: client.organizationId || `site_${Date.now()}`,
                shortName: client.name,
                fullName: client.name,
                address: client.location || client.registeredAddress || '',
                manpowerApprovedCount: data.manpowerCount,
            };

            await api.createOrganization(newSite);
            setToast({ message: 'Site added successfully!', type: 'success' });
            setTimeout(() => navigate('/admin/sites'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to add site. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>Add Site</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Building className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Add Site from Client</h2>
                            <p className="text-sm text-gray-400">Create a new site from an existing client entity.</p>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <Select label="Group" id="groupId" registration={register('groupId')} error={errors.groupId?.message}>
                                    <option value="">Select a Group</option>
                                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </Select>

                                <Select label="Company" id="companyId" registration={register('companyId')} error={errors.companyId?.message} disabled={!selectedGroupId}>
                                    <option value="">Select a Company</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>

                                <div className="relative" ref={clientSearchRef}>
                                    <Input
                                        label="Client"
                                        id="clientSearch"
                                        value={clientSearch}
                                        onChange={(e) => { setClientSearch(e.target.value); setIsClientListOpen(true); setValue('clientId', ''); }}
                                        onFocus={() => setIsClientListOpen(true)}
                                        disabled={!selectedCompanyId}
                                        error={errors.clientId?.message}
                                        autoComplete="off"
                                    />
                                    {isClientListOpen && filteredClients.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                                            {filteredClients.map((client) => (
                                                <li key={client.id} onClick={() => handleClientSelect(client)} className="px-3 py-2 text-sm cursor-pointer hover:bg-page">
                                                    {client.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <Input label="Approved Manpower Count" id="manpowerCount" type="number" registration={register('manpowerCount')} error={errors.manpowerCount?.message} />
                            </form>
                        )}
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
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting || isLoading}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Adding...' : 'Add Site'}
                    </button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 md:p-6">
            <div className="bg-card p-8 rounded-xl shadow-card w-full">
                <div className="flex items-center mb-6">
                    <div className="bg-accent-light p-3 rounded-full mr-4">
                        <Building className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Add Site from Client</h2>
                        <p className="text-muted">Create a new site from an existing client entity.</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Select label="Group" id="groupId" registration={register('groupId')} error={errors.groupId?.message}>
                            <option value="">Select a Group</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </Select>

                        <Select label="Company" id="companyId" registration={register('companyId')} error={errors.companyId?.message} disabled={!selectedGroupId}>
                            <option value="">Select a Company</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>

                        <div className="relative" ref={clientSearchRef}>
                            <Input
                                label="Client"
                                id="clientSearch"
                                value={clientSearch}
                                onChange={(e) => { setClientSearch(e.target.value); setIsClientListOpen(true); setValue('clientId', ''); }}
                                onFocus={() => setIsClientListOpen(true)}
                                disabled={!selectedCompanyId}
                                error={errors.clientId?.message}
                                autoComplete="off"
                            />
                            {isClientListOpen && filteredClients.length > 0 && (
                                <ul className="absolute z-10 w-full bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                                    {filteredClients.map((client) => (
                                        <li key={client.id} onClick={() => handleClientSelect(client)} className="px-3 py-2 text-sm cursor-pointer hover:bg-page">
                                            {client.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <Input label="Approved Manpower Count" id="manpowerCount" type="number" registration={register('manpowerCount')} error={errors.manpowerCount?.message} />

                        <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                            <Button
                                type="button"
                                onClick={() => navigate('/admin/sites')}
                                variant="secondary"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isSubmitting}>
                                Add Site
                            </Button>
                        </div>
                    </form>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddSitePage;
