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
    };

    const Icon = iconMap[type] || Bell;
    const styleClasses = bgMap[type] || 'bg-gray-50 text-gray-500 border-gray-100';
    
    return (
        <div className={`flex-shrink-0 p-2 rounded-xl border ${styleClasses} transition-colors group-hover:scale-110 duration-300`}>
            <Icon className={size} />
        </div>
    );
};

const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { totalUnreadCount, togglePanel, isPanelOpen } = useNotificationStore();

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={togglePanel}
                className={`group relative p-2.5 rounded-xl transition-all duration-300 btn-icon ${
                    isPanelOpen 
                    ? 'bg-accent/10 text-accent ring-2 ring-accent/20' 
                    : 'bg-transparent text-accent md:text-muted hover:bg-page hover:text-primary-text'
                }`}
            >
                <Bell className={`h-5 w-5 transition-transform duration-300 ${isPanelOpen ? 'scale-110' : 'group-hover:rotate-12'}`} />
                {totalUnreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[10px] items-center justify-center font-bold text-white shadow-lg border border-white">
                            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                        </span>
                    </span>
                )}
            </button>
        </div>
    );
};

export default NotificationBell;