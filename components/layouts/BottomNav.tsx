import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Calendar, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const { setIsPanelOpen, unreadCount } = useNotificationStore();

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
            label: 'My Pickup',
            icon: ClipboardCheck,
            show: userPermissions.includes('view_mobile_nav_tasks' as any)
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

    const handleQuickAction = () => {
        navigate('/attendance/dashboard');
    };

    // Helper to determine if a route is active
    const isActive = (to: string) => {
        if (to === '#notification') return false; // Handled by state usually, but for indicator we'll treat as inactive or handle separately
        return location.pathname === to;
    };

    return (
        <nav
            className="fixed left-0 right-0 z-40 select-none"
            style={{ bottom: 0, paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
            {/* Pill container — responsive width with horizontal padding that scales on larger phones */}
            <div className="w-full px-3 sm:px-6 max-w-lg mx-auto">
                <div className="w-full bg-[#041b0f]/95 backdrop-blur-xl rounded-[28px] h-[68px] flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden px-1">

                    {navItems.map((item) => {
                        const active = isActive(item.to);
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className="relative flex-1 flex items-center justify-center h-full"
                            >
                                <div className="relative flex items-center justify-center">
                                    <AnimatePresence>
                                        {active && (
                                            <motion.div
                                                layoutId="activePill"
                                                className="absolute inset-0 bg-[#dcfce7] rounded-full z-0"
                                                style={{ padding: '0 12px' }}
                                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                            />
                                        )}
                                    </AnimatePresence>

                                    <div className="relative z-10 flex items-center gap-1.5 px-3 py-2">
                                        <item.icon
                                            className={`transition-colors duration-300 ${
                                                active ? 'text-[#041b0f]' : 'text-[#22c55e]'
                                            }`}
                                            style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)' }}
                                        />
                                        {active && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: 'auto' }}
                                                exit={{ opacity: 0, width: 0 }}
                                                className="text-[11px] font-bold text-[#041b0f] tracking-tight whitespace-nowrap overflow-hidden"
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </div>
                                </div>
                            </NavLink>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default BottomNav;
