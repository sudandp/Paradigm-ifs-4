import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { 
    Bell, 
    UserPlus, 
    AlertTriangle, 
    ClipboardCheck, 
    Shield, 
    Info, 
    Sun, 
    Check, 
    MoreHorizontal,
    Inbox,
    Clock,
    ArrowLeft,
    MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import type { Notification, NotificationType } from '../../types';

const NotificationIcon: React.FC<{ type: NotificationType; size?: string }> = ({ type, size = "h-5 w-5" }) => {
    const iconMap: Record<NotificationType, React.ElementType> = {
        task_assigned: UserPlus,
        task_escalated: AlertTriangle,
        provisional_site_reminder: ClipboardCheck,
        security: Shield,
        info: Info,
        warning: AlertTriangle,
        greeting: Sun,
        approval_request: ClipboardCheck,
        emergency_broadcast: AlertTriangle,
        direct_ping: MessageSquare,
        emergency: AlertTriangle,
    };

    const bgMap: Record<NotificationType, string> = {
        task_assigned: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        task_escalated: 'bg-amber-50 text-amber-600 border-amber-100',
        provisional_site_reminder: 'bg-purple-50 text-purple-600 border-purple-100',
        security: 'bg-rose-50 text-rose-600 border-rose-100',
        info: 'bg-sky-50 text-sky-600 border-sky-100',
        warning: 'bg-amber-50 text-amber-600 border-amber-100',
        greeting: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        approval_request: 'bg-orange-50 text-orange-600 border-orange-100',
        emergency_broadcast: 'bg-red-50 text-red-600 border-red-100',
        direct_ping: 'bg-blue-50 text-blue-600 border-blue-100',
        emergency: 'bg-red-50 text-red-600 border-red-100',
    };

    const Icon = iconMap[type] || Bell;
    const styleClasses = bgMap[type] || 'bg-gray-50 text-gray-500 border-gray-100';
    
    return (
        <div className={`flex-shrink-0 p-2 rounded-xl border ${styleClasses} transition-colors group-hover:scale-110 duration-300`}>
            <Icon className={size} />
        </div>
    );
};

const NotificationBell: React.FC<{ className?: string; theme?: 'light' | 'dark' }> = ({ className = '', theme = 'light' }) => {
    const { totalUnreadCount, togglePanel, isPanelOpen } = useNotificationStore();

    const isDark = theme === 'dark';

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={togglePanel}
                aria-label={`Notifications${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread` : ''}`}
                className={`group relative p-2 rounded-xl transition-all duration-300 flex items-center justify-center ${
                    isPanelOpen
                        ? isDark
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-gray-100 text-gray-700'
                        : isDark
                            ? 'bg-transparent text-emerald-400/80 hover:bg-emerald-500/5 hover:text-emerald-400'
                            : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
            >
                <Bell 
                    strokeWidth={2}
                    className={`h-5 w-5 transition-transform duration-300 ${isPanelOpen ? 'scale-110' : 'group-hover:rotate-12'}`} 
                />
                <AnimatePresence>
                    {totalUnreadCount > 0 && (
                        <motion.span 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ 
                                scale: 1, 
                                opacity: 1,
                                transition: { type: "spring", stiffness: 500, damping: 25 }
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute -top-0.5 right-0 flex z-20"
                        >
                            <motion.span 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.25, 0.6] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute inline-flex h-full w-full rounded-full bg-rose-400"
                            />
                            <span className={`relative inline-flex items-center justify-center rounded-full bg-rose-600 text-white font-bold leading-none shadow-md border-2 ${
                                isDark ? 'border-[#041b0f]' : 'border-white'
                            } ${
                                totalUnreadCount > 9 
                                ? 'px-1 h-4 min-w-[18px] text-[9px]' 
                                : 'w-4 h-4 text-[9px]'
                            }`}>
                                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                            </span>
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>
        </div>
    );
};

export default NotificationBell;