import React, { useState, useEffect } from 'react';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { LifeBuoy, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { SupportTicket, User, UploadedFile } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import UploadDocument from '../UploadDocument';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface HelpTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const schema = yup.object({
    title: yup.string().required('Title / Subject is required'),
    description: yup.string().required('Description is required'),
    category: yup.string().oneOf(['Software Developer', 'Admin', 'Operational', 'HR Query', 'Other']).required('Category is required'),
    priority: yup.string().oneOf(['Low', 'Medium', 'High', 'Urgent']).required('Priority is required'),
    attachment: yup.mixed<UploadedFile | null>().optional().nullable(),
}).defined();

type FormData = {
    title: string;
    description: string;
    category: 'Software Developer' | 'Admin' | 'Operational' | 'HR Query' | 'Other';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    attachment?: UploadedFile | null;
};

const HelpTicketModal: React.FC<HelpTicketModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
        resolver: yupResolver(schema) as Resolver<FormData>,
        defaultValues: {
            title: '',
            description: '',
            category: 'Software Developer',
            priority: 'Medium',
            attachment: null
        }
    });

    useEffect(() => {
        if (isOpen) {
            api.getUsers({ fetchAll: true })
                .then(setUsers)
                .catch(err => {
                    console.error('Failed to fetch users:', err);
                });
        }
    }, [isOpen]);

    const onSubmit: SubmitHandler<FormData> = async (data) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            // Find a developer user in the system to assign to
            const developers = users.filter(u => u.role === 'developer');
            const devUser = developers.length > 0 ? developers[0] : null;

            const ticketData: Partial<SupportTicket> = {
                title: data.title,
                description: data.description,
                category: data.category,
                priority: data.priority,
                status: 'Open',
                raisedById: user.id,
                raisedByName: user.name,
                assignedToId: devUser ? devUser.id : null,
                assignedToName: devUser ? devUser.name : null,
                resolvedAt: null,
                closedAt: null,
                rating: null,
                feedback: null
            };

            // Only include attachment property if a file was selected, preventing DB schema errors for empty attachments
            if (data.attachment) {
                (ticketData as any).attachment = data.attachment;
            }

            const createdTicket = await api.createSupportTicket(ticketData);

            // Notify assigned developer
            if (devUser) {
                await api.createNotification({
                    userId: devUser.id,
                    message: `You have been assigned a new support ticket: "${data.title}" raised by ${user.name}`,
                    type: 'task_assigned',
                    linkTo: `/support/ticket/${createdTicket.id}`
                });
            }

            setToast({ message: 'Support ticket raised successfully!', type: 'success' });
            reset();
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Failed to create support ticket:', error);
            setToast({ message: 'Failed to raise support ticket.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Help & Support Desk"
                hideFooter={true}
                maxWidth="md:max-w-lg"
                containerClassName={isMobile ? 'bg-[#041b0f] text-white border-t border-[#1d422f]' : 'bg-white text-slate-800 rounded-[24px] shadow-card'}
                headerClassName={isMobile ? 'border-b border-[#1d422f]/40 p-4 pt-6' : 'border-b border-gray-100 p-6 pb-4'}
                titleClassName={isMobile ? 'text-white font-bold text-sm uppercase tracking-tight' : 'text-slate-900 font-bold text-xl font-sans'}
                contentClassName={isMobile ? 'text-white p-4' : 'text-slate-700 p-6'}
            >
                <div className="space-y-6">
                    <div className={isMobile ? 'flex items-center space-x-3 bg-[#0a1c13] p-4 rounded-xl border border-[#1d422f]' : 'flex items-center space-x-3 bg-[#f0fdf4] p-4 rounded-2xl border border-emerald-500/20'}>
                        <div className={`p-2 rounded-full ${isMobile ? 'bg-[#1d422f]/40' : 'bg-emerald-500/10'}`}>
                            <LifeBuoy className={`h-5 w-5 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        </div>
                        <div>
                            <h4 className={`font-bold leading-tight ${isMobile ? 'text-white' : 'text-slate-900 text-sm'}`}>Need Assistance?</h4>
                            <p className={`text-xs mt-0.5 ${isMobile ? 'text-gray-400' : 'text-slate-500'}`}>Raise a concern below. Software issues are automatically routed to our developers.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Input
                            label="Title / Subject"
                            id="help-title"
                            placeholder="Brief summary of the issue..."
                            autoCapitalizeCustom={false}
                            {...register('title')}
                            error={errors.title?.message}
                            labelClassName={isMobile ? 'block text-xs font-bold text-emerald-500/80 mb-1.5 uppercase tracking-widest' : 'block text-sm font-semibold text-slate-700 mb-1.5'}
                            className={isMobile ? 'bg-[#041b0f] border-[#1d422f] text-white placeholder-emerald-500/40 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}
                        />

                        <div>
                            <label htmlFor="help-desc" className={isMobile ? 'block text-xs font-bold text-emerald-500/80 mb-1.5 uppercase tracking-widest' : 'block text-sm font-semibold text-slate-700 mb-1.5'}>Description</label>
                            <textarea
                                id="help-desc"
                                {...register('description')}
                                placeholder="Describe the issue or request in detail..."
                                rows={4}
                                className={isMobile ? 'form-input w-full bg-[#041b0f] border-[#1d422f] text-white placeholder-emerald-500/40 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' : `form-input w-full rounded-xl border border-gray-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                            />
                            {errors.description && (
                                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {errors.description.message}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Controller
                                name="category"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        label="Category"
                                        id="help-category"
                                        {...field}
                                        error={errors.category?.message}
                                        labelClassName={isMobile ? 'block text-xs font-bold text-emerald-500/80 mb-1.5 uppercase tracking-widest font-mono' : 'block text-sm font-semibold text-slate-700 mb-1.5'}
                                        className={isMobile ? 'bg-[#041b0f] border-[#1d422f] text-white rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}
                                    >
                                        <option value="Software Developer">Software/App Issue</option>
                                        <option value="Admin">Admin Request</option>
                                        <option value="Operational">Operational Query</option>
                                        <option value="HR Query">HR Query</option>
                                        <option value="Other">Other</option>
                                    </Select>
                                )}
                            />
                            <Controller
                                name="priority"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        label="Priority"
                                        id="help-priority"
                                        {...field}
                                        error={errors.priority?.message}
                                        labelClassName={isMobile ? 'block text-xs font-bold text-emerald-500/80 mb-1.5 uppercase tracking-widest font-mono' : 'block text-sm font-semibold text-slate-700 mb-1.5'}
                                        className={isMobile ? 'bg-[#041b0f] border-[#1d422f] text-white rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'bg-white border-gray-200 text-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="pt-2">
                            <label className={isMobile ? 'block text-xs font-bold text-emerald-500/80 mb-2 uppercase tracking-widest' : 'block text-sm font-semibold text-slate-700 mb-2'}>
                                Attachment (Screenshot/Document)
                            </label>
                            <Controller
                                name="attachment"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <div className={isMobile ? 'border border-dashed border-[#1d422f] rounded-xl p-3 bg-[#041b0f] [&_label]:text-emerald-500/60 [&_label]:font-bold [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-widest' : ''}>
                                        <UploadDocument
                                            label=""
                                            file={field.value}
                                            onFileChange={field.onChange}
                                            allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                                            error={fieldState.error?.message}
                                            transparent={isMobile}
                                        />
                                    </div>
                                )}
                            />
                        </div>

                        <div className={isMobile ? 'flex justify-between items-center pt-6 mt-4 border-t border-[#1d422f]/40 relative z-10' : 'flex justify-end space-x-3 pt-4 border-t border-gray-100'}>
                            {isMobile ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                        className="text-white text-sm font-bold bg-transparent px-2 active:scale-95 transition-transform"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="text-white text-sm font-bold bg-transparent px-2 active:scale-95 transition-transform"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        isLoading={isSubmitting}
                                    >
                                        Submit Ticket
                                    </Button>
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </Modal>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onDismiss={() => setToast(null)}
                />
            )}
        </>
    );
};

export default HelpTicketModal;
