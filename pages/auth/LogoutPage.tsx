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
            {/* Concentric Pulse Glowing Portal */}
            <div className="relative mb-6 flex items-center justify-center">
                {isMobile ? (
                    <>
                        {/* Outer animated ping ring */}
                        <div className="absolute w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 animate-ping opacity-75"></div>
                        {/* Inner glowing circle */}
                        <div className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-br from-red-950/50 to-red-900/30 border border-red-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.35)]">
                            <LogOut className="h-6 w-6 text-red-500" />
                        </div>
                    </>
                ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-50 border border-red-100">
                        <LogOut className="h-6 w-6 text-red-600" />
                    </div>
                )}
            </div>

            {/* Actions Grid / Stack */}
            {isMobile ? (
                <div className="grid grid-cols-2 gap-3.5 w-full mt-4">
                    <button
                        onClick={handleCancel}
                        className="h-11 text-xs font-bold !text-[#3eff99] bg-[#132d22] border border-[#225c42] hover:bg-[#1a3d2e] rounded-xl active:scale-[0.98] transition-all duration-300 flex items-center justify-center shadow-md shadow-emerald-950/10"
                    >
                        Stay Logged In
                    </button>
                    <Button
                        onClick={handleConfirmLogout}
                        className="w-full transition-all duration-300 !font-bold !h-11 !rounded-xl !bg-gradient-to-r !from-red-500 !to-rose-600 hover:!from-red-600 hover:!to-rose-700 !text-white active:scale-[0.97] !text-xs shadow-lg shadow-red-950/20 flex items-center justify-center"
                    >
                        Yes, Sign Out
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col w-full gap-5">
                    <Button
                        onClick={handleConfirmLogout}
                        className="w-full transition-all !font-black !h-14 !rounded-2xl !bg-red-600 !text-white hover:!bg-red-700 shadow-red-200 shadow-2xl"
                    >
                        Yes, Sign Out
                    </Button>
                    <button
                        onClick={handleCancel}
                        className="w-full transition-colors tracking-wide h-14 text-sm font-black text-gray-500 hover:text-gray-700"
                    >
                        Stay Logged In
                    </button>
                </div>
            )}
        </div>
    );
};

export default LogoutPage;
