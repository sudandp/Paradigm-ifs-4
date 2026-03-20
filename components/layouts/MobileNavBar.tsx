import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { Home, ClipboardCheck, Calendar, User } from 'lucide-react';

// --- Configuration ---
const ICON_SIZE = 24;
const ACTIVE_ICON_SIZE = 24;
const INDICATOR_SIZE = 56;

// --- SVG Path Generator for the "Notch" ---
const generatePath = (width: number, indicatorLeft: number, indicatorWidth: number): string => {
    const notchRadius = INDICATOR_SIZE / 2;
    const barHeight = 64;
    const cornerRadius = 16;
    const notchCenter = indicatorLeft + indicatorWidth / 2;

    const notchStart = notchCenter - notchRadius - 8;
    const notchEnd = notchCenter + notchRadius + 8;
    const controlPointOffset = notchRadius * 0.8;

    return [
        `M 0 ${cornerRadius}`,
        `A ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} 0`,
        `L ${notchStart - cornerRadius} 0`,
        `C ${notchStart - controlPointOffset} 0, ${notchCenter - notchRadius} ${barHeight * 0.6}, ${notchCenter} ${barHeight * 0.6}`,
        `C ${notchCenter + notchRadius} ${barHeight * 0.6}, ${notchEnd + controlPointOffset} 0, ${notchEnd + cornerRadius} 0`,
        `L ${width - cornerRadius} 0`,
        `A ${cornerRadius} ${cornerRadius} 0 0 1 ${width} ${cornerRadius}`,
        `L ${width} ${barHeight}`,
        `L 0 ${barHeight}`,
        `Z`
    ].join(' ');
};

const MobileNavBar: React.FC = () => {
    const location = useLocation();
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navRef = useRef<HTMLElement>(null);
    const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
    const [pathD, setPathD] = useState('');
    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0, transform: 'translateX(-100px)' });

    // --- Define Your Navigation Items Here ---
    const navItems = useMemo(() => {
        if (!user) return [];
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

        const allItems = [
            { key: 'home', to: '/mobile-home', label: 'Home', icon: Home, end: true, permission: 'view_mobile_nav_home' },
            { key: 'attendance', to: '/attendance/dashboard', label: 'Attendance', icon: Calendar, permission: 'view_mobile_nav_attendance' },
            { key: 'tasks', to: '/tasks', label: 'Tasks', icon: ClipboardCheck, permission: 'view_mobile_nav_tasks' },
            { key: 'profile', to: '/profile', label: 'Profile', icon: User, permission: 'view_mobile_nav_profile' },
        ];

        return allItems.filter(item => userPermissions.includes(item.permission as any));
    }, [user, permissions]);

    // --- Active Tab Logic ---
    const activeItemPath = useMemo(() => {
        const path = location.pathname;
        const linkItems = navItems.filter(item => item.to);
        const sortedNavItems = [...linkItems].sort((a, b) => b.to!.length - a.to!.length);
        return sortedNavItems.find(item => item.end ? path === item.to : path.startsWith(item.to!))?.to;
    }, [location.pathname, navItems]);

    // --- Animation Effect ---
    useEffect(() => {
        const updateActiveState = () => {
            if (!navRef.current) return;
            const activeNode = activeItemPath ? itemRefs.current.get(activeItemPath) : null;
            const navRect = navRef.current.getBoundingClientRect();

            if (!activeNode) {
                setIndicatorStyle({ opacity: 0, transform: 'translateX(-100px)' });
                setPathD(generatePath(navRect.width, -100, 0));
                return;
            }

            const { offsetLeft, clientWidth } = activeNode;
            setIndicatorStyle({
                opacity: 1,
                width: `${INDICATOR_SIZE}px`,
                height: `${INDICATOR_SIZE}px`,
                transform: `translateX(${offsetLeft + clientWidth / 2 - INDICATOR_SIZE / 2}px) translateY(-50%)`,
            });
            setPathD(generatePath(navRect.width, offsetLeft, clientWidth));
        };

        const timer = setTimeout(updateActiveState, 50);
        window.addEventListener('resize', updateActiveState);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateActiveState);
        };
    }, [activeItemPath]);

    return (
        <nav ref={navRef} className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ height: `calc(4rem + env(safe-area-inset-bottom))` }}>
            <div className="relative w-full h-full">

                {/* Floating Indicator Circle */}
                <div style={indicatorStyle} className="absolute top-0 left-0 bg-accent rounded-full transition-all duration-300 ease-in-out shadow-lg">
                    {navItems.map(item => {
                        if (!item.to) return null;
                        const isActive = activeItemPath === item.to;
                        return (
                            <div key={`${item.key}-icon`} className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                                <item.icon style={{ width: ACTIVE_ICON_SIZE, height: ACTIVE_ICON_SIZE }} className="text-white" />
                            </div>
                        )
                    })}
                </div>

                {/* Navigation Links */}
                <div className="absolute top-0 left-0 right-0 h-16 flex justify-around items-center z-10 !bg-transparent">
                    {navItems.map((item) => {
                        const isActive = activeItemPath === item.to;
                        return (
                            <NavLink
                                key={item.key}
                                to={item.to!}
                                end={item.end}
                                ref={(el) => { if (el) itemRefs.current.set(item.to!, el); }}
                                className="flex flex-col items-center justify-center w-16 h-16 transition-all duration-300 ease-in-out !bg-transparent !border-none !outline-none"
                                style={{ transform: isActive ? 'translateY(-8px)' : 'translateY(0)' }}
                            >
                                <item.icon style={{ width: ICON_SIZE, height: ICON_SIZE }} className={`transition-opacity duration-200 ${isActive ? 'opacity-0' : 'opacity-100 text-white'}`} />
                            </NavLink>
                        )
                    })}
                </div>
            </div>
        </nav>
    );
};

export default MobileNavBar;
