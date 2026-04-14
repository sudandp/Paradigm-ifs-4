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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {taskGroups.map(group => (
            <div key={group.id} className="bg-page p-4 rounded-lg border border-border flex flex-col">
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="h-5 w-5 text-accent" />
                  <h4 className="font-bold text-primary-text">{group.name}</h4>
                </div>
                <p className="text-sm text-muted mb-3">{group.description}</p>
                <p className="text-xs font-semibold text-muted">{group.permissions.length} permissions</p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
                <Button variant="icon" onClick={() => { setCurrentTaskGroup(group); setIsFormOpen(true); }} title={`Edit ${group.name}`} className="p-2 hover:bg-blue-500/10 rounded-full transition-colors"><Edit className="h-5 w-5" /></Button>
                <Button variant="icon" onClick={() => { setCurrentTaskGroup(group); setIsDeleteModalOpen(true); }} title={`Delete ${group.name}`} className="p-2 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 className="h-5 w-5 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleManagement;