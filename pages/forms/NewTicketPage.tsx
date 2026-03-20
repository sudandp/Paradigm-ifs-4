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
import { MessageSquarePlus } from 'lucide-react';
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
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>New Support Ticket</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <MessageSquarePlus className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Create New Ticket</h2>
                            <p className="text-sm text-gray-400">Submit a support request or report an issue.</p>
                        </div>
                        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <Input placeholder="Title / Subject" {...register('title')} error={errors.title?.message} />
                            <div>
                                <textarea placeholder="Description" {...register('description')} rows={5} className={`form-input ${errors.description ? 'form-input--error' : ''}`} />
                                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                            </div>
                            <Controller name="category" control={control} render={({ field }) => (
                                <Select {...field} error={errors.category?.message}>
                                    <option>Software Developer</option>
                                    <option>Admin</option>
                                    <option>Operational</option>
                                    <option>HR Query</option>
                                    <option>Other</option>
                                </Select>
                            )} />
                            <Controller name="priority" control={control} render={({ field }) => (
                                <Select {...field} error={errors.priority?.message}>
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Urgent</option>
                                </Select>
                            )} />
                            <Controller name="assignedToId" control={control} render={({ field }) => (
                                <Select {...field} value={field.value ?? ''} error={errors.assignedToId?.message}>
                                    <option value="">Unassigned</option>
                                    {assignableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                                    ))}
                                </Select>
                            )} />
                            <Controller
                                name="attachment"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <UploadDocument
                                        label="Attach Screenshot or Document (Image only)"
                                        file={field.value}
                                        onFileChange={field.onChange}
                                        allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/support')}
                        disabled={isSubmitting}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form={formId}
                        disabled={isSubmitting}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Ticket'}
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
                        <MessageSquarePlus className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Create New Ticket</h2>
                        <p className="text-muted">Submit a support request or report an issue.</p>
                    </div>
                </div>

                <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <Input label="Title / Subject" {...register('title')} error={errors.title?.message} />
                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Description</label>
                        <textarea {...register('description')} rows={5} className={`form-input ${errors.description ? 'form-input--error' : ''}`} />
                        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Controller name="category" control={control} render={({ field }) => (
                            <Select label="Category" {...field} error={errors.category?.message}>
                                <option>Software Developer</option>
                                <option>Admin</option>
                                <option>Operational</option>
                                <option>HR Query</option>
                                <option>Other</option>
                            </Select>
                        )} />
                        <Controller name="priority" control={control} render={({ field }) => (
                            <Select label="Priority" {...field} error={errors.priority?.message}>
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                                <option>Urgent</option>
                            </Select>
                        )} />
                    </div>
                    <Controller name="assignedToId" control={control} render={({ field }) => (
                        <Select label="Assigned To (Optional)" {...field} value={field.value ?? ''} error={errors.assignedToId?.message}>
                            <option value="">Unassigned</option>
                            {assignableUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                            ))}
                        </Select>
                    )} />
                    <Controller
                        name="attachment"
                        control={control}
                        render={({ field, fieldState }) => (
                            <UploadDocument
                                label="Attach Screenshot or Document (Image only)"
                                file={field.value}
                                onFileChange={field.onChange}
                                allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                                error={fieldState.error?.message}
                            />
                        )}
                    />

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/support')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            Create Ticket
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default NewTicketPage;
