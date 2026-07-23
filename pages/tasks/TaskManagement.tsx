import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import { useAuthStore } from '../../store/authStore';
import { Plus, Edit, Trash2, CheckCircle, X, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import CompleteTaskForm from '../../components/tasks/CompleteTaskForm';
import type { Task, EscalationStatus, TaskPriority, TaskStatus, User } from '../../types';
import { api } from '../../services/api';
import { format, addDays } from 'date-fns';
import { useThemeStore } from '../../store/themeStore';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Pagination from '../../components/ui/Pagination';
import Input from '../../components/ui/Input';

const getNextDueDateInfo = (task: Task): { date: string | null; isOverdue: boolean } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (dateStr: string | null | undefined) => dateStr ? new Date(dateStr) : null;

    if (task.status === 'Done' || !task.dueDate) {
        return { date: task.dueDate ? format(parseDate(task.dueDate)!, 'dd MMM, yyyy') : '-', isOverdue: false };
    }

    let nextDueDate: Date | null = null;
    const baseDueDate = parseDate(task.dueDate)!;

    switch (task.escalationStatus) {
        case 'None':
            nextDueDate = task.escalationLevel1DurationDays ? addDays(baseDueDate, task.escalationLevel1DurationDays) : baseDueDate;
            break;
        case 'Level 1':
            if (task.escalationLevel1DurationDays && task.escalationLevel2DurationDays) {
                const l1Date = addDays(baseDueDate, task.escalationLevel1DurationDays);
                nextDueDate = addDays(l1Date, task.escalationLevel2DurationDays);
            }
            break;
        case 'Level 2':
            if (task.escalationLevel1DurationDays && task.escalationLevel2DurationDays && task.escalationEmailDurationDays) {
                const l1Date = addDays(baseDueDate, task.escalationLevel1DurationDays);
                const l2Date = addDays(l1Date, task.escalationLevel2DurationDays);
                nextDueDate = addDays(l2Date, task.escalationEmailDurationDays);
            }
            break;
        case 'Email Sent':
            // No further due dates
            break;
    }

    // If no escalation path, the only due date is the base one.
    if (!nextDueDate) nextDueDate = baseDueDate;

    const isOverdue = nextDueDate ? nextDueDate < today : false;

    return { date: format(nextDueDate, 'dd MMM, yyyy'), isOverdue };
};


const TaskManagement: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { tasks, isLoading, error, fetchTasks, deleteTask, runAutomaticEscalations } = useTaskStore();
    const { theme } = useThemeStore();
    const isDark = theme === 'dark';

    const [isCompleteFormOpen, setIsCompleteFormOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<Task | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [totalTasks, setTotalTasks] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');

    const [users, setUsers] = useState<User[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
    const [assignedToFilter, setAssignedToFilter] = useState<'all' | string>('all');
    const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const loadTasks = useCallback(async () => {
        useTaskStore.setState({ isLoading: true });
        try {
            const res = await api.getTasks({ page: currentPage, pageSize });
            useTaskStore.setState({ tasks: res.data, isLoading: false });
            setTotalTasks(res.total);
        } catch (error) {
            useTaskStore.setState({ isLoading: false });
            setToast({ message: 'Failed to fetch tasks.', type: 'error' });
        }
    }, [currentPage, pageSize]);

    useEffect(() => {
        const init = async () => {
            if (user) {
                const isPrivileged = ['admin', 'hr', 'developer'].includes(user.role);
                if (isPrivileged) {
                    api.getUsers().then(u => setUsers(u as User[]));
                } else {
                    const team = await api.getTeamMembers(user.id);
                    setUsers([user, ...team]);
                }
            }
            await loadTasks();
            await runAutomaticEscalations();
        }
        init();
    }, [user, loadTasks, runAutomaticEscalations]);

    const statusFilterId = useId();
    const priorityFilterId = useId();
    const assignedToFilterId = useId();

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize]);

    const handleAdd = () => {
        navigate('/tasks/add');
    };

    const handleEdit = (task: Task) => {
        navigate(`/tasks/edit/${task.id}`);
    };

    const handleComplete = (task: Task) => {
        setCurrentTask(task);
        setIsCompleteFormOpen(true);
    };

    const handleDelete = (task: Task) => {
        setCurrentTask(task);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (currentTask) {
            try {
                await deleteTask(currentTask.id);
                setToast({ message: 'Task deleted.', type: 'success' });
                setIsDeleteModalOpen(false);
            } catch (error) {
                setToast({ message: 'Failed to delete task.', type: 'error' });
            }
        }
    };

    const handleTaskDrop = async (targetStatus: TaskStatus) => {
        if (!draggedTaskId) return;
        const taskToUpdate = tasks.find(t => t.id === draggedTaskId);
        if (!taskToUpdate || taskToUpdate.status === targetStatus) return;

        try {
            // Optimistic update
            useTaskStore.setState({
                tasks: tasks.map(t => t.id === draggedTaskId ? { ...t, status: targetStatus } : t)
            });
            await api.updateTask(draggedTaskId, { status: targetStatus });
            setToast({ message: `Task moved to ${targetStatus}`, type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to update task status', type: 'error' });
            await loadTasks();
        } finally {
            setDraggedTaskId(null);
        }
    };

    const filteredTasks = useMemo(() => {
        const isPrivileged = user && ['admin', 'hr', 'developer'].includes(user.role);
        const allowedUserIds = users.map(u => u.id);

        return tasks.filter(task => {
            if (!isPrivileged && task.assignedToId && !allowedUserIds.includes(task.assignedToId)) {
                return false;
            }

            if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false;
            }
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
                return false;
            }
            if (assignedToFilter === 'unassigned') {
                if (task.assignedToId) return false;
            } else if (assignedToFilter !== 'all' && task.assignedToId !== assignedToFilter) {
                return false;
            }
            
            if (searchTerm && !task.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            return true;
        });
    }, [tasks, statusFilter, priorityFilter, assignedToFilter, user, users, searchTerm]);

    const clearFilters = () => {
        setStatusFilter('all');
        setPriorityFilter('all');
        setAssignedToFilter('all');
    };

    const areFiltersActive = statusFilter !== 'all' || priorityFilter !== 'all' || assignedToFilter !== 'all';

    const getPriorityChip = (priority: Task['priority']) => {
        const styles = {
            High: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800',
            Medium: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800',
            Low: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800',
        };
        return <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[priority]}`}>{priority}</span>;
    };

    const getStatusChip = (status: Task['status']) => {
        const styles = {
            'To Do': isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-100 text-gray-800',
            'In Progress': isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-800',
            'Done': isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-800',
        };
        return <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{status}</span>;
    };

    const getEscalationChip = (status: EscalationStatus) => {
        if (status === 'None') return null;
        const styles: Record<EscalationStatus, string> = {
            'None': '',
            'Level 1': isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-800',
            'Level 2': isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800',
            'Email Sent': isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800',
        };
        return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
    };


    return (
        <div className={`min-h-screen ${isMobile ? 'bg-[#041b0f] text-white p-3 pb-20' : `p-4 ${isDark ? 'bg-[#041b0f] border border-white/10' : 'md:bg-card'} md:p-6 md:rounded-xl md:shadow-card`}`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {isCompleteFormOpen && currentTask && (
                <CompleteTaskForm
                    isOpen={isCompleteFormOpen}
                    onClose={() => setIsCompleteFormOpen(false)}
                    task={currentTask}
                    setToast={setToast}
                />
            )}

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the task "{currentTask?.name}"?
            </Modal>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h1 className={`text-xl font-bold ${isMobile || isDark ? 'text-white' : 'text-gray-900'}`}>Task Management</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Drag & drop cards to transition task status</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            viewMode === 'kanban' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                        }`}
                    >
                        Kanban Board
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            viewMode === 'table' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                        }`}
                    >
                        Table List
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6 md:items-end justify-between">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label htmlFor={statusFilterId} className={`text-xs font-medium ${isMobile || isDark ? 'text-gray-300' : 'text-gray-700'}`}>Filter by Status</label>
                        <select
                            id={statusFilterId}
                            name="statusFilter"
                            className={`w-full rounded-lg border px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 ${isMobile || isDark ? 'bg-[#152b1b] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor={priorityFilterId} className={`text-xs font-medium ${isMobile || isDark ? 'text-gray-300' : 'text-gray-700'}`}>Filter by Priority</label>
                        <select
                            id={priorityFilterId}
                            name="priorityFilter"
                            className={`w-full rounded-lg border px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 ${isMobile || isDark ? 'bg-[#152b1b] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value as any)}
                        >
                            <option value="all">All Priorities</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor={assignedToFilterId} className={`text-xs font-medium ${isMobile || isDark ? 'text-gray-300' : 'text-gray-700'}`}>Filter by Assignee</label>
                        <select
                            id={assignedToFilterId}
                            name="assignedToFilter"
                            className={`w-full rounded-lg border px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 ${isMobile || isDark ? 'bg-[#152b1b] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            value={assignedToFilter}
                            onChange={e => setAssignedToFilter(e.target.value)}
                        >
                            <option value="all">All Users</option>
                            <option value="unassigned">Unassigned</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-4 md:mt-0">
                    { (areFiltersActive || searchTerm) && (
                        <Button variant="secondary" onClick={() => { clearFilters(); setSearchTerm(''); }}>
                            <X className="mr-2 h-4 w-4" /> Clear All
                        </Button>
                    )}
                    <button
                        onClick={handleAdd}
                        className={`flex items-center justify-center transition-colors ${isMobile ? 'bg-[#32CD32] hover:bg-[#28a428] text-[#0D1A0D] font-bold border-none shadow-none text-[13px] py-2 px-5 rounded-lg' : 'bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg px-6 py-2.5 font-medium'}`}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Task
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <Input 
                    placeholder="Search tasks by name..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                />
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            {viewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 min-h-[500px]">
                    {(['To Do', 'In Progress', 'Done'] as TaskStatus[]).map((colStatus) => {
                        const colTasks = filteredTasks.filter(t => t.status === colStatus);
                        const headerColor = colStatus === 'To Do' ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200' :
                                           colStatus === 'In Progress' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                                           'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
                        return (
                            <div
                                key={colStatus}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleTaskDrop(colStatus)}
                                className={`rounded-2xl p-4 border flex flex-col transition ${
                                    isDark ? 'bg-[#0b2416] border-white/10' : 'bg-gray-50/80 border-gray-200'
                                }`}
                            >
                                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-4 font-bold text-xs ${headerColor}`}>
                                    <span>{colStatus}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40 text-[11px]">
                                        {colTasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                                    {colTasks.length === 0 ? (
                                        <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                                            Drop task here
                                        </div>
                                    ) : (
                                        colTasks.map((task) => {
                                            const { date: nextDueDate, isOverdue } = getNextDueDateInfo(task);
                                            return (
                                                <div
                                                    key={task.id}
                                                    draggable
                                                    onDragStart={() => setDraggedTaskId(task.id)}
                                                    className={`p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing transition-all transform hover:-translate-y-0.5 ${
                                                        isDark ? 'bg-[#152b1b] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-bold text-sm line-clamp-2">{task.name}</h4>
                                                        {getPriorityChip(task.priority)}
                                                    </div>

                                                    {task.description && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                                            {task.description}
                                                        </p>
                                                    )}

                                                    <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 dark:border-white/10 pt-2.5 mt-2">
                                                        <span>{task.assignedToName || 'Unassigned'}</span>
                                                        <span className={isOverdue ? 'text-red-500 font-bold' : ''}>
                                                            {nextDueDate || '-'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
                                                        <button onClick={() => handleEdit(task)} className="p-1 text-gray-400 hover:text-emerald-500">
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(task)} className="p-1 text-gray-400 hover:text-red-500">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        {task.assignedToId === user?.id && task.status !== 'Done' && (
                                                            <button
                                                                onClick={() => handleComplete(task)}
                                                                className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[11px] font-bold flex items-center gap-1"
                                                            >
                                                                <CheckCircle className="h-3 w-3" /> Done
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full responsive-table">
                    <thead className={isMobile ? 'hidden' : (isDark ? 'bg-white/5 text-white' : 'bg-page')}>
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Task Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Priority</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Next Due Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Assigned To</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Escalation</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y md:divide-y-0 ${isMobile ? 'divide-white/10 space-y-4 block' : (isDark ? 'divide-white/10 bg-[#041b0f]' : 'divide-border md:bg-card')}`}>
                        {isLoading ? (
                            isMobile ? (
                                <tr><td colSpan={7}><div className="p-4"><TableSkeleton rows={5} cols={3} isMobile={true} /></div></td></tr>
                            ) : (
                                <TableSkeleton rows={5} cols={7} />
                            )
                        ) : (
                            filteredTasks.map((task) => {
                            const { date: nextDueDate, isOverdue } = getNextDueDateInfo(task);

                            if (isMobile) {
                                return (
                                    <div key={task.id} className="bg-[#152b1b] p-3 rounded-xl border border-white/5 mb-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-semibold text-white text-base">{task.name}</h3>
                                                <p className="text-[12px] text-gray-400 mt-0.5">Due: <span className={isOverdue ? 'text-red-400 font-bold' : ''}>{nextDueDate || '-'}</span></p>
                                            </div>
                                            {getPriorityChip(task.priority)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                            <div>
                                                <span className="text-gray-500 block text-[10px]">Assigned To</span>
                                                <span className="text-gray-300">{task.assignedToName || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block text-[10px]">Status</span>
                                                <span className="text-gray-300">{task.status}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 border-t border-white/10 pt-2.5">
                                            <button onClick={() => handleEdit(task)} className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-lg"><Edit className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => handleDelete(task)} className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                                            {task.assignedToId === user?.id && task.status !== 'Done' && (
                                                <button onClick={() => handleComplete(task)} className="flex items-center px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium">
                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <tr key={task.id} className={isOverdue ? 'bg-red-50' : (isDark ? 'text-gray-300 hover:bg-white/5' : '')}>
                                    <td data-label="Task Name" className="px-6 py-4 font-medium">{task.name}</td>
                                    <td data-label="Priority" className="px-6 py-4">{getPriorityChip(task.priority)}</td>
                                    <td data-label="Next Due Date" className={`px-6 py-4 text-sm ${isOverdue ? 'font-bold text-red-600' : 'text-muted'}`}>{nextDueDate || '-'}</td>
                                    <td data-label="Assigned To" className="px-6 py-4 text-sm text-muted">{task.assignedToName || '-'}</td>
                                    <td data-label="Status" className="px-6 py-4 text-sm text-muted">{getStatusChip(task.status)}</td>
                                    <td data-label="Escalation" className="px-6 py-4 text-sm text-muted">{getEscalationChip(task.escalationStatus)}</td>
                                    <td data-label="Actions" className="px-6 py-4">
                                        <div className="flex items-center gap-2 justify-end md:justify-start">
                                            <Button variant="icon" size="sm" onClick={() => handleEdit(task)} title="Edit Task"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="icon" size="sm" onClick={() => handleDelete(task)} title="Delete Task"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                            {task.assignedToId === user?.id && task.status !== 'Done' && (
                                                <Button variant="outline" size="sm" onClick={() => handleComplete(task)}>
                                                    <CheckCircle className="h-4 w-4 mr-2" /> Complete
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
            )}

            <Pagination 
                currentPage={currentPage}
                totalItems={totalTasks}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                className="mt-6"
            />
        </div>
    );
};

export default TaskManagement;