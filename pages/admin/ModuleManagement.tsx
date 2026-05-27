import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { TaskGroup, Permission } from '../../types';
import { Plus, Edit, Trash2, Loader2, Package } from 'lucide-react';
import Button from '../../components/ui/Button';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ModuleFormModal from '../../components/admin/ModuleFormModal';
import GridSkeleton from '../../components/skeletons/GridSkeleton';
import LoadingScreen from '../../components/ui/LoadingScreen';


const ModuleManagement: React.FC = () => {
  const navigate = useNavigate();
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentTaskGroup, setCurrentTaskGroup] = useState<TaskGroup | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await api.getTaskGroups();
        setTaskGroups(data);
      } catch (e) {
        setToast({ message: 'Failed to load access tasks.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (taskGroupData: TaskGroup) => {
    const newTaskGroups = [...taskGroups];
    const index = newTaskGroups.findIndex(m => m.id === taskGroupData.id);
    if (index > -1) {
      newTaskGroups[index] = taskGroupData;
    } else {
      newTaskGroups.push(taskGroupData);
    }

    try {
      await api.saveTaskGroups(newTaskGroups);
      setTaskGroups(newTaskGroups.sort((a, b) => a.name.localeCompare(b.name)));
      setToast({ message: `Access task '${taskGroupData.name}' saved.`, type: 'success' });
      setIsFormOpen(false);
    } catch (e) {
      setToast({ message: 'Failed to save access task.', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!currentTaskGroup) return;
    const newTaskGroups = taskGroups.filter(m => m.id !== currentTaskGroup.id);
    try {
      await api.saveTaskGroups(newTaskGroups);
      setTaskGroups(newTaskGroups);
      setToast({ message: `Access task '${currentTaskGroup.name}' deleted.`, type: 'success' });
      setIsDeleteModalOpen(false);
    } catch (e) {
      setToast({ message: 'Failed to delete access task.', type: 'error' });
    }
  };

  if (isLoading) {
      return <LoadingScreen message="Loading page data..." />;
  }

  return (
    <div className="p-4 border-0 shadow-none lg:bg-card lg:p-6 lg:rounded-xl lg:shadow-card">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <ModuleFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSave} initialData={currentTaskGroup} />
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion">
        Are you sure you want to delete the access task "{currentTaskGroup?.name}"?
      </Modal>

      <AdminPageHeader title="Access Task Management">
        <Button onClick={() => navigate('/admin/modules/add')}><Plus className="mr-2 h-4" /> Add Task</Button>
      </AdminPageHeader>

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
          {taskGroups.map(group => (
            <div 
              key={group.id} 
              className="bg-gradient-to-br from-[#0c2a1b] to-[#06180f] md:bg-none md:bg-white p-5 rounded-2xl md:rounded-lg border border-[#1d422f] md:border-border flex flex-col shadow-[0_8px_20px_rgba(0,0,0,0.3)] md:shadow-none hover:shadow-lg transition-all duration-300"
            >
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-[#22c55e]/20 text-[#22c55e] shadow-[inset_0_0_8px_rgba(34,197,94,0.3)] md:p-0 md:bg-transparent md:shadow-none md:text-accent flex-shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-white md:text-primary-text text-base md:text-sm truncate w-full">{group.name}</h4>
                </div>
                <p className="text-sm text-gray-300 md:text-muted mb-4 leading-relaxed line-clamp-2 md:line-clamp-none min-h-[40px] md:min-h-0">{group.description}</p>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 md:bg-transparent md:border-none md:p-0">
                  <span className="text-[10px] md:text-xs font-bold md:font-semibold text-emerald-400 md:text-muted uppercase tracking-wider md:normal-case md:tracking-normal">
                    {group.permissions.length} permissions
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1d422f] md:border-border flex justify-end gap-3">
                <button 
                  onClick={() => { setCurrentTaskGroup(group); setIsFormOpen(true); }} 
                  title={`Edit ${group.name}`} 
                  className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 active:scale-95 transition-all md:p-2 md:bg-transparent md:border-none md:text-gray-600 md:hover:bg-blue-500/10 md:rounded-full md:active:scale-100"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button 
                  onClick={() => { setCurrentTaskGroup(group); setIsDeleteModalOpen(true); }} 
                  title={`Delete ${group.name}`} 
                  className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 active:scale-95 transition-all md:p-2 md:bg-transparent md:border-none md:text-rose-500 md:hover:bg-red-500/10 md:rounded-full md:active:scale-100"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleManagement;