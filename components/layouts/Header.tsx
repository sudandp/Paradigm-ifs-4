import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Crosshair, ChevronDown, Menu, X, ArrowLeft, Bell, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import Logo from '../ui/Logo';
import NotificationBell from '../notifications/NotificationBell';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useDevice } from '../../hooks/useDevice';
import { ProfilePlaceholder } from '../ui/ProfilePlaceholder';
import { isAdmin } from '../../utils/auth';
import { useUiSettingsStore } from '../../store/uiSettingsStore';

interface HeaderProps {
    setIsMobileMenuOpen?: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setIsMobileMenuOpen }) => {
    const { user, logout } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const { isMobile } = useDevice();
    const { setReferralModalOpen } = useUiSettingsStore();
    const location = useLocation();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getRoleName = (role: string) => {
        return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const handleLogoutClick = () => {
        setIsMobileMenuOpen?.(false);
        setIsUserMenuOpen(false);
        navigate('/auth/logout');
    };

    const handleMobileExit = () => {
        navigate('/profile');
    };

    return (
        <header
            className={`relative transition-all duration-300 flex-shrink-0 ${
                isMobile 
                ? 'bg-transparent' 
                : 'bg-white border-b border-gray-200/60'
            }`}
        >
            <div className="px-4 w-full">
                <div className={`flex items-center h-14 w-full ${isMobile ? 'justify-center' : 'justify-between'}`}>
                    <div className={isMobile ? "absolute inset-x-0 flex justify-center pointer-events-none" : "flex-1 flex justify-start"}>
                            {isMobile && (
                                <div className="pointer-events-auto bg-white py-2 px-6 rounded-xl border-0 shadow-md my-2 transition-all duration-300 mx-auto">
                                    <Logo className="border-0 h-[36px]" variant="original" />
                                </div>
                            )}
                        </div>

                        <div className="flex-none flex items-center justify-center">
                            <div className="flex items-center space-x-2">
                                {!isMobile && (
                                    <div className="relative">
                                         {/* Firework Animation Effect */}
                                         <div className="absolute inset-0 pointer-events-none -m-6 overflow-visible z-0">
                                             {[...Array(12)].map((_, i) => (
                                                 <motion.div
                                                     key={i}
                                                     className={`absolute h-1.5 w-1.5 rounded-full ${
                                                         i % 3 === 0 ? 'bg-yellow-400' : i % 3 === 1 ? 'bg-red-500' : 'bg-emerald-400'
                                                     } shadow-[0_0_8px_rgba(255,255,255,0.8)]`}
                                                     initial={{ top: "50%", left: "50%", opacity: 0, scale: 0 }}
                                                     animate={{ 
                                                         top: ["50%", `${50 + Math.sin(i * 30 * Math.PI / 180) * 50}%`],
                                                         left: ["50%", `${50 + Math.cos(i * 30 * Math.PI / 180) * 50}%`],
                                                         opacity: [0, 1, 0.8, 0],
                                                         scale: [0, 1.2, 0.8, 0]
                                                     }}
                                                     transition={{ 
                                                         duration: 1.5, 
                                                         repeat: Infinity, 
                                                         delay: i * 0.1,
                                                         ease: "easeOut" 
                                                     }}
                                                 />
                                             ))}
                                         </div>

                                        <button
                                            onClick={() => setReferralModalOpen(true)}
                                            className="relative flex items-center group mr-2 active:scale-95 transition-all"
                                            title="Referral Program"
                                        >
                                            <div className="relative inline-flex items-center rounded-lg border border-white/80 overflow-hidden shadow-md group-hover:scale-105 transition-all duration-300">
                                                <div className="bg-black py-1 px-2.5 flex items-center">
                                                    <span className="text-white font-[900] text-[10px] tracking-tighter italic">REFERRAL</span>
                                                </div>
                                                <div className="bg-[#ff0000] py-1 px-3 -ml-1 rounded-l-lg flex items-center relative z-10">
                                                    <span className="text-white font-[900] text-[10px] tracking-tighter italic">PROGRAM</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                                 {user && (
                                     <div className={isMobile ? "absolute right-4 top-[25%] -translate-y-1/2" : ""}>
                                         <NotificationBell theme={isMobile ? 'dark' : 'light'} />
                                     </div>
                                 )}
                                {!isMobile && (
                                    user ? (
                                        <div className="relative" ref={userMenuRef}>
                                            <button
                                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                aria-expanded={isUserMenuOpen}
                                                aria-haspopup="true"
                                            >
                                                <div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden shadow-sm">
                                                    <ProfilePlaceholder photoUrl={user.photoUrl} seed={user.id} />
                                                </div>
                                                <div className="text-left hidden sm:block overflow-hidden ml-1">
                                                    <span className={`text-sm font-semibold truncate block whitespace-nowrap ${isMobile ? 'text-white' : 'text-gray-900 leading-tight'}`}>{user.name}</span>
                                                    <span className={`text-[10px] truncate block whitespace-nowrap uppercase tracking-wider ${isMobile ? 'text-white/70' : 'text-gray-500 leading-none mt-0.5'}`}>{getRoleName(user.role)}</span>
                                                </div>
                                                <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 ${isMobile ? 'text-white/70' : 'text-gray-400'}`} />
                                            </button>

                                            {isUserMenuOpen && (
                                                <div className="absolute right-0 mt-2 w-48 bg-card rounded-xl shadow-card border border-border py-1 z-40 animate-fade-in-down" role="menu">
                                                    <Link
                                                        to="/profile"
                                                        onClick={() => setIsUserMenuOpen(false)}
                                                        className="flex items-center px-4 py-2 text-sm text-primary-text hover:bg-page"
                                                        role="menuitem"
                                                    >
                                                        <User className="mr-2 h-4 w-4" />
                                                        Profile
                                                    </Link>
                                                    {user && (isAdmin(user.role) || permissions[user.role]?.includes('apply_for_leave')) && (
                                                        <Link
                                                            to="/leaves/dashboard"
                                                            onClick={() => setIsUserMenuOpen(false)}
                                                            className="flex items-center px-4 py-2 text-sm text-primary-text hover:bg-page"
                                                            role="menuitem"
                                                        >
                                                            <Crosshair className="mr-2 h-4 w-4" />
                                                            Tracker
                                                        </Link>
                                                    )}
                                                    <button
                                                        onClick={handleLogoutClick}
                                                        className="flex items-center w-full text-left px-4 py-2 text-sm text-primary-text hover:bg-page"
                                                        role="menuitem"
                                                    >
                                                        <LogOut className="mr-2 h-4 w-4" />
                                                        Log Out
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => navigate('/auth/login')}
                                            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95"
                                        >
                                            <User className="h-4 w-4" />
                                            Sign In
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
        </header>
    );
};

export default Header;
