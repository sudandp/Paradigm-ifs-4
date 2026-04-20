import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Crosshair, ChevronDown, Menu, X, ArrowLeft, Bell } from 'lucide-react';
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
                <div className={`flex items-center h-14 ${isMobile ? 'justify-center gap-3' : ''}`}>
                    <div className={`${isMobile ? 'flex-none' : 'flex-1'} flex justify-center md:justify-start`}>
                            {isMobile && (
                                <div className="flex items-center justify-center bg-transparent py-2 border-0">
                                    <Logo className="border-0 h-[42px]" />
                                </div>
                            )}
                        </div>

                        <div className="flex-none flex items-center justify-center">
                            <div className="flex items-center">
                                <NotificationBell />
                                {!isMobile && user && (
                                    <div className="relative" ref={userMenuRef}>
                                        <button
                                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                                            aria-expanded={isUserMenuOpen}
                                            aria-haspopup="true"
                                        >
                                            <ProfilePlaceholder photoUrl={user.photoUrl} seed={user.id} className="h-8 w-8 rounded-lg" />
                                            <div className="text-left hidden sm:block">
                                                <span className={`text-sm font-semibold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{user.name}</span>
                                                <span className={`text-xs block ${isMobile ? 'text-white/70' : 'text-muted'}`}>{getRoleName(user.role)}</span>
                                            </div>
                                            <ChevronDown className={`h-4 w-4 ${isMobile ? 'text-white/70' : 'text-muted'}`} />
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
                                )}
                            </div>
                        </div>
                    </div>
                </div>
        </header>
    );
};

export default Header;
