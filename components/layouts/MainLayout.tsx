import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, ChevronRight, ShieldCheck, ClipboardCheck, Map as MapIcon, ClipboardList, User, Briefcase, ListTodo, Building, Users, Shirt, Settings, GitBranch, Calendar, CalendarCheck2, ShieldHalf, FileDigit, GitPullRequest, Home, BriefcaseBusiness, UserPlus, IndianRupee, PackagePlus, LifeBuoy, MapPin, ArrowLeft, Navigation, Cpu, FileText, Smartphone, Baby, Grid3X3, LayoutDashboard, Target, Ticket, Wrench, FileSignature, Wallet, LineChart, History, CheckCircle2, Calculator, Badge, HeartPulse, Archive, CalendarDays, BarChart, Mail, UserX, LayoutTemplate, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import ReferralModal from '../modals/ReferralModal';

export interface NavLinkConfig {
    to: string;
    label: string;
    icon: React.ElementType;
    permission: Permission;
    category?: string;
}

// All links are defined here, and filtered by role below.
export const allNavLinks: NavLinkConfig[] = [
    // CRM & Sales
    { to: '/crm', label: 'CRM Pipeline', icon: Target, permission: 'view_crm_pipeline', category: 'CRM & Sales' },
    { to: '/crm/checklists', label: 'Checklist Templates', icon: ClipboardCheck, permission: 'view_crm_checklists', category: 'CRM & Sales' },
    { to: '/referral/management', label: 'Referral Management', icon: Users, permission: 'view_referrals', category: 'CRM & Sales' },

    // Dashboards
    { to: '/site/dashboard', label: 'Site Dashboard', icon: Home, permission: 'view_site_dashboard', category: 'Dashboards' },
    { to: '/operations/dashboard', label: 'Operations', icon: BriefcaseBusiness, permission: 'view_operations_dashboard', category: 'Dashboards' },
    { to: '/verification/dashboard', label: 'All Submissions', icon: LayoutDashboard, permission: 'view_all_submissions', category: 'Dashboards' },

    // Operations Hub (Phase 2)
    { to: '/operations/tickets', label: 'Helpdesk Tickets', icon: Ticket, permission: 'view_operations', category: 'Operations Hub' },
    { to: '/operations/maintenance', label: 'Preventive Maintenance', icon: Wrench, permission: 'view_operations', category: 'Operations Hub' },
    { to: '/operations/contracts', label: 'Contract Manager', icon: FileSignature, permission: 'view_operations', category: 'Operations Hub' },

    // Finance Hub (Phase 3)
    { to: '/finance/profitability', label: 'Profitability', icon: LineChart, permission: 'view_finance_reports', category: 'Finance Hub' },
    { to: '/finance/payments', label: 'Payment Tracker', icon: Wallet, permission: 'view_finance_reports', category: 'Finance Hub' },

    // Enterprise Controls (Phase 4)
    { to: '/enterprise/approvals', label: 'Approvals Inbox', icon: CheckCircle2, permission: 'manage_approval_workflow', category: 'Enterprise Controls' },
    { to: '/enterprise/audit-trail', label: 'Audit Trail', icon: History, permission: 'manage_approval_workflow', category: 'Enterprise Controls' },

    // Attendance Logs
    { to: '/attendance/dashboard', label: 'Attendance', icon: Calendar, permission: 'view_own_attendance', category: 'Attendance Logs' },
    { to: '/finance?tab=attendance', label: 'Tracker', icon: ClipboardList, permission: 'view_attendance_tracker', category: 'Attendance Logs' },

    // Real-time Tracking
    { to: '/hr/field-staff-tracking', label: 'User Activity Tracking', icon: Navigation, permission: 'view_field_staff_tracking', category: 'Real-time Tracking' },

    // Leaves & Rules
    { to: '/hr/leave-management', label: 'Leave Management', icon: CalendarCheck2, permission: 'manage_leave_requests', category: 'Leaves & Rules' },
    { to: '/admin/approval-workflow', label: 'Leave Approval Settings', icon: ClipboardCheck, permission: 'manage_approval_workflow', category: 'Leaves & Rules' },
    { to: '/hr/attendance-settings', label: 'Attendance Rules', icon: ListTodo, permission: 'manage_attendance_rules', category: 'Leaves & Rules' },

    // Employee Onboarding
    { to: '/onboarding', label: 'New Enrollment', icon: UserPlus, permission: 'create_enrollment', category: 'Employee Onboarding' },
    { to: '/hr/enrollment-rules', label: 'Enrollment Rules', icon: FileDigit, permission: 'manage_enrollment_rules', category: 'Employee Onboarding' },
    { to: '/hr/family-verification', label: 'Family Verification', icon: Baby, permission: 'manage_attendance_rules', category: 'Employee Onboarding' },

    // Client Management
    { to: '/hr/entity-management?tab=client_structure', label: 'Client Structure', icon: ClipboardList, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=site_configuration', label: 'Site Configuration', icon: Settings, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=costing_resource', label: 'Costing & Resource', icon: Calculator, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=backoffice_heads', label: 'Back Office & ID Series', icon: Users, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=staff_designation', label: 'Staff Designation', icon: Badge, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=gmc_policy', label: 'GMC Policy', icon: HeartPulse, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=asset', label: 'Asset Management', icon: Archive, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=tools_list', label: 'Tools List', icon: Wrench, permission: 'view_entity_management', category: 'Client Management' },
    { to: '/hr/entity-management?tab=attendance_overview', label: 'Attendance Overview', icon: BarChart, permission: 'view_entity_management', category: 'Client Management' },

    // Templates Hub
    { to: '/hr/entity-management?tab=templates_hub', label: 'Client Management', icon: FileSpreadsheet, permission: 'view_entity_management', category: 'Templates Hub' },

    // Site Management
    { to: '/admin/sites', label: 'Site Management', icon: Building, permission: 'manage_sites', category: 'Site Management' },
    { to: '/attendance/locations', label: 'My Locations', icon: MapPin, permission: 'view_my_locations', category: 'Site Management' },
    { to: '/hr/locations', label: 'Geo Locations', icon: MapIcon, permission: 'manage_geo_locations', category: 'Site Management' },

    // Operations & Team
    { to: '/tasks', label: 'Task Manager', icon: ListTodo, permission: 'view_profile', category: 'Operations & Team' },
    { to: '/my-team/field-reports', label: 'Field Reports', icon: ClipboardList, permission: 'view_field_reports', category: 'Operations & Team' },
    { to: '/my-team', label: 'My Team', icon: Users, permission: 'view_my_team', category: 'Operations & Team' },

    // Uniforms & Kit
    { to: '/uniforms', label: 'Uniform Management', icon: Shirt, permission: 'manage_uniforms', category: 'Uniforms & Kit' },

    // Policies & Compliance
    { to: '/hr/policies-and-insurance', label: 'Policies & Insurance', icon: ShieldHalf, permission: 'manage_policies', category: 'Policies & Compliance' },

    // Finance & Invoicing
    { to: '/billing/summary', label: 'Invoice Summary', icon: IndianRupee, permission: 'view_invoice_summary', category: 'Finance & Invoicing' },

    // Audit & Costing
    { to: '/billing/cost-analysis', label: 'Verification Costing', icon: ClipboardCheck, permission: 'view_verification_costing', category: 'Audit & Costing' },

    // Biometric Devices
    { to: '/admin/device-approvals', label: 'Device Approvals', icon: ShieldCheck, permission: 'manage_users', category: 'Biometric Devices' },
    { to: '/admin/devices', label: 'Biometric Devices', icon: Cpu, permission: 'manage_biometric_devices', category: 'Biometric Devices' },
    { to: '/settings/devices', label: 'Linked Devices', icon: Smartphone, permission: 'view_profile', category: 'Biometric Devices' },

    // Security & Roles
    { to: '/admin/roles', label: 'Role Management', icon: ShieldCheck, permission: 'manage_roles_and_permissions', category: 'Security & Roles' },
    { to: '/admin/users', label: 'User Management', icon: Users, permission: 'manage_users', category: 'Security & Roles' },
    { to: '/admin/modules', label: 'Access Tasks', icon: PackagePlus, permission: 'manage_modules', category: 'Security & Roles' },

    // System Config
    { to: '/developer/api', label: 'API Settings', icon: Settings, permission: 'view_developer_settings', category: 'System Config' },
    { to: '/notifications', label: 'Notifications Control', icon: Bell, permission: 'manage_attendance_rules', category: 'System Config' },

    // Support & Profile
    { to: '/support', label: 'Backend Support', icon: LifeBuoy, permission: 'access_support_desk', category: 'Support & Profile' },
    { to: '/profile', label: 'My Account', icon: User, permission: 'view_profile', category: 'Support & Profile' },
];

const CATEGORY_ICONS: Record<string, any> = {
    'CRM & Sales': Target,
    'Dashboards': Home,
    'Attendance Logs': Calendar,
    'Real-time Tracking': Navigation,
    'Leaves & Rules': GitPullRequest,
    'Employee Onboarding': UserPlus,
    'Client Management': Briefcase,
    'Templates': LayoutTemplate,
    'Site Management': Building,
    'Operations & Team': ListTodo,
    'Uniforms & Kit': Shirt,
    'Policies & Compliance': ShieldHalf,
    'Finance & Invoicing': IndianRupee,
    'Audit & Costing': ClipboardCheck,
    'Biometric Devices': Smartphone,
    'Security & Roles': ShieldCheck,
    'System Config': Settings,
    'Support & Profile': LifeBuoy,
};


const SidebarContent: React.FC<{ isCollapsed: boolean, onLinkClick?: () => void, onExpand?: () => void, hideHeader?: boolean, mode?: 'light' | 'dark', isMobile?: boolean }> = React.memo(({ isCollapsed, onLinkClick, onExpand, hideHeader = false, mode = 'light', isMobile = false }) => {
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();

    const location = useLocation();
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

    const groupedLinks = useMemo(() => {
        const groups: Record<string, NavLinkConfig[]> = {};
        
        // Use allNavLinks to maintain logical order within categories
        allNavLinks.forEach(link => {
            if (!user) return;
            if (isAdmin(user.role) || userPermissions.includes(link.permission)) {
                const cat = link.category || 'Other';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(link);
            }
        });
        
        // Sort categories alphabetically A-Z
        const sortedGroups: Record<string, NavLinkConfig[]> = {};
        Object.keys(groups).sort().forEach(key => {
            sortedGroups[key] = groups[key];
        });
        
        return sortedGroups;
    }, [user, userPermissions]);

    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // Auto-expand the category containing the active link
    useEffect(() => {
        const currentPath = location.pathname + location.search;
        const activeLink = allNavLinks.find(link => {
            if (link.to.includes('?')) {
                return link.to === currentPath;
            }
            return link.to === location.pathname;
        });
        if (activeLink?.category) {
            setExpandedCategories(prev => ({
                ...prev,
                [activeLink.category!]: true
            }));
        }
    }, [location.pathname]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const isOpening = !prev[category];
            if (isOpening) {
                // Accordion behavior: close others when opening
                return { [category]: true };
            } else {
                return { ...prev, [category]: false };
            }
        });
    };

    const toggleAllCategories = () => {
        const anyOpen = Object.values(expandedCategories).some(v => v);
        if (anyOpen) {
            setExpandedCategories({});
        } else {
            const allOpen: Record<string, boolean> = {};
            Object.keys(groupedLinks).forEach(cat => allOpen[cat] = true);
            setExpandedCategories(allOpen);
        }
    };

    const handleLinkClick = useCallback((e: React.MouseEvent) => {
        // Log the click for debugging
        console.log('[Sidebar] Link clicked');

        // If collapsed, we still want to expand it for visual feedback
        if (isCollapsed && onExpand) {
            onExpand();
        }

        // On mobile, we also want to close the sidebar overlay after a link is clicked
        if (onLinkClick) {
            onLinkClick();
        }
    }, [isCollapsed, onExpand, onLinkClick]);

    return (
        <div className="flex flex-col h-full">
            {hideHeader && isCollapsed && (
                <div className="p-3 border-b border-[#1f3d2b] bg-[#041b0f] flex justify-center h-12 items-center transition-all duration-300 flex-shrink-0">
                    <button onClick={() => window.location.href = '/#/profile'} className="btn-icon inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-white/10 focus:outline-none" aria-label="Go to profile page">
                        <span className="sr-only">Go to profile</span>
                        <ArrowLeft className="block h-5 w-5" />
                    </button>
                </div>
            )}
            {hideHeader && !isCollapsed && (
                <div className="p-3 border-b border-gray-100 bg-white flex justify-center h-12 items-center transition-all duration-300 flex-shrink-0">
                    {/* Empty header - just background color */}
                </div>
            )}
            {!hideHeader && (
                <div className={`p-2 px-3 border-b flex items-center justify-between h-12 transition-all duration-300 flex-shrink-0 ${mode === 'dark' ? 'bg-[#041b0f] border-[#1f3d2b]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-center flex-1">
                        {isCollapsed ? (
                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-accent/5 transition-all duration-300" title="Paradigm Services">
                                <Logo 
                                    localPath="/paradigm-correct-logo.png"
                                    className="h-7 w-7" 
                                    variant={mode === 'dark' ? 'white' : 'original'} 
                                />
                            </div>
                        ) : (
                            <div className="w-full px-2 flex justify-start pl-4">
                                <Logo 
                                    className="h-8 md:h-9 w-auto max-w-full" 
                                    variant={mode === 'dark' ? 'white' : 'original'} 
                                />
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <button 
                            onClick={toggleAllCategories}
                            className={`p-1.5 rounded-md transition-colors ${
                                mode === 'light' 
                                    ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600' 
                                    : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                            title={Object.values(expandedCategories).some(v => v) ? "Collapse All" : "Expand All"}
                        >
                            {Object.values(expandedCategories).some(v => v) ? <ChevronsRight className="w-4 h-4 rotate-90" /> : <GitBranch className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            )}
            
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar bg-white">
                {isCollapsed ? (
                    // Collapsed mode: Category representative icons (only 10)
                    Object.entries(groupedLinks).map(([category, links]) => {
                        const Icon = CATEGORY_ICONS[category] || Grid3X3;
                        const isCategoryActive = links.some(link => {
                            const currentFull = location.pathname + location.search;
                            return link.to === currentFull || (link.to === location.pathname && !location.search);
                        });
                        
                        return (
                            <button
                                key={category}
                                onClick={() => {
                                    setExpandedCategories(prev => ({ ...prev, [category]: true }));
                                    if (onExpand) onExpand();
                                }}
                                className={`group flex items-center justify-center w-full px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out mb-2 ${
                                    isCategoryActive
                                        ? mode === 'light'
                                            ? 'bg-[#006b3f] text-white font-semibold shadow-sm'
                                            : 'bg-white/10 text-white font-semibold'
                                        : mode === 'light'
                                            ? 'text-gray-500 hover:bg-gray-100/60 hover:text-gray-900'
                                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                                title={category}
                            >
                                <Icon
                                    className={`h-5 w-5 flex-shrink-0 transition-all duration-200 ${
                                        isCategoryActive
                                            ? mode === 'light' ? 'text-white' : 'text-white'
                                            : mode === 'light'
                                                ? 'text-gray-400/80 group-hover:text-gray-500'
                                                : 'text-white/60 group-hover:text-white/90'
                                    }`}
                                />
                            </button>
                        );
                    })
                ) : (
                    // Expanded mode: Continuous list with subtle category headers (Image 2 style)
                    Object.entries(groupedLinks).map(([category, links], groupIdx) => {
                        const isExpanded = expandedCategories[category] ?? false;
                        const CategoryIcon = CATEGORY_ICONS[category] || Grid3X3;

                        const isCategoryActive = links.some(link => {
                            const currentFull = location.pathname + location.search;
                            return link.to === currentFull || (link.to === location.pathname && !location.search);
                        });

                        return (
                            <div key={category} className={`${groupIdx > 0 ? 'mt-4 pt-4 border-t border-gray-50' : ''}`}>
                                <button 
                                    onClick={() => toggleCategory(category)}
                                    className={`w-full text-left px-3 py-2 mb-1 flex items-center justify-between group cursor-pointer focus:outline-none rounded-lg transition-all duration-200 ${
                                        isExpanded || isCategoryActive
                                            ? 'bg-[#006b3f] text-white shadow-md'
                                            : 'hover:bg-gray-50 text-gray-500'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <CategoryIcon className={`h-4 w-4 transition-colors ${
                                            isExpanded || isCategoryActive 
                                                ? 'text-white' 
                                                : 'text-gray-500 group-hover:text-gray-700'
                                        }`} />
                                        <span className={`text-sm font-semibold capitalize tracking-tight transition-colors ${
                                            isExpanded || isCategoryActive 
                                                ? 'text-white' 
                                                : 'text-gray-700 group-hover:text-gray-900'
                                        }`}>
                                            {category}
                                        </span>
                                    </div>
                                    <ChevronRight 
                                        className={`h-3 w-3 transition-transform duration-200 ${
                                            isExpanded 
                                                ? 'rotate-90 text-white' 
                                                : 'text-gray-300 group-hover:text-gray-400'
                                        }`} 
                                    />
                                </button>
                                
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                            className="overflow-hidden space-y-1 bg-slate-50/80 rounded-b-xl -mt-1 pt-3 pb-2"
                                        >
                                            {links.map((link) => {
                                                // Determine active state manually to support ?tab= query params
                                                const linkHasQuery = link.to.includes('?');
                                                const [linkPath, linkSearch] = link.to.split('?');
                                                const currentSearch = location.search.replace('?', '');
                                                const isLinkActive = linkHasQuery
                                                    ? location.pathname === linkPath && currentSearch === linkSearch
                                                    : location.pathname === link.to && !location.search;

                                                return (
                                                    <NavLink
                                                        key={link.to}
                                                        to={link.to}
                                                        onClick={handleLinkClick}
                                                        className={
                                                            `group flex items-center pr-3 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out pl-11 ${mode === 'light'
                                                                ? isLinkActive
                                                                    ? 'bg-white text-[#006b3f] font-bold shadow-sm border border-slate-100'
                                                                    : 'text-slate-600 hover:bg-white/60 hover:text-[#006b3f] hover:shadow-sm'
                                                                : isLinkActive
                                                                    ? 'bg-white/10 text-white font-semibold'
                                                                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                                                            }`
                                                        }
                                                        title={link.label}
                                                    >
                                                        <link.icon
                                                            className={`h-4 w-4 flex-shrink-0 transition-all duration-200 mr-3 ${mode === 'light'
                                                                ? isLinkActive ? 'text-[#006b3f]' : 'text-slate-400 group-hover:text-[#006b3f]'
                                                                : isLinkActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                                                            }`}
                                                        />
                                                        <span className="truncate">{link.label}</span>
                                                    </NavLink>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })
                )}
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

    // Sidebar state: isSidebarExpanded (UI width), isSidebarLocked (Manual lock)
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(isDesktop);
    const [isSidebarLocked, setIsSidebarLocked] = useState(isDesktop);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync state when device type changes
    useEffect(() => {
        setIsSidebarExpanded(isDesktop);
        setIsSidebarLocked(isDesktop);
    }, [isDesktop]);

    const handleMouseEnter = useCallback(() => {
        if (isMobile || isSidebarLocked) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setIsSidebarExpanded(true);
        }, 50);
    }, [isMobile, isSidebarLocked]);

    const handleMouseLeave = useCallback(() => {
        if (isMobile || isSidebarLocked) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsSidebarExpanded(false);
    }, [isMobile, isSidebarLocked]);

    const toggleSidebarLock = useCallback(() => {
        const nextLocked = !isSidebarLocked;
        setIsSidebarLocked(nextLocked);
        setIsSidebarExpanded(nextLocked);
    }, [isSidebarLocked]);

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

    const isPublicReferralPath = location.pathname.startsWith('/referral/employee') || location.pathname.startsWith('/referral/business');

    if (!user && !isPublicReferralPath) {
        return <Navigate to="/auth/login" replace />;
    }

    return (
        <div className={`flex h-screen overflow-hidden ${isMobile ? 'bg-[#041b0f]' : 'bg-page'}`}>

            {isMobile && !isSidebarExpanded && (
                <div
                    className="fixed inset-0 bg-black/50 z-[45] transition-opacity duration-300"
                    onClick={() => setIsSidebarExpanded(true)}
                />
            )}

            {(isMobile || isTablet) && isPanelOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[95] transition-opacity duration-300"
                    onClick={() => setIsPanelOpen(false)}
                />
            )}

            <aside 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`flex flex-col flex-shrink-0 transition-[width] duration-300 cubic-bezier(0.4,0,0.2,1) will-change-[width] ${isMobile ? (!isSidebarExpanded ? 'w-[56px]' : 'w-[243px]') : (isTablet ? (!isSidebarExpanded ? 'w-[56px]' : 'w-[210px]') : (!isSidebarExpanded ? 'w-[56px]' : 'w-[227px]'))} ${isMobile ? 'bg-[#041b0f]' : 'bg-white border-r border-gray-200/60'} ${isMobile ? 'fixed left-0 top-0 bottom-0 z-50' : ''}`}
            >
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <SidebarContent
                        isCollapsed={!isSidebarExpanded}
                        mode={isMobile ? "dark" : "light"}
                        onLinkClick={() => !isSidebarLocked && setIsSidebarExpanded(false)}
                        onExpand={() => {
                            setIsSidebarExpanded(true);
                            setIsSidebarLocked(true);
                        }}
                        hideHeader={isMobile}
                        isMobile={isMobile}
                    />
                </div>
                <div className={`flex-shrink-0 px-2 py-4 mt-auto flex flex-col items-center gap-2 ${isMobile ? 'border-t border-transparent' : 'border-t border-border'}`}>
                    {isSidebarExpanded && (
                        <div className="flex flex-col items-center gap-1">
                            <div className={`text-[11px] font-medium tracking-wider uppercase opacity-40 transition-all duration-300 animate-fade-in ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                                v{appVersion}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={toggleSidebarLock}
                        className={`w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200 ${isMobile ? 'text-white/70 hover:bg-white/10' : 'text-muted hover:bg-page active:scale-95'} ${isSidebarLocked ? 'bg-page/50 sm:bg-transparent' : ''}`}
                        title={!isSidebarLocked ? 'Lock sidebar' : 'Unlock sidebar'}
                    >
                        {!isSidebarExpanded ? (
                            <div className="flex flex-col items-center gap-1.5 font-bold">
                                <ChevronsRight className="h-5 w-5" />
                                <span className="text-[8px] tracking-tighter uppercase opacity-30">v{appVersion}</span>
                            </div>
                        ) : (
                            <ChevronsLeft className={`h-5 w-5 transition-transform duration-300 ${!isSidebarLocked ? 'opacity-50' : 'opacity-100'}`} />
                        )}
                    </button>
                </div>
            </aside>

            <div className={`flex-1 flex flex-col h-full overflow-hidden ${isMobile ? 'bg-[#041b0f]' : 'bg-gray-50/50'} ${isMobile && !isSidebarExpanded ? 'ml-[56px]' : ''}`}>
                <Header />
                <BreakTrackingMonitor />

                <main ref={mainContentRef} className={`flex-1 overflow-y-auto ${isMobile ? 'bg-[#041b0f]' : 'bg-page'} relative flex flex-col`}>
                    <div className={`flex-1 ${isTablet ? 'p-1 pb-4' : 'p-3 pb-6'}`}>
                        <Outlet />
                    </div>
                </main>
            </div>

            <PingAlarmOverlay />

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

            {(isMobile || isTablet) && isPanelOpen && (
                <div className={`fixed inset-y-0 right-0 z-[100] animate-slide-in-right ${isMobile ? 'w-full' : 'w-[400px]'}`}>
                    <NotificationPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} isMobile={isMobile} />
                </div>
            )}
            
            {showScrollButtons && !isMobile && (
                <div className="fixed bottom-[10%] right-8 z-50 flex flex-col gap-2 no-print">
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
            <ReferralModal />
        </div>
    );
};

export default MainLayout;
