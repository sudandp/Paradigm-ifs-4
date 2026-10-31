import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Calendar, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useAuthStore } from '../../store/authStore';
import { useUiSettingsStore } from '../../store/uiSettingsStore';

const BottomNav: React.FC = () => {
    const location = useLocation();
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const { setReferralModalOpen } = useUiSettingsStore();
    const [showReferBadge] = useState(true);

    if (!user) return null;

    const getPermissions = () => {
        if (!user || !permissions) return [];
        const roleId = user.roleId?.toLowerCase() || '';
        const roleName = user.role?.toLowerCase() || '';
        const roleNameUnderscore = roleName.replace(/\s+/g, '_');

        return permissions[roleId] || 
               permissions[roleName] || 
               permissions[roleNameUnderscore] || 
               permissions[user.role] || 
               [];
    };

    const userPermissions = getPermissions();

    const navItems = [
        {
            to: '/mobile-home',
            label: 'Home',
            icon: Home,
            show: userPermissions.includes('view_mobile_nav_home' as any)
        },
        {
            to: '/tasks',
            label: 'Tasks',
            icon: ClipboardCheck,
            show: true
        },
        {
            to: '/leaves/dashboard',
            label: 'Leaves',
            icon: Calendar,
            show: true
        },
        {
            to: '/profile',
            label: 'Profile',
            icon: User,
            show: userPermissions.includes('view_mobile_nav_profile' as any)
        }
    ].filter(item => item.show);

    // Helper to determine if a route is active
    const isActive = (to: string) => {
        if (to === '#notification') return false; 
        if (to === '/leaves/dashboard') {
            return location.pathname === '/leaves' || location.pathname.startsWith('/leaves');
        }
        if (to === '/tasks') {
            return location.pathname === '/tasks' || location.pathname.startsWith('/tasks');
        }
        if (to === '/profile') {
            return location.pathname === '/profile' || location.pathname.startsWith('/profile');
        }
        if (to === '/mobile-home') {
            return location.pathname === '/mobile-home' || location.pathname === '/' || location.pathname === '/home';
        }
        return location.pathname === to;
    };

    const renderNavItem = (item: typeof navItems[0]) => {
        const active = isActive(item.to);
        return (
            <NavLink
                key={item.to}
                to={item.to}
                className="relative flex-1 flex items-center justify-center h-full"
            >
                <div className="relative flex items-center justify-center">
                    {active && (
                        <motion.div
                            layoutId="activePill"
                            className="absolute inset-0 bg-[#065f46] border border-emerald-500/40 rounded-full z-0 shadow-[0_2px_8px_rgba(6,95,70,0.4)]"
                            style={{ padding: '0 12px' }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                    )}

                    <div className="relative z-10 flex items-center gap-1.5 px-3 py-2">
                        <item.icon
                            className={`transition-colors duration-300 ${
                                active ? 'text-emerald-50' : 'text-[#7D967B]'
                            }`}
                            style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)' }}
                        />
                        <AnimatePresence>
                            {active && (
                                <motion.span
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    className="text-[11px] font-bold text-white tracking-tight whitespace-nowrap overflow-hidden"
                                >
                                    {item.label}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </NavLink>
        );
    };

    return (
        <>
        <nav
            className="fixed left-0 right-0 z-40 select-none transition-transform duration-200 [.mobile-sheet-open_&]:hidden"
            style={{ bottom: 0, paddingBottom: 'calc(max(0.6rem, max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px))) + 0.35rem)' }}
        >
            {/* Pill container — responsive width with horizontal padding that scales on larger phones */}
            <div className="w-full px-3 sm:px-6 max-w-lg mx-auto">
                <div className="w-full bg-[#041b0f]/95 backdrop-blur-xl rounded-[28px] h-[68px] flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.7)] border border-[#1d422f] relative px-1">
                    
                    {/* Render first two items */}
                    {navItems.slice(0, 2).map(renderNavItem)}

                    {/* Center Referral Button — 72px outer ring, 52px inner circle */}
                    <div className="flex-1 flex items-center justify-center h-full relative" style={{ minWidth: 74 }}>
                        <div
                            className="absolute flex items-center justify-center"
                            style={{ top: -36, width: 72, height: 72 }}
                        >
                            {/* "Refer & Earn" Floating Badge - Lightweight CSS glow */}
                            <AnimatePresence>
                                {showReferBadge && (
                                    <div 
                                        className="absolute -top-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] whitespace-nowrap z-50 border border-amber-200/40 flex items-center gap-1 pointer-events-none animate-pulse"
                                    >
                                        🧨 REFER & EARN 🎇
                                    </div>
                                )}
                            </AnimatePresence>

                            {/* Outer ring — same color as bar, acts as notch border */}
                            <div className="w-[72px] h-[72px] rounded-full bg-[#041b0f] border border-[#1d422f] flex items-center justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.5)] relative z-10">
                                {/* Inner green circle — 52px */}
                                <motion.button
                                     onClick={() => setReferralModalOpen(true)}
                                     className="w-[52px] h-[52px] rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 group relative overflow-hidden border border-emerald-500/40"
                                     style={{
                                         background: 'radial-gradient(circle at 40% 35%, #059669, #065f46 60%, #064e3b)',
                                         boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.25), 0 4px 14px rgba(6,95,70,0.5)',
                                     }}
                                     aria-label="Referral Program"
                                 >
                                     <Plus className="text-white w-7 h-7 group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
                                 </motion.button>
                            </div>
                        </div>
                    </div>

                    {/* Render remaining items */}
                    {navItems.slice(2).map(renderNavItem)}
                </div>
            </div>
        </nav>
        </>
    );
};

export default BottomNav;
