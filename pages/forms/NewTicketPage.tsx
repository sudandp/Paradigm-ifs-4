import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, SubmitHandler, Resolver, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { SupportTicket, User, UploadedFile } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import UploadDocument from '../../components/UploadDocument';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MessageSquarePlus, LifeBuoy } from 'lucide-react';
import { isAdmin } from '../../utils/auth';


const schema = yup.object({
    title: yup.string().required('Title is required'),
    description: yup.string().required('Description is required'),
    category: yup.string().oneOf(['Software Developer', 'Admin', 'Operational', 'HR Query', 'Other']).required('Category is required'),
    priority: yup.string().oneOf(['Low', 'Medium', 'High', 'Urgent']).required('Priority is required'),
    assignedToId: yup.string().optional().nullable(),
    attachment: yup.mixed<UploadedFile | null>().optional().nullable(),
}).defined();

type FormData = Pick<SupportTicket, 'title' | 'description' | 'category' | 'priority' | 'assignedToId'> & { attachment?: UploadedFile | null };

const NewTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
        resolver: yupResolver(schema) as Resolver<FormData>,
        defaultValues: { category: 'Software Developer', priority: 'Medium', assignedToId: null, attachment: null }
    });

    const watchedCategory = useWatch({ control, name: 'category' });

    useEffect(() => {
        api.getUsers().then(setUsers);
    }, []);

    const assignableUsers = useMemo(() => {
        if (!users) return [];
        switch (watchedCategory) {
            case 'Software Developer':
                return users.filter(u => u.role === 'developer');
            case 'Admin':
                return users.filter(u => isAdmin(u.role));
            case 'HR Query':
                return users.filter(u => u.role === 'hr');
            case 'Operational':
                return users.filter(u => ['operation_manager', 'site_manager'].includes(u.role));
            default:
                const allAssignableRoles = ['hr', 'developer', 'operation_manager', 'site_manager'];
                return users.filter(u => isAdmin(u.role) || allAssignableRoles.includes(u.role));
        }
    }, [users, watchedCategory]);

    const onSubmit: SubmitHandler<FormData> = async (data) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const assignedUser = users.find(u => u.id === data.assignedToId);
            await api.createSupportTicket({
                ...data,
                attachment: data.attachment,
                status: 'Open',
                raisedById: user.id,
                raisedByName: user.name,
                assignedToId: data.assignedToId || null,
                assignedToName: assignedUser?.name || null,
                resolvedAt: null,
                closedAt: null,
                rating: null,
                feedback: null
            } as any);
            setToast({ message: 'Ticket created successfully!', type: 'success' });
            setTimeout(() => navigate('/support'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to create ticket.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formId = "new-ticket-form";

    if (isMobile) {
        return (
            <div className="h-full flex flex-col bg-[#041b0f] min-h-screen">
                <header className="p-4 flex-shrink-0 pt-6">
                    <h1 className="text-sm font-bold text-white">New Support Ticket</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4 pt-2 pb-20">
                    <div className="bg-[#0a1c13] border border-[#1d422f] rounded-[2rem] p-6 space-y-6 flex flex-col min-h-full relative overflow-hidden shadow-2xl">
                        <div className="text-center relative z-10">
                            <div className="inline-block bg-[#041b0f] border border-[#1d422f] p-3 rounded-2xl mb-4">
                                <MessageSquarePlus className="h-6 w-6 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Create New Ticket</h2>
                            <p className="text-xs text-gray-400 mt-1">Submit a support request or report an issue.</p>
                        </div>
                        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1 relative z-10">
                            <Input placeholder="Title / Subject" {...register('title')} error={errors.title?.message} 
                                className="bg-[#041b0f] border-[#1d422f] text-white placeholder-emerald-500/40 rounded-xl" />
                            <div>
                                <textarea placeholder="Description" {...register('description')} rows={5} 
                                    className={`form-input w-full bg-[#041b0f] border-[#1d422f] text-white placeholder-emerald-500/40 rounded-xl ${errors.description ? 'border-red-500' : ''}`} />
                                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                            </div>
                            <Controller name="category" control={control} render={({ field }) => (
                                <Select {...field} error={errors.category?.message} className="bg-[#041b0f] border-[#1d422f] text-white rounded-xl">
                                    <option>Software Developer</option>
                                    <option>Admin</option>
                                    <option>Operational</option>
                                    <option>HR Query</option>
                                    <option>Other</option>
                                </Select>
                            )} />
                            <Controller name="priority" control={control} render={({ field }) => (
                                <Select {...field} error={errors.priority?.message} className="bg-[#041b0f] border-[#1d422f] text-white rounded-xl">
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Urgent</option>
                                </Select>
                            )} />
                            <Controller name="assignedToId" control={control} render={({ field }) => (
                                <Select {...field} value={field.value ?? ''} error={errors.assignedToId?.message} className="bg-[#041b0f] border-[#1d422f] text-white rounded-xl">
                                    <option value="">Unassigned</option>
                                    {assignableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                                    ))}
                                </Select>
                            )} />
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-emerald-500/80 mb-2">Attach Screenshot or Document (Image only)</label>
                                <Controller
                                    name="attachment"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <div className="bg-[#041b0f] border border-dashed border-[#1d422f] rounded-xl p-4">
                                            <UploadDocument
                                                label=""
                                                file={field.value}
                                                onFileChange={field.onChange}
                                                allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                                                error={fieldState.error?.message}
                                                transparent={true}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                        </form>
                        
                        <footer className="pt-6 mt-auto flex items-center justify-between relative z-10">
                            <button
                                type="button"
                                onClick={() => navigate('/support')}
                                disabled={isSubmitting}
                                className="text-white text-sm font-bold bg-transparent px-2"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form={formId}
                                disabled={isSubmitting}
                                className="text-white text-sm font-bold bg-transparent px-2"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Ticket'}
                            </button>
                        </footer>
                    </div>
                </main>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="w-full p-4 lg:p-8 space-y-8 animate-fade-in min-w-0 overflow-x-hidden min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-auto">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary-text">Help & Support Desk</h1>
                    <p className="mt-1 text-xs md:text-sm leading-relaxed text-muted">Create a new support ticket or report an issue</p>
                </div>
            </div>

            {/* Form Container Card */}
            <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm">
                {/* Need Assistance Banner */}
                <div className="flex items-center space-x-3 bg-[#f0fdf4] p-4 rounded-2xl border border-emerald-500/20 mb-8">
                    <div className="p-2 rounded-full bg-emerald-500/10">
                        <LifeBuoy className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-bold leading-tight text-slate-900 text-sm">Need Assistance?</h4>
                        <p className="text-xs mt-0.5 text-slate-500">Raise a concern below. Software issues are automatically routed to our developers.</p>
                    </div>
                </div>

                <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column - Core Fields */}
                        <div className="space-y-6">
                            <Input 
                                label="Title / Subject" 
                                placeholder="Brief summary of the issue..."
                                autoCapitalizeCustom={false}
                                {...register('title')} 
                                error={errors.title?.message} 
                                labelClassName="block text-sm font-semibold text-slate-700 mb-1.5"
                                className="bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-full"
                            />
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                                <textarea 
                                    {...register('description')} 
                                    placeholder="Describe the issue or request in detail..."
                                    rows={8} 
                                    className={`form-input w-full rounded-xl border border-gray-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} 
                                />
                                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                            </div>
                        </div>

                        {/* Right Column - Classification, Assignment & Attachment */}
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Controller name="category" control={control} render={({ field }) => (
                                    <Select 
                                        label="Category" 
                                        {...field} 
                                        error={errors.category?.message}
                                        labelClassName="block text-sm font-semibold text-slate-700 mb-1.5"
                                        className="bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option>Software Developer</option>
                                        <option>Admin</option>
                                        <option>Operational</option>
                                        <option>HR Query</option>
                                        <option>Other</option>
                                    </Select>
                                )} />
                                <Controller name="priority" control={control} render={({ field }) => (
                                    <Select 
                                        label="Priority" 
                                        {...field} 
                                        error={errors.priority?.message}
                                        labelClassName="block text-sm font-semibold text-slate-700 mb-1.5"
                                        className="bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </Select>
                                )} />
                            </div>

                            <Controller name="assignedToId" control={control} render={({ field }) => (
                                <Select 
                                    label="Assigned To (Optional)" 
                                    {...field} 
                                    value={field.value ?? ''} 
                                    error={errors.assignedToId?.message}
                                    labelClassName="block text-sm font-semibold text-slate-700 mb-1.5"
                                    className="bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">Unassigned</option>
                                    {assignableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                                    ))}
                                </Select>
                            )} />

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Attachment (Screenshot/Document)</label>
                                <Controller
                                    name="attachment"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <UploadDocument
                                            label=""
                                            file={field.value}
                                            onFileChange={field.onChange}
                                            allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3 border-gray-100">
                        <Button
                            type="button"
                            onClick={() => navigate('/support')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            Submit Ticket
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default NewTicketPage;
