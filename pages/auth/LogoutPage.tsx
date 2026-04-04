import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import { LogOut } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

const LogoutPage: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuthStore();
    const { isMobile } = useDevice();

    const handleConfirmLogout = async () => {
        await logout();
        navigate('/auth/login', { replace: true });
    };

    const handleCancel = () => {
        navigate(-1);
    };

    return (
        <div className="w-full flex flex-col items-center py-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 ${isMobile ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                <LogOut className={`h-10 w-10 ${isMobile ? 'text-red-500' : 'text-red-600'}`} />
            </div>

            <div className="flex flex-col gap-6 w-full">
                <Button
                    onClick={handleConfirmLogout}
                    className={`w-full !font-black !h-14 !rounded-2xl transition-all shadow-2xl ${isMobile ? '!bg-red-500 hover:!bg-red-600 !text-white active:scale-[0.98]' : '!bg-red-600 !text-white hover:!bg-red-700 shadow-red-200'}`}
                >
                    Yes, Sign Out
                </Button>
                <button
                    onClick={handleCancel}
                    className={`w-full h-14 text-sm font-black transition-colors tracking-wide ${isMobile ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Stay Logged In
                </button>
            </div>
        </div>
    );
};

export default LogoutPage;
