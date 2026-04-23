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
            className={`transition-all duration-300 flex-shrink-0 ${
                isMobile 
                ? 'bg-transparent' 
                : 'bg-white border-b border-gray-200/60'
            }`}
        >
            <div className="px-4">
                <div className={`flex items-center h-14 ${isMobile ? 'justify-center gap-3' : 'justify-between'}`}>
                    <div className={`${isMobile ? 'flex-none' : 'flex-1'} flex justify-center md:justify-start`}>
                            {isMobile && (
                                <div className="flex items-center justify-center bg-transparent py-2 border-0">
                                    <Logo className="border-0 h-[42px]" variant="original" />
                                </div>
                            )}
                        </div>

                        <div className="flex-none flex items-center justify-center">
                            <div className="flex items-center space-x-2">
                                {!isMobile && (
                                    <div className="relative">
                                        {/* Firecracker Effect Particles */}
                                        <div className="absolute inset-0 pointer-events-none -m-4 overflow-visible">
                                            {[...Array(8)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    className={`absolute h-1 w-1 rounded-full ${
                                                        i % 2 === 0 ? 'bg-yellow-400' : 'bg-emerald-400'
                                                    }`}
                                                    initial={{ top: "50%", left: "50%", opacity: 0, scale: 0 }}
                                                    animate={{ 
                                                        top: ["50%", `${50 + Math.sin(i * 45 * Math.PI / 180) * 40}%`],
                                                        left: ["50%", `${50 + Math.cos(i * 45 * Math.PI / 180) * 40}%`],
                                                        opacity: [0, 1, 0],
                                                        scale: [0, 1.5, 0.5]
                                                    }}
                                                    transition={{ 
                                                        duration: 1.2, 
                                                        repeat: Infinity, 
                                                        delay: i * 0.15,
                                                        ease: "easeOut" 
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setReferralModalOpen(true)}
                                            className="relative flex items-center gap-2 px-3 py-1.5 rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all group mr-2 shadow-sm animate-pulse-subtle"
                                            title="Referral Program"
                                        >
                                            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping duration-[3000ms]" />
                                            <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform relative z-10" />
                                            <span className="text-xs font-bold uppercase tracking-wider relative z-10">Referral</span>
                                        </button>
                                    </div>
                                )}
                                 <NotificationBell theme={isMobile ? 'dark' : 'light'} />
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
