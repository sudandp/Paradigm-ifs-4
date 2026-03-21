

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, ShieldCheck, LayoutDashboard, ClipboardCheck, Map as MapIcon, ClipboardList, User, Briefcase, ListTodo, Building, Users, Shirt, Settings, GitBranch, Calendar, CalendarCheck2, ShieldHalf, FileDigit, GitPullRequest, Home, BriefcaseBusiness, UserPlus, IndianRupee, PackagePlus, LifeBuoy, MapPin, ArrowLeft, Navigation, Cpu, FileText, Smartphone, Baby } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import Logo from '../ui/Logo';
import type { Permission } from '../../types';
import Button from '../ui/Button';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useDevice } from '../../hooks/useDevice';
import { isAdmin } from '../../utils/auth';
import Header from './Header';
import { NotificationPanel } from '../notifications/NotificationPanel';
import BreakTrackingMonitor from '../attendance/BreakTrackingMonitor';
import { useSettingsStore } from '../../store/settingsStore';
import { PingAlarmOverlay } from '../notifications/PingAlarmOverlay';

export interface NavLinkConfig {
    to: string;
    label: string;
    icon: React.ElementType;
    permission: Permission;
}

// All links are defined here, and filtered by role below.
export const allNavLinks: NavLinkConfig[] = [
    { to: '/verification/dashboard', label: 'All Submissions', icon: LayoutDashboard, permission: 'view_all_submissions' },
    { to: '/developer/api', label: 'API Settings', icon: Settings, permission: 'view_developer_settings' },
    { to: '/attendance/dashboard', label: 'Attendance', icon: Calendar, permission: 'view_own_attendance' },
    { to: '/hr/attendance-settings', label: 'Attendance Rules', icon: CalendarCheck2, permission: 'manage_attendance_rules' },
    { to: '/hr/notification-management', label: 'Notifications Control', icon: Bell, permission: 'manage_attendance_rules' },
    { to: '/support', label: 'Backend Support', icon: LifeBuoy, permission: 'access_support_desk' },
    { to: '/hr/entity-management', label: 'Client Management', icon: Briefcase, permission: 'view_entity_management' },
    { to: '/hr/enrollment-rules', label: 'Enrollment Rules', icon: ClipboardCheck, permission: 'manage_enrollment_rules' },
    { to: '/hr/policies-and-insurance', label: 'Policies & Insurance', icon: ShieldHalf, permission: 'manage_policies' },
    { to: '/billing/summary', label: 'Invoice Summary', icon: FileDigit, permission: 'view_invoice_summary' },
    { to: '/billing/cost-analysis', label: 'Verification Costing', icon: IndianRupee, permission: 'view_verification_costing' },
    { to: '/finance?tab=attendance', label: 'Tracker', icon: ClipboardList, permission: 'view_attendance_tracker' },
    { to: '/admin/approval-workflow', label: 'Leave Approval Settings', icon: GitBranch, permission: 'manage_approval_workflow' },
    { to: '/hr/leave-management', label: 'Leave Management', icon: GitPullRequest, permission: 'manage_leave_requests' },
    { to: '/hr/family-verification', label: 'Family Verification', icon: Baby, permission: 'manage_attendance_rules' },
    { to: '/admin/modules', label: 'Module Management', icon: PackagePlus, permission: 'manage_modules' },
    { to: '/onboarding', label: 'New Enrollment', icon: UserPlus, permission: 'create_enrollment' },
    { to: '/operations/dashboard', label: 'Operations', icon: BriefcaseBusiness, permission: 'view_operations_dashboard' },
    { to: '/my-team', label: 'My Team', icon: Users, permission: 'view_my_team' },
    { to: '/my-team/field-reports', label: 'Field Reports', icon: FileText, permission: 'view_field_reports' },
    { to: '/profile', label: 'My Account', icon: User, permission: 'view_profile' },
    { to: '/admin/roles', label: 'Role Management', icon: ShieldCheck, permission: 'manage_roles_and_permissions' },
    { to: '/site/dashboard', label: 'Site Dashboard', icon: Home, permission: 'view_site_dashboard' },
    { to: '/admin/sites', label: 'Site Management', icon: Building, permission: 'manage_sites' },
    { to: '/tasks', label: 'Task Management', icon: ListTodo, permission: 'manage_tasks' },
    { to: '/uniforms', label: 'Uniform Management', icon: Shirt, permission: 'manage_uniforms' },
    { to: '/admin/users', label: 'User Management', icon: Users, permission: 'manage_users' },
    { to: '/admin/devices', label: 'Biometric Devices', icon: Cpu, permission: 'manage_biometric_devices' },
    { to: '/hr/field-staff-tracking', label: 'User Activity Tracking', icon: MapIcon, permission: 'view_field_staff_tracking' },
    // Manage geofenced locations for attendance
    { to: '/hr/locations', label: 'Geo Locations', icon: MapPin, permission: 'manage_geo_locations' },
    // User‑specific geofencing management
    { to: '/attendance/locations', label: 'My Locations', icon: Navigation, permission: 'view_my_locations' },
    // Device Management
    { to: '/settings/devices', label: 'Linked Devices', icon: Smartphone, permission: 'view_profile' },
    { to: '/admin/device-approvals', label: 'Device Approvals', icon: ShieldCheck, permission: 'manage_users' },
];


const SidebarContent: React.FC<{ isCollapsed: boolean, onLinkClick?: () => void, onExpand?: () => void, hideHeader?: boolean, mode?: 'light' | 'dark', isMobile?: boolean }> = React.memo(({ isCollapsed, onLinkClick, onExpand, hideHeader = false, mode = 'light', isMobile = false }) => {
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();

    const userPermissions = useMemo(() => {
        if (!user || !permissions) return [];
        const roleId = user.roleId?.toLowerCase() || '';
        const roleName = user.role?.toLowerCase() || '';
        const roleNameUnderscore = roleName.replace(/\s+/g, '_');

        return permissions[roleId] || 
               permissions[roleName] || 
               permissions[roleNameUnderscore] || 
               permissions[user.role] || 
               [];
    }, [user, permissions]);

    const availableNavLinks = useMemo(() => {
        if (!user) return [];
        return allNavLinks
            .filter(link => isAdmin(user.role) || userPermissions.includes(link.permission))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [user, userPermissions]);

    const handleLinkClick = useCallback((e: React.MouseEvent) => {
        // Log the click for debugging
        console.log('[Sidebar] Link clicked');

        // If collapsed, we still want to expand it for visual feedback
        if (isCollapsed && onExpand) {
            onExpand();
        }

        // We no longer call e.preventDefault() here. 
        // This allows the NavLink to navigate immediately on the first click.
        
        // On mobile, we also want to close the sidebar overlay after a link is clicked
        if (onLinkClick) {
            onLinkClick();
        }
    }, [isCollapsed, onExpand, onLinkClick]);

    return (
        <div className="flex flex-col">
            {hideHeader && isCollapsed && (
                <div className="p-4 border-b border-[#1f3d2b] bg-[#041b0f] flex justify-center h-16 items-center transition-all duration-300 flex-shrink-0">
                    <button onClick={() => window.location.href = '/#/profile'} className="btn-icon inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-white/10 focus:outline-none" aria-label="Go to profile page">
                        <span className="sr-only">Go to profile</span>
                        <ArrowLeft className="block h-6 w-6" />
                    </button>
                </div>
            )}
            {hideHeader && !isCollapsed && (
                <div className="p-4 border-b border-[#1f3d2b] bg-[#041b0f] flex justify-center h-16 items-center transition-all duration-300 flex-shrink-0">
                    {/* Empty header - just background color */}
                </div>
            )}
            {!hideHeader && (
                <div className={`p-4 border-b flex justify-center h-16 items-center transition-all duration-300 flex-shrink-0 ${mode === 'dark' ? 'bg-[#041b0f] border-[#1f3d2b]' : 'bg-white border-gray-200'}`}>
                    {isCollapsed ? (
                        <div className="h-8 w-8 overflow-hidden">
                            <Logo className="h-8 max-w-none object-left object-cover" />
                        </div>
                    ) : (
                        <Logo />
                    )}
                </div>
            )}
            <nav className="px-3 py-4 space-y-2">
                {availableNavLinks.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={handleLinkClick}
                        className={({ isActive }) =>
                            `group flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center' : ''} ${mode === 'light'
                                ? isActive
                                    ? 'text-white shadow-sm border'
                                    : 'text-gray-500 hover:bg-gray-100/60 hover:text-gray-900'
                                : isActive
                                    ? 'bg-[#1c3a23] text-white shadow-sm border border-white/5'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`
                        }
                        style={({ isActive }) => {
                            if (!isActive) return {};
                            return mode === 'light'
                                ? { backgroundColor: '#006B3F', borderColor: '#005632' }
                                : {}; // Dark mode bg is handled by class
                        }}
                        title={link.label}
                    >
                        {({ isActive }) => (
                            <>
                                <link.icon
                                    className={`h-5 w-5 flex-shrink-0 transition-all duration-200 ${mode === 'light'
                                        ? isActive ? 'text-white/90' : 'text-gray-400/80 group-hover:text-gray-500'
                                        : isActive ? 'text-white/90' : 'text-white/60 group-hover:text-white/90'
                                        } ${isCollapsed ? '' : 'mr-3'}`}
                                />
                                {!isCollapsed && <span>{link.label}</span>}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
});


const MainLayout: React.FC = () => {
    const { user } = useAuthStore();
    const { fetchNotifications, isPanelOpen, setIsPanelOpen } = useNotificationStore();
    const { permissions } = usePermissionsStore();
    const { autoScrollOnHover } = useUiSettingsStore();
    const location = useLocation();
    const { isMobile, isTablet, isDesktop } = useDevice();
    const settingsStore = useSettingsStore();
    const appVersion = settingsStore.apiSettings.appVersion || '1.0.0';

    const mainContentRef = useRef<HTMLDivElement>(null);
    const pageScrollIntervalRef = useRef<number | null>(null);

    // Initialize sidebar state based on device type. 
    // On mobile/tablet, start collapsed (true). On desktop, start expanded (false).
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(isDesktop);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update sidebar state when switching between mobile/desktop/tablet
    useEffect(() => {
        // Collapse sidebar if mobile
        setIsSidebarExpanded(isDesktop);
    }, [isDesktop]);

    const handleMouseEnter = useCallback(() => {
        if (isMobile) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setIsSidebarExpanded(true);
        }, 50); // Small 50ms debounce for smoother feel
    }, [isMobile]);

    const handleMouseLeave = useCallback(() => {
        if (isMobile) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsSidebarExpanded(false);
    }, [isMobile]);

    const stopPageScrolling = useCallback(() => {
        if (pageScrollIntervalRef.current !== null) {
            clearInterval(pageScrollIntervalRef.current);
            pageScrollIntervalRef.current = null;
        }
    }, []);

    const startPageScrolling = useCallback((direction: 'up' | 'down') => {
        stopPageScrolling();
        const mainEl = mainContentRef.current;
        if (!mainEl) return;

        const scroll = () => {
            mainEl.scrollBy({ top: direction === 'up' ? -window.innerHeight * 0.8 : window.innerHeight * 0.8, behavior: 'smooth' });
        };
        scroll(); // immediate scroll
        pageScrollIntervalRef.current = window.setInterval(scroll, 300);
    }, [stopPageScrolling]);


    useEffect(() => {
        const handleScroll = () => {
            const mainEl = mainContentRef.current;
            if (mainEl) {
                setShowScrollButtons(mainEl.scrollHeight > mainEl.clientHeight);
                setScrollPosition(mainEl.scrollTop);
            }
        };

        const mainEl = mainContentRef.current;
        mainEl?.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);

        // Initial check
        handleScroll();

        return () => {
            mainEl?.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
            stopPageScrolling();
        };
    }, [stopPageScrolling]);


    useEffect(() => {
        if (user) {
            fetchNotifications();
            const unsubscribe = useNotificationStore.getState().subscribeToNotifications();
            return () => unsubscribe();
        }
    }, [user, fetchNotifications]);

    if (!user) {
        return <Navigate to="/auth/login" replace />;
    }

    return (
        // Use responsive padding and gap values to improve layout on small screens. Previously the layout used fixed
        // `p-8 gap-8`, which caused the sidebar and main content to squeeze on narrow viewports. Now we apply
        // progressively larger spacing on wider screens while keeping things compact on mobile. The `min-h-screen`
        // ensures the container grows as needed instead of forcing a fixed height.
        <div className={`flex min-h-screen overflow-hidden ${isMobile ? 'bg-[#041b0f]' : 'bg-page'} ${!isMobile ? 'p-4 md:p-4 lg:p-8 gap-4 md:gap-4 lg:gap-8' : ''}`}>

            {isMobile && !isSidebarExpanded && (
                <div
                    className="fixed inset-0 bg-black/50 z-[45] transition-opacity duration-300"
                    onClick={() => setIsSidebarExpanded(true)}
                />
            )}

            {/* Backdrop for notifications on mobile/tablet */}
            {(isMobile || isTablet) && isPanelOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[95] transition-opacity duration-300"
                    onClick={() => setIsPanelOpen(false)}
                />
            )}

            {/* Sidebar - Overlay on mobile, fixed on desktop */}
            <aside 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`flex flex-col flex-shrink-0 transition-[width] duration-300 cubic-bezier(0.4,0,0.2,1) will-change-[width] ${isMobile ? (!isSidebarExpanded ? 'w-16' : 'w-64') : (isTablet ? (!isSidebarExpanded ? 'w-16' : 'w-56') : (!isSidebarExpanded ? 'w-16' : 'w-60'))} ${isMobile ? 'bg-[#041b0f]' : 'bg-white border-r border-gray-200/60'} ${isMobile ? 'fixed left-0 top-0 bottom-0 z-50' : ''}`}
            >
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <SidebarContent
                        isCollapsed={!isSidebarExpanded}
                        mode={isMobile ? "dark" : "light"}
                        onLinkClick={() => setIsSidebarExpanded(false)}
                        onExpand={() => setIsSidebarExpanded(true)}
                        hideHeader={isMobile}
                        isMobile={isMobile}
                    />
                </div>
                <div className={`flex-shrink-0 px-2 py-4 mt-auto flex flex-col items-center gap-2 ${isMobile ? 'border-t border-transparent' : 'border-t border-border'}`}>
                    {isSidebarExpanded && (
                        <div className={`text-[11px] font-medium tracking-wider uppercase opacity-40 transition-all duration-300 animate-fade-in ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                            v{appVersion}
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        className={`w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200 ${isMobile ? 'text-white/70 hover:bg-white/10' : 'text-muted hover:bg-page active:scale-95'}`}
                        title={!isSidebarExpanded ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {!isSidebarExpanded ? (
                            <div className="flex flex-col items-center gap-1.5 font-bold">
                                <ChevronsRight className="h-5 w-5" />
                                <span className="text-[8px] tracking-tighter uppercase opacity-30">v{appVersion}</span>
                            </div>
                        ) : (
                            <ChevronsLeft className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </aside>

            <div className={`flex-1 flex flex-col ${isMobile ? 'bg-[#041b0f]' : 'bg-gray-50/50'} ${isMobile && !isSidebarExpanded ? 'ml-16' : ''}`}>
                <Header />
                <BreakTrackingMonitor />

                {/* Main Content */}
                <main ref={mainContentRef} className={`flex-1 overflow-y-auto ${isMobile ? 'bg-[#041b0f]' : 'bg-page'}`}>
                    <div className={`${isTablet ? 'p-1' : 'p-4'}`}>
                        {/* Bordered Card Container removed to fix white screen issue */}
                        <Outlet />
                    </div>
                </main>

            </div>

            <PingAlarmOverlay />

            {/* Notification Sidebar - Desktop (> 1024px) */}
            {isDesktop && isPanelOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[95] transition-opacity duration-300"
                        onClick={() => setIsPanelOpen(false)}
                    />
                    <aside className="fixed inset-y-0 right-0 z-[100] w-[400px] flex-shrink-0 bg-white shadow-xl animate-slide-in-right">
                        <NotificationPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} isMobile={false} />
                    </aside>
                </>
            )}

            {/* Notification Overlay - Mobile & Tablet */}
            {(isMobile || isTablet) && isPanelOpen && (
                <div className={`fixed inset-y-0 right-0 z-[100] animate-slide-in-right ${isMobile ? 'w-full' : 'w-[400px]'}`}>
                    <NotificationPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} isMobile={isMobile} />
                </div>
            )}
            {/* Scroll-to-top/bottom buttons */}
            {showScrollButtons && !isMobile && (
                <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2 no-print">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="!rounded-full !p-2 shadow-lg"
                        onMouseEnter={autoScrollOnHover ? () => startPageScrolling('up') : undefined}
                        onMouseLeave={stopPageScrolling}
                        onMouseDown={() => startPageScrolling('up')}
                        onMouseUp={stopPageScrolling}
                        onTouchStart={() => startPageScrolling('up')}
                        onTouchEnd={stopPageScrolling}
                        disabled={scrollPosition <= 0}
                        aria-label="Scroll Up"
                    >
                        <ChevronUp className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="!rounded-full !p-2 shadow-lg"
                        onMouseEnter={autoScrollOnHover ? () => startPageScrolling('down') : undefined}
                        onMouseLeave={stopPageScrolling}
                        onMouseDown={() => startPageScrolling('down')}
                        onMouseUp={stopPageScrolling}
                        onTouchStart={() => startPageScrolling('down')}
                        onTouchEnd={stopPageScrolling}
                        disabled={mainContentRef.current ? Math.ceil(mainContentRef.current.clientHeight + scrollPosition) >= mainContentRef.current.scrollHeight : false}
                        aria-label="Scroll Down"
                    >
                        <ChevronDown className="h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MainLayout;
