import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import { LogOut, ArrowLeft } from 'lucide-react';

const LogoutPage: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuthStore();

    const handleConfirmLogout = async () => {
        await logout();
        navigate('/auth/login', { replace: true });
    };

    const handleCancel = () => {
        navigate(-1);
    };

    return (
        <div className="w-full flex flex-col items-center">
            {/* Icon */}
            <div className="flex justify-center mb-8">
                <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
                    <LogOut className="h-12 w-12 text-red-500" />
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <Button
                    onClick={handleConfirmLogout}
                    variant="danger"
                    className="w-full !py-3 !text-lg shadow-lg shadow-red-500/20"
                >
                    Yes, Log Out
                </Button>
                <Button
                    onClick={handleCancel}
                    variant="secondary"
                    className="w-full !py-3 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
};

export default LogoutPage;
