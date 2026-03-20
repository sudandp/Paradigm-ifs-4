import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User } from '../../types';
import WorkflowChart2D from '../../components/admin/WorkflowChart2D';
import { X, Loader2 } from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';


type UserWithManager = User & { managerName?: string };

const WorkflowChartFullScreen: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserWithManager[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const usersData = await api.getUsersWithManagers();
                setUsers(usersData);
            } catch (error) {
                console.error('Failed to load users', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleClose = () => {
        navigate('/admin/approval-workflow');
    };

    if (isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="w-screen h-screen relative bg-slate-50 overflow-hidden">
            {/* Close Button */}
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-50 p-3 bg-white rounded-full shadow-xl hover:bg-gray-50 transition-all duration-200 border border-gray-200 group"
                title="Close Full Screen"
            >
                <X className="h-6 w-6 text-gray-600 group-hover:text-red-500 transition-colors" />
            </button>

            {/* Chart */}
            <WorkflowChart2D users={users} />
        </div>
    );
};

export default WorkflowChartFullScreen;
