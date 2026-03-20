import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Forbidden: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-page p-4">
            <div className="text-center p-8 bg-card rounded-2xl shadow-card w-full">
                <div className="flex justify-center mb-4">
                    <ShieldAlert className="h-16 w-16 text-red-500" />
                </div>
                <h2 className="text-3xl font-bold text-primary-text mb-2">Access Denied</h2>
                <p className="text-muted mb-6">
                    You do not have the necessary permissions to view this page. If you believe this is an error, please contact your administrator.
                </p>
                <div className="flex justify-center gap-4">
                    <Button onClick={() => navigate(-1)} variant="secondary">Go Back</Button>
                    <Button onClick={async () => {
                        await useAuthStore.getState().logout();
                        navigate('/auth/login');
                    }}>Login</Button>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center gap-2 opacity-30 text-[10px] font-mono">
                   <div>Role: {useAuthStore.getState().user?.role || 'null'}</div>
                   <div>Version: 2026.01.21.14.30</div>
                </div>
            </div>
        </div>
    );
};

export default Forbidden;
