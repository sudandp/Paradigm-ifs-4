import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Task, TaskPriority, User } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import Toast from '../../components/ui/Toast';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { CheckSquare } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


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

const AddTaskPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const isMobile = useMediaQuery('(max-width: 767px)');

    const { createTask, updateTask, tasks } = useTaskStore();
    const { user } = useAuthStore();
    const [isSaving, setIsSaving] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const { permissions } = usePermissionsStore();
    const { fetchNotifications } = useNotificationStore();
    const { theme } = useThemeStore();
    const isDark = theme === 'dark';

    const { register, handleSubmit, formState: { errors }, reset, control, watch } = useForm<TaskFormInputs>({
        resolver: yupResolver(validationSchema) as any,
        defaultValues: {
            priority: 'Medium',
            assignedToId: '',
            dueDate: null
        }
    });

    const watchEscalationL1User = watch("escalationLevel1UserId");
    const watchEscalationL2User = watch("escalationLevel2UserId");
    const watchEscalationEmail = watch("escalationEmail");

    useEffect(() => {
        const loadData = async () => {
            try {
                if (user) {
                    const isPrivileged = ['admin', 'hr', 'developer'].includes(user.role);
                    if (isPrivileged) {
                        const fetchedUsers = await api.getUsers();
                        setUsers(fetchedUsers);
                    } else {
                        // Get direct reports and add self
                        const team = await api.getTeamMembers(user.id);
                        setUsers([user, ...team]);
                    }
                }

                if (isEditing && id) {
                    // If tasks are already loaded in store, use them, otherwise fetch
                    let taskToEdit = tasks.find(t => t.id === id);
                    if (!taskToEdit) {
                        // Fallback if not in store (e.g. direct link access)
                        // Note: api.getTasks() returns all tasks, might be inefficient but acceptable for now
                        const allTasks = await api.getTasks();
                        taskToEdit = allTasks.find(t => t.id === id);
                    }

                    if (taskToEdit) {
                        reset(taskToEdit);
                    } else {
                        setToast({ message: 'Task not found.', type: 'error' });
                        setTimeout(() => navigate('/tasks'), 2000);
                    }
                }
            } catch (error) {
                setToast({ message: 'Failed to load data.', type: 'error' });
            }
        };
        loadData();
    }, [id, isEditing, tasks, reset, navigate, user]);

    const onSubmit: SubmitHandler<TaskFormInputs> = async (data) => {
        setIsSaving(true);
        try {
            const assignedUser = users.find(u => u.id === data.assignedToId);
            const taskData = { ...data, assignedToName: assignedUser?.name };

            if (isEditing && id) {
                await updateTask(id, taskData);
                setToast({ message: 'Task updated successfully!', type: 'success' });
            } else {
                await createTask(taskData);
                setToast({ message: `Task created successfully.`, type: 'success' });
            }

            // Notification logic
            // We need the initial data to check if assignee changed, but for simplicity in this page component
            // we'll send notification if it's a new task or if we can infer change.
            // For now, let's send for new tasks or if we are editing (assuming assignee *might* have changed).
            // A more robust check would require storing initial assignee ID.
            if (assignedUser) {
                const userPermissions = permissions[assignedUser.role] || [];
                const canManageTasks = userPermissions.includes('manage_tasks');
                const tasksLink = canManageTasks ? '/tasks' : '/onboarding/tasks';

                // Only send if creating or if we suspect a change (simplified)
                if (!isEditing || (isEditing && id)) {
                    await api.createNotification({
                        userId: assignedUser.id,
                        type: 'task_assigned',
                        message: `You have been assigned a new task: "${data.name}"`,
                        linkTo: tasksLink,
                    });
                    fetchNotifications();
                }
            }

            setTimeout(() => navigate('/tasks'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to save task.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Styles
    const darkInputStyle = "!bg-[#041b0f] !border-white/10 !text-white !placeholder-gray-500 !rounded-xl focus:!ring-emerald-500 focus:!border-emerald-500";
    const darkLabelStyle = "text-gray-300 font-medium mb-1.5 block";
    const lightInputStyle = "";
    const lightLabelStyle = "block text-sm font-medium text-muted mb-1";

    const inputStyle = isDark ? darkInputStyle : lightInputStyle;
    const labelStyle = isDark ? darkLabelStyle : lightLabelStyle;

    if (isMobile) {
        return (
            <div className={`h-full flex flex-col ${isDark ? 'bg-[#041b0f] text-white' : ''}`}>
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>{isEditing ? 'Edit Task' : 'Add Task'}</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className={`${isDark ? 'bg-[#152b1b] border border-white/10' : 'bg-card'} rounded-2xl p-6 space-y-6`}>
                        <div className="text-center">
                            <div className={`inline-block p-3 rounded-full mb-2 ${isDark ? 'bg-emerald-500/20' : 'bg-accent-light'}`}>
                                <CheckSquare className={`h-8 w-8 ${isDark ? 'text-emerald-400' : 'text-accent-dark'}`} />
                            </div>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-primary-text'}`}>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>Assign tasks and set deadlines.</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label htmlFor="name" className={labelStyle}>Task Name</label>
                                <Input id="name" registration={register('name')} error={errors.name?.message} className={inputStyle} placeholder={isDark ? "Enter task name" : ""} />
                            </div>

                            <div>
                                <label htmlFor="description" className={labelStyle}>Description</label>
                                <textarea
                                    id="description"
                                    rows={4}
                                    {...register('description')}
                                    className={isDark
                                        ? `w-full ${inputStyle} px-3 py-3 outline-none`
                                        : `mt-1 bg-card border ${errors.description ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2.5 w-full sm:text-sm focus:ring-1 focus:ring-accent`
                                    }
                                    placeholder={isDark ? "Enter task description" : ""}
                                />
                                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className={labelStyle}>Due Date</label>
                                    <Controller
                                        name="dueDate"
                                        control={control}
                                        render={({ field }) => (
                                            <DatePicker
                                                label=""
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
                                    <label htmlFor="priority" className={labelStyle}>Priority</label>
                                    <Select id="priority" registration={register('priority')} error={errors.priority?.message} className={inputStyle}>
                                        <option value="Low" className={isDark ? "bg-[#041b0f]" : ""}>Low</option>
                                        <option value="Medium" className={isDark ? "bg-[#041b0f]" : ""}>Medium</option>
                                        <option value="High" className={isDark ? "bg-[#041b0f]" : ""}>High</option>
                                    </Select>
                                </div>

                                <div>
                                    <label htmlFor="assignedToId" className={labelStyle}>Assign To</label>
                                    <Select id="assignedToId" registration={register('assignedToId')} error={errors.assignedToId?.message} className={inputStyle}>
                                        <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name} ({user.role.replace(/_/g, ' ')})</option>
                                        ))}
                                    </Select>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/tasks')}
                        disabled={isSaving}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="fo-btn-primary flex-1"
                    >
                        {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
                    </button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className={`p-4 md:p-6 ${isDark ? 'text-white' : ''}`}>
            <div className={`${isDark ? 'bg-[#152b1b] border border-white/10' : 'bg-card'} p-8 rounded-xl shadow-card w-full`}>
                <div className="flex items-center mb-6">
                    <div className={`p-3 rounded-full mr-4 ${isDark ? 'bg-emerald-500/20' : 'bg-accent-light'}`}>
                        <CheckSquare className={`h-8 w-8 ${isDark ? 'text-emerald-400' : 'text-accent-dark'}`} />
                    </div>
                    <div>
                        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-primary-text'}`}>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
                        <p className={isDark ? 'text-gray-400' : 'text-muted'}>Assign tasks and set deadlines.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label htmlFor="name" className={labelStyle}>Task Name</label>
                            <Input id="name" registration={register('name')} error={errors.name?.message} className={inputStyle} placeholder={isDark ? "Enter task name" : ""} />
                        </div>

                        <div className="md:col-span-2">
                            <label htmlFor="description" className={labelStyle}>Description</label>
                            <textarea
                                id="description"
                                rows={4}
                                {...register('description')}
                                className={isDark
                                    ? `w-full ${inputStyle} px-3 py-3 outline-none`
                                    : `mt-1 bg-card border ${errors.description ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2.5 w-full sm:text-sm focus:ring-1 focus:ring-accent`
                                }
                                placeholder={isDark ? "Enter task description" : ""}
                            />
                            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
                        </div>

                        <div>
                            <label className={labelStyle}>Due Date</label>
                            <Controller
                                name="dueDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label=""
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
                            <label htmlFor="priority" className={labelStyle}>Priority</label>
                            <Select id="priority" registration={register('priority')} error={errors.priority?.message} className={inputStyle}>
                                <option value="Low" className={isDark ? "bg-[#041b0f]" : ""}>Low</option>
                                <option value="Medium" className={isDark ? "bg-[#041b0f]" : ""}>Medium</option>
                                <option value="High" className={isDark ? "bg-[#041b0f]" : ""}>High</option>
                            </Select>
                        </div>

                        <div className="md:col-span-2">
                            <label htmlFor="assignedToId" className={labelStyle}>Assign To</label>
                            <Select id="assignedToId" registration={register('assignedToId')} error={errors.assignedToId?.message} className={inputStyle}>
                                <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name} ({user.role.replace(/_/g, ' ')})</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className={`pt-6 border-t ${isDark ? 'border-white/10' : 'border-border'}`}>
                        <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-primary-text'} mb-1`}>Escalation Matrix (Optional)</h4>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-muted'} mb-6`}>Define who gets notified if this task becomes overdue.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="escalationLevel1UserId" className={labelStyle}>Escalation Level 1</label>
                                <Select id="escalationLevel1UserId" registration={register('escalationLevel1UserId')} error={errors.escalationLevel1UserId?.message} className={inputStyle}>
                                    <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                    {users.map(user => (<option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name}</option>))}
                                </Select>
                            </div>

                            {watchEscalationL1User && (
                                <div>
                                    <label htmlFor="escalationLevel1DurationDays" className={labelStyle}>Days until L1 Escalation</label>
                                    <Input id="escalationLevel1DurationDays" type="number" registration={register('escalationLevel1DurationDays')} error={errors.escalationLevel1DurationDays?.message} className={inputStyle} />
                                </div>
                            )}

                            <div>
                                <label htmlFor="escalationLevel2UserId" className={labelStyle}>Escalation Level 2</label>
                                <Select id="escalationLevel2UserId" registration={register('escalationLevel2UserId')} error={errors.escalationLevel2UserId?.message} className={inputStyle}>
                                    <option value="" className={isDark ? "bg-[#041b0f]" : ""}>Select User</option>
                                    {users.map(user => (<option key={user.id} value={user.id} className={isDark ? "bg-[#041b0f]" : ""}>{user.name}</option>))}
                                </Select>
                            </div>

                            {watchEscalationL2User && (
                                <div>
                                    <label htmlFor="escalationLevel2DurationDays" className={labelStyle}>Days until L2 Escalation</label>
                                    <Input id="escalationLevel2DurationDays" type="number" registration={register('escalationLevel2DurationDays')} error={errors.escalationLevel2DurationDays?.message} className={inputStyle} />
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label htmlFor="escalationEmail" className={labelStyle}>Final Escalation Email</label>
                                <Input id="escalationEmail" type="email" registration={register('escalationEmail')} error={errors.escalationEmail?.message} className={inputStyle} placeholder={isDark ? "Enter email address" : ""} />
                            </div>

                            {watchEscalationEmail && (
                                <div className="md:col-span-2">
                                    <label htmlFor="escalationEmailDurationDays" className={labelStyle}>Days until Final Escalation</label>
                                    <Input id="escalationEmailDurationDays" type="number" registration={register('escalationEmailDurationDays')} error={errors.escalationEmailDurationDays?.message} className={inputStyle} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/tasks')}
                            variant="secondary"
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving}>
                            {isEditing ? 'Save Changes' : 'Create Task'}
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddTaskPage;
