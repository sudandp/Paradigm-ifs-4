import React, { useEffect, useState } from 'react';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Task, TaskPriority, User } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { api } from '../../services/api';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import DatePicker from '../ui/DatePicker';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';

const validationSchema = yup.object({
    name: yup.string().required('Task name is required'),
    description: yup.string().required('Description is required'),
    dueDate: yup.string().required('A due date is required').nullable(),
    priority: yup.string<TaskPriority>().oneOf(['Low', 'Medium', 'High']).required('Priority is required'),
    assignedToId: yup.string().required('An assignee is required'),
    escalationLevel1UserId: yup.string().optional(),
    escalationLevel1DurationDays: yup.number().when('escalationLevel1UserId', {
        is: (val: string | undefined) => !!val,
        then: schema => schema.required('Duration is required').min(0).typeError('Must be a number'),
        otherwise: schema => schema.optional().nullable(),
    }),
    escalationLevel2UserId: yup.string().optional(),
    escalationLevel2DurationDays: yup.number().when('escalationLevel2UserId', {
        is: (val: string | undefined) => !!val,
        then: schema => schema.required('Duration is required').min(0).typeError('Must be a number'),
        otherwise: schema => schema.optional().nullable(),
    }),
    escalationEmail: yup.string().email('Must be a valid email address').optional(),
    escalationEmailDurationDays: yup.number().when('escalationEmail', {
        is: (val: string | undefined) => !!val,
        then: schema => schema.required('Duration is required').min(0).typeError('Must be a number'),
        otherwise: schema => schema.optional().nullable(),
    }),
}).defined();

type TaskFormInputs = Omit<Task, 'id' | 'createdAt' | 'status' | 'assignedToName' | 'completionNotes' | 'completionPhoto' | 'escalationStatus'>;

interface TaskFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: Task | null;
    setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ isOpen, onClose, initialData, setToast }) => {
    const { createTask, updateTask } = useTaskStore();
    const [isSaving, setIsSaving] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const { permissions } = usePermissionsStore();
    const { fetchNotifications } = useNotificationStore();
    const { theme } = useThemeStore();

    const { register, handleSubmit, formState: { errors }, reset, control, watch } = useForm<TaskFormInputs>({
        resolver: yupResolver(validationSchema) as Resolver<TaskFormInputs>,
    });

    const isEditing = !!initialData;
    const watchEscalationL1User = watch("escalationLevel1UserId");
    const watchEscalationL2User = watch("escalationLevel2UserId");
    const watchEscalationEmail = watch("escalationEmail");

    useEffect(() => {
        if (isOpen) {
            api.getUsers().then(setUsers);
            if (initialData) {
                reset(initialData);
            } else {
                reset({ name: '', description: '', dueDate: null, priority: 'Medium', assignedToId: '' });
            }
        }
    }, [initialData, reset, isOpen]);

    const onSubmit: SubmitHandler<TaskFormInputs> = async (data) => {
        setIsSaving(true);
        try {
            const assignedUser = users.find(u => u.id === data.assignedToId);
            const taskData = { ...data, assignedToName: assignedUser?.name };

            if (isEditing) {
                await updateTask(initialData!.id, taskData);
                setToast({ message: 'Task updated successfully!', type: 'success' });
            } else {
                await createTask(taskData);
                setToast({ message: `Task created successfully.`, type: 'success' });
            }

            if (assignedUser && assignedUser.id !== initialData?.assignedToId) {
                const userPermissions = permissions[assignedUser.role] || [];
                const canManageTasks = userPermissions.includes('manage_tasks');
                const tasksLink = canManageTasks ? '/tasks' : '/onboarding/tasks';

                await api.createNotification({
                    userId: assignedUser.id,
                    type: 'task_assigned',
                    message: `You have been assigned a new task: "${data.name}"`,
                    linkTo: tasksLink,
                });
                fetchNotifications();
            }

            onClose();
        } catch (error) {
            setToast({ message: 'Failed to save task.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const isDark = theme === 'dark';

    // Styles for Dark Mode (Premium)
    // UPDATED: Changed background to #041b0f to match main page green as requested
    const darkInputStyle = "!bg-[#041b0f] !border-white/10 !text-white !placeholder-gray-500 !rounded-xl focus:!ring-emerald-500 focus:!border-emerald-500";
    const darkLabelStyle = "text-gray-300 font-medium mb-1.5 block";

    // Styles for Light Mode (Standard)
    const lightInputStyle = ""; // Use default component styles
    const lightLabelStyle = "block text-sm font-medium text-muted mb-1";

    const inputStyle = isDark ? darkInputStyle : lightInputStyle;
    const labelStyle = isDark ? darkLabelStyle : lightLabelStyle;

    return (
        <div className={`fixed inset-0 z-50 ${isDark ? 'bg-[#041b0f]' : 'flex items-center justify-center'}`} onClick={onClose}>
            <div
                className={`${isDark ? 'w-full h-full bg-[#041b0f] p-6 overflow-y-auto scrollbar-hide' : 'bg-card rounded-xl shadow-card p-6 w-full max-w-2xl m-4 animate-fade-in-scale overflow-y-auto max-h-[90vh] scrollbar-hide'}`}
                style={isDark ? { backgroundColor: '#041b0f' } : {}}
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit(onSubmit)} className={isDark ? "space-y-5" : ""}>
                    <div className={`flex items-center justify-between ${isDark ? 'mb-2' : 'mb-4'}`}>
                        <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-primary-text'}`}>{isEditing ? 'Edit' : 'Add'} Task</h3>
                        {isDark && (
                            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className={labelStyle}>Task Name</label>
                            <Input id="name" registration={register('name')} error={errors.name?.message} className={inputStyle} placeholder={isDark ? "Enter task name" : ""} />
                        </div>

                        <div>
                            <label htmlFor="description" className={labelStyle}>Description</label>
                            <textarea
                                id="description"
                                rows={isDark ? 4 : 3}
                                {...register('description')}
                                className={isDark
                                    ? `w-full ${inputStyle} px-3 py-3 outline-none`
                                    : `mt-1 bg-card border ${errors.description ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2.5 w-full sm:text-sm focus:ring-1 focus:ring-accent`
                                }
                                placeholder={isDark ? "Enter task description" : ""}
                            />
                            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                        </div>

                        <div className={isDark ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                            <div className={isDark ? "mb-4" : ""}>
                                {isDark ? <label className={labelStyle}>Due Date</label> : null}
                                <Controller
                                    name="dueDate"
                                    control={control}
                                    render={({ field }) => (
                                        <DatePicker
                                            label={isDark ? "" : "Due Date"}
                                            id="dueDate"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.dueDate?.message}
                                            minDate={new Date()}
                                            className={inputStyle}
                                        />
                                    )}
                                />
                            </div>

                            <div>
                                <label htmlFor="priority" className={isDark ? labelStyle : "hidden"}>Priority</label>
                                <Select label={isDark ? undefined : "Priority"} id="priority" registration={register('priority')} error={errors.priority?.message} className={inputStyle}>
                                    <option value="Low" className={isDark ? "bg-[#041b0f]" : ""}>Low</option>
                                    <option value="Medium" className={isDark ? "bg-[#041b0f]" : ""}>Medium</option>
                                    <option value="High" className={isDark ? "bg-[#041b0f]" : ""}>High</option>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="assignedToId" className={isDark ? labelStyle : "hidden"}>Assign To</label>
                            <Select label={isDark ? undefined : "Assign To"} id="assignedToId" registration={register('assignedToId')} error={errors.assignedToId?.message} className={inputStyle}>
                                <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name} ({user.role.replace(/_/g, ' ')})</option>
                                ))}
                            </Select>
                        </div>

                        <div className={`pt-4 border-t ${isDark ? 'border-white/10' : ''}`}>
                            <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-primary-text'} mb-1`}>Escalation Matrix (Optional)</h4>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-muted'} mb-4 leading-relaxed`}>Define who gets notified if this task becomes overdue and set the time gaps for each escalation.</p>

                            <div className={isDark ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                                <div>
                                    <label htmlFor="escalationLevel1UserId" className={isDark ? labelStyle : "hidden"}>Escalation Level 1</label>
                                    <Select label={isDark ? undefined : "Escalation Level 1"} id="escalationLevel1UserId" registration={register('escalationLevel1UserId')} error={errors.escalationLevel1UserId?.message} className={inputStyle}>
                                        <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                        {users.map(user => (<option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name}</option>))}
                                    </Select>
                                </div>

                                {watchEscalationL1User && (
                                    <div>
                                        <label htmlFor="escalationLevel1DurationDays" className={isDark ? labelStyle : "hidden"}>Days until L1 Escalation</label>
                                        <Input label={isDark ? undefined : "Days until L1 Escalation"} id="escalationLevel1DurationDays" type="number" registration={register('escalationLevel1DurationDays')} error={errors.escalationLevel1DurationDays?.message} className={inputStyle} />
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="escalationLevel2UserId" className={isDark ? labelStyle : "hidden"}>Escalation Level 2</label>
                                    <Select label={isDark ? undefined : "Escalation Level 2"} id="escalationLevel2UserId" registration={register('escalationLevel2UserId')} error={errors.escalationLevel2UserId?.message} className={inputStyle}>
                                        <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                        {users.map(user => (<option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name}</option>))}
                                    </Select>
                                </div>

                                {watchEscalationL2User && (
                                    <div>
                                        <label htmlFor="escalationLevel2DurationDays" className={isDark ? labelStyle : "hidden"}>Days until L2 Escalation</label>
                                        <Input label={isDark ? undefined : "Days until L2 Escalation"} id="escalationLevel2DurationDays" type="number" registration={register('escalationLevel2DurationDays')} error={errors.escalationLevel2DurationDays?.message} className={inputStyle} />
                                    </div>
                                )}

                                <div className={isDark ? "" : "mt-4"}>
                                    <label htmlFor="escalationEmail" className={isDark ? labelStyle : "hidden"}>Final Escalation Email</label>
                                    <Input label={isDark ? undefined : "Final Escalation Email"} id="escalationEmail" type="email" registration={register('escalationEmail')} error={errors.escalationEmail?.message} className={inputStyle} placeholder={isDark ? "Enter email address" : ""} />
                                </div>

                                {watchEscalationEmail && (
                                    <div className={isDark ? "" : "mt-4"}>
                                        <label htmlFor="escalationEmailDurationDays" className={isDark ? labelStyle : "hidden"}>Days until Final Escalation</label>
                                        <Input label={isDark ? undefined : "Days until Final Escalation"} id="escalationEmailDurationDays" type="number" registration={register('escalationEmailDurationDays')} error={errors.escalationEmailDurationDays?.message} className={inputStyle} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={isDark ? "pt-2" : "mt-6 flex justify-end space-x-3"}>
                        {!isDark && <Button type="button" onClick={onClose} variant="secondary">Cancel</Button>}
                        <Button type="submit" isLoading={isSaving} className={isDark ? "w-full !bg-[#32CD32] hover:!bg-[#28a428] !text-[#0D1A0D] !font-bold !rounded-xl py-3 shadow-lg shadow-green-900/20 transition-all transform active:scale-[0.98]" : ""}>
                            {isEditing ? 'Save Changes' : 'Create Task'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskForm;