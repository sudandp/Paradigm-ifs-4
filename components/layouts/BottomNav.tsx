import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Calendar, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUiSettingsStore } from '../../store/uiSettingsStore';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const { setIsPanelOpen, unreadCount } = useNotificationStore();
    const { setReferralModalOpen } = useUiSettingsStore();
    const [showReferBadge, setShowReferBadge] = useState(true);

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

    const handleQuickAction = () => {
        navigate('/attendance/dashboard');
    };

    // Helper to determine if a route is active
    const isActive = (to: string) => {
        if (to === '#notification') return false; 
        return location.pathname === to;
    };

    return (
        <>
        <nav
            className="fixed left-0 right-0 z-40 select-none"
            style={{ bottom: 0, paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
            {/* Pill container — responsive width with horizontal padding that scales on larger phones */}
            <div className="w-full px-3 sm:px-6 max-w-lg mx-auto">
                <div className="w-full bg-[#041b0f]/95 backdrop-blur-xl rounded-[28px] h-[68px] flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 relative px-1">
                    
                    {/* Render first two items */}
                    {navItems.slice(0, 2).map((item) => {
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

                    {/* Center Referral Button — 72px outer ring, 52px inner circle */}
                    <div className="flex-1 flex items-center justify-center h-full relative" style={{ minWidth: 74 }}>
                        <div
                            className="absolute flex items-center justify-center"
                            style={{ top: -36, width: 72, height: 72 }}
                        >
                            {/* "Refer & Earn" Floating Badge & Sparks */}
                            <AnimatePresence>
                                {showReferBadge && (
                                    <>
                                        <motion.div 
                                            className="absolute -top-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] whitespace-nowrap z-50 border border-amber-200/40 flex items-center gap-1 pointer-events-none"
                                            initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                            animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.8 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        >
                                            🧨 REFER & EARN 🎇
                                        </motion.div>

                                        {/* Firecracker Sparks Animation */}
                                        {[...Array(8)].map((_, i) => (
                                            <motion.div
                                                key={`spark-${i}`}
                                                className="absolute w-1.5 h-1.5 rounded-full z-0 pointer-events-none"
                                                style={{ 
                                                    backgroundColor: i % 2 === 0 ? '#fbbf24' : '#f87171',
                                                    boxShadow: i % 2 === 0 ? '0 0 8px #fbbf24' : '0 0 8px #f87171'
                                                }}
                                                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                                                animate={{ 
                                                    opacity: [0, 1, 0],
                                                    scale: [0, 1.5, 0],
                                                    x: [0, Math.cos(i * 45 * (Math.PI / 180)) * 45],
                                                    y: [0, Math.sin(i * 45 * (Math.PI / 180)) * 45],
                                                }}
                                                exit={{ opacity: 0, scale: 0 }}
                                                transition={{ 
                                                    duration: 1.2, 
                                                    repeat: Infinity, 
                                                    repeatDelay: 0.8,
                                                    ease: "easeOut",
                                                    delay: Math.random() * 0.5
                                                }}
                                            />
                                        ))}
                                    </>
                                )}
                            </AnimatePresence>

                            {/* Outer ring — same color as bar, acts as notch border */}
                            <div className="w-[72px] h-[72px] rounded-full bg-[#041b0f] flex items-center justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.4)] relative z-10">
                                {/* Inner green circle — 52px */}
                                <motion.button
                                    onClick={() => setReferralModalOpen(true)}
                                    className="w-[52px] h-[52px] rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 group relative overflow-hidden"
                                    style={{
                                        background: 'radial-gradient(circle at 40% 35%, #1a9a6a, #006b3f 60%, #004d2d)',
                                        boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.15), 0 4px 12px rgba(0,107,63,0.4)',
                                    }}
                                    aria-label="Referral Program"
                                >
                                    <Plus className="text-white w-7 h-7 group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    {/* Render remaining items */}
                    {navItems.slice(2).map((item) => {
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
        </>
    );
};

export default BottomNav;
