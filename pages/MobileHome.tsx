import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { allNavLinks } from '../components/layouts/MainLayout';
import { LogOut, ArrowRight, Sparkles } from 'lucide-react';
import { ProfilePlaceholder } from '../components/ui/ProfilePlaceholder';
import { isAdmin } from '../utils/auth';

const MobileHome: React.FC = () => {
    const { user, logout } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();

    if (!user) return null;

    // Robust permission lookup that handles role naming variations
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

    // Filter links based on user permissions (admins see everything)
    const availableLinks = user ? allNavLinks
        .filter(link => isAdmin(user.role) || userPermissions.includes(link.permission))
        .sort((a, b) => a.label.localeCompare(b.label))
        : [];

    const handleLogout = () => {
        navigate('/auth/logout');
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <div className="min-h-[calc(100vh-180px)] flex flex-col pb-10 bg-[#041b0f]">
            {/* Premium Greeting Section */}
            <div className="relative overflow-hidden pt-8 pb-10 px-6 bg-gradient-to-br from-[#0a2f1c] to-[#041b0f] rounded-b-[40px] shadow-2xl -mx-4 mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] -ml-24 -mb-24 pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <ProfilePlaceholder photoUrl={user.photoUrl} seed={user.id} className="h-16 w-16 rounded-full border-2 border-emerald-500/30 shadow-emerald-500/20 shadow-lg" />
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 h-4 w-4 rounded-full border-2 border-[#0a2f1c] shadow-sm" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white">Security Uplink Active</span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight -mt-1">
                                Hi, {user.name.split(' ')[0]}
                            </h1>
                            <p className="text-[11px] text-emerald-100/40 font-bold uppercase tracking-[0.2em]">{user.role.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="flex-1 flex flex-col px-2">
                <div className="flex items-center justify-between mb-5 px-3">
                    <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-white/40">Apps & Features</h2>
                    <div className="h-[1px] flex-1 bg-white/[0.05] ml-4" />
                </div>

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-3 gap-3 flex-1 content-start"
                >
                    <AnimatePresence>
                        {availableLinks.map((link) => (
                            <motion.div
                                key={link.to}
                                variants={itemVariants}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => navigate(link.to)}
                                className="group flex flex-col items-center justify-center p-4 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[28px] transition-all duration-300 shadow-xl min-h-[110px]"
                            >
                                <div className="p-3 bg-white/[0.05] rounded-2xl mb-2.5 text-emerald-500 group-active:text-white transition-colors duration-300 shadow-inner">
                                    <link.icon className="w-6 h-6" strokeWidth={2.2} />
                                </div>
                                <span className="text-[10px] text-center text-white/60 group-active:text-white font-bold leading-tight px-1 uppercase tracking-wider">{link.label}</span>
                            </motion.div>
                        ))}

                        {/* Integrated Logout Tile */}
                        <motion.div
                            variants={itemVariants}
                            whileTap={{ scale: 0.92 }}
                            onClick={handleLogout}
                            className="group flex flex-col items-center justify-center p-4 bg-rose-500/10 backdrop-blur-xl border border-rose-500/20 rounded-[28px] transition-all duration-300 shadow-xl min-h-[110px]"
                        >
                            <div className="p-3 bg-rose-500/20 rounded-2xl mb-2.5 text-rose-500 shadow-inner">
                                <LogOut className="w-6 h-6" strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] text-center text-rose-500/70 font-black leading-none uppercase tracking-widest">Exit</span>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};

export default MobileHome;
