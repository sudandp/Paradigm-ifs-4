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
            className="fixed bottom-6 left-4 right-4 z-40 select-none"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="max-w-md mx-auto bg-[#041b0f]/95 backdrop-blur-xl rounded-[32px] h-[72px] flex items-center justify-between px-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden">
                
                {/* Navigation Items Section */}
                <div className="flex-1 flex justify-around items-center h-full px-2">
                    {navItems.map((item) => {
                        const active = isActive(item.to);
                        return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className="relative flex items-center justify-center p-2 rounded-full transition-all duration-300"
                                >
                                    <AnimatePresence>
                                        {active && (
                                            <motion.div
                                                layoutId="activePill"
                                                className="absolute inset-0 bg-[#dcfce7] rounded-full z-0"
                                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                            />
                                        )}
                                    </AnimatePresence>
                                    
                                    <div className="relative z-10 flex items-center gap-2 px-2">
                                        <item.icon 
                                            className={`w-6 h-6 transition-colors duration-300 ${
                                                active ? 'text-[#041b0f]' : 'text-[#22c55e]'
                                            }`} 
                                        />
                                        {active && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -5 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="text-[11px] font-bold text-[#041b0f] tracking-tight whitespace-nowrap"
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
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
