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
        <div className="w-full flex flex-col items-center py-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isMobile ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                <LogOut className={`h-6 w-6 ${isMobile ? 'text-red-500' : 'text-red-600'}`} />
            </div>

            <div className={`flex flex-col w-full ${isMobile ? 'gap-3' : 'gap-5'}`}>
                <Button
                    onClick={handleConfirmLogout}
                    className={`w-full transition-all ${isMobile ? '!font-bold !h-10 !rounded-lg !bg-red-500 hover:!bg-red-600 !text-white active:scale-[0.98] !text-xs' : '!font-black !h-14 !rounded-2xl !bg-red-600 !text-white hover:!bg-red-700 shadow-red-200 shadow-2xl'}`}
                >
                    Yes, Sign Out
                </Button>
                <button
                    onClick={handleCancel}
                    className={`w-full transition-colors tracking-wide ${isMobile ? 'h-10 text-[11px] font-bold text-white/70 hover:text-white !rounded-lg' : 'h-14 text-sm font-black text-gray-500 hover:text-gray-700'}`}
                >
                    Stay Logged In
                </button>
            </div>
        </div>
    );
};

export default LogoutPage;
