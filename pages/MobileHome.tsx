import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { allNavLinks } from '../components/layouts/MainLayout';
import { useDevice } from '../hooks/useDevice';
import {
    LogOut, ArrowLeft, Sparkles,
    ListTodo, ClipboardList, Settings, CheckCircle2,
    Calendar, History, Cpu, Smartphone, Users, LifeBuoy,
    FileText, Folder, Target, Briefcase, Home, Navigation,
    CalendarCheck2, UserPlus, FileSpreadsheet, Building,
    Shirt, ShieldHalf, IndianRupee, ClipboardCheck, ShieldCheck,
    Phone, Bell, LineChart, Wallet, Wrench, FileSignature,
    Ticket, LayoutDashboard, BriefcaseBusiness, BarChart3,
    MapPin, HeartPulse, Archive, Badge, Sun, CalendarDays,
    BarChart, LayoutTemplate, Baby,
} from 'lucide-react';
import { ProfilePlaceholder } from '../components/ui/ProfilePlaceholder';
import { isAdmin } from '../utils/auth';

// ─── Super-category grouping ────────────────────────────────────────────────
const SUPER_CATEGORY_MAP: Record<string, string> = {
    'Employee Onboarding':   'WORKFORCE',
    'Client Management':     'WORKFORCE',
    'Leaves & Rules':        'WORKFORCE',
    'Uniforms & Kit':        'WORKFORCE',
    'HRM Portal':            'WORKFORCE',

    'Operations Hub':        'OPERATIONS',
    'Attendance Logs':       'OPERATIONS',
    'Real-time Tracking':    'OPERATIONS',
    'Site Management':       'OPERATIONS',
    'Operations & Team':     'OPERATIONS',
    'Gate Attendance':       'OPERATIONS',
    'Templates Hub':         'OPERATIONS',

    'CRM & Sales':           'FINANCE & SALES',
    'Finance Hub':           'FINANCE & SALES',
    'Finance & Invoicing':   'FINANCE & SALES',
    'Audit & Snag Reports':  'FINANCE & SALES',

    'Dashboards':            'ADMIN & COMPLIANCE',
    'Enterprise Controls':   'ADMIN & COMPLIANCE',
    'Policies & Compliance': 'ADMIN & COMPLIANCE',
    'Security & Roles':      'ADMIN & COMPLIANCE',
    'Biometric Devices':     'ADMIN & COMPLIANCE',
    'System Config':         'ADMIN & COMPLIANCE',
    'Support & Profile':     'ADMIN & COMPLIANCE',
};

const SUPER_CATEGORY_ORDER = [
    'WORKFORCE',
    'OPERATIONS',
    'FINANCE & SALES',
    'ADMIN & COMPLIANCE',
];

// ─── Section color themes ────────────────────────────────────────────────────
const SECTION_THEMES: Record<string, { tileBg: string; icon: string; headerColor: string }> = {
    'WORKFORCE':         { tileBg: '#092c19', icon: '#44D62C', headerColor: 'text-[#44D62C]' },
    'OPERATIONS':        { tileBg: '#092c19', icon: '#44D62C', headerColor: 'text-[#44D62C]' },
    'FINANCE & SALES':   { tileBg: '#092c19', icon: '#44D62C', headerColor: 'text-[#44D62C]' },
    'ADMIN & COMPLIANCE':{ tileBg: '#092c19', icon: '#44D62C', headerColor: 'text-[#44D62C]' },
};

// ─── Category Icons ──────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
    'CRM & Sales':            Target,
    'HRM Portal':             Briefcase,
    'Dashboards':             LayoutDashboard,
    'Attendance Logs':        Calendar,
    'Real-time Tracking':     Navigation,
    'Leaves & Rules':         CalendarCheck2,
    'Employee Onboarding':    UserPlus,
    'Client Management':      Users,
    'Templates Hub':          FileSpreadsheet,
    'Site Management':        Building,
    'Operations & Team':      ListTodo,
    'Operations Hub':         Ticket,
    'Uniforms & Kit':         Shirt,
    'Policies & Compliance':  ShieldHalf,
    'Finance & Invoicing':    IndianRupee,
    'Finance Hub':            Wallet,
    'Audit & Snag Reports':   ClipboardCheck,
    'Enterprise Controls':    CheckCircle2,
    'Biometric Devices':      Cpu,
    'Gate Attendance':        ShieldCheck,
    'Security & Roles':       ShieldCheck,
    'System Config':          Settings,
    'Support & Profile':      LifeBuoy,
};

// ─── Sub-item icon resolver ──────────────────────────────────────────────────
const getSubItemIcon = (to: string, label: string, originalIcon: React.ElementType): React.ElementType => {
    const l = label.toLowerCase();
    if (l.includes('audit') || l.includes('trail'))        return History;
    if (l.includes('device') || l.includes('biometric'))   return Cpu;
    if (l.includes('kiosk') || l.includes('linked'))       return Smartphone;
    if (l.includes('team') || l.includes('referral management')) return Users;
    if (l.includes('support') || l.includes('help'))       return LifeBuoy;
    if (l.includes('invoice') || l.includes('billing'))    return IndianRupee;
    if (l.includes('profitab'))   return LineChart;
    if (l.includes('payment'))    return Wallet;
    if (l.includes('field report')) return FileText;
    if (l.includes('maintenance')) return Wrench;
    if (l.includes('contract'))   return FileSignature;
    if (l.includes('ticket'))     return Ticket;
    if (l.includes('geo') || l.includes('location')) return MapPin;
    if (l.includes('gmc') || l.includes('insurance')) return HeartPulse;
    if (l.includes('asset'))      return Archive;
    if (l.includes('designation')) return Badge;
    if (l.includes('holiday'))    return Sun;
    if (l.includes('monthly') || l.includes('bulk')) return CalendarDays;
    if (l.includes('letter') || l.includes('template')) return LayoutTemplate;
    if (l.includes('report') || l.includes('dashboard')) return BarChart3;
    if (l.includes('family'))     return Baby;
    if (l.includes('voip') || l.includes('call')) return Phone;
    if (l.includes('notification') || l.includes('bell')) return Bell;
    if (l.includes('api') || l.includes('developer')) return Settings;
    if (l.includes('role') || l.includes('security')) return ShieldCheck;
    if (l.includes('user') || l.includes('member')) return Users;
    if (l.includes('access') || l.includes('module')) return ListTodo;
    if (l.includes('tracker') || l.includes('overview')) return BarChart;
    return originalIcon;
};

const toDisplayLabel = (str: string): string => {
    if (!str) return '';
    const overrides: Record<string, string> = {
        'api settings': 'API settings',
        'access tasks': 'Access tasks',
        'all submissions': 'Submissions',
        'approvals inbox': 'Approvals',
        'asset management': 'Assets',
        'voip configuration': 'VoIP',
        'notification management': 'Notifications',
        'backend support': 'Support',
        'my account': 'My account',
        'leave approval settings': 'Leave approval',
        'leave management': 'Leave mgmt',
        'attendance rules': 'Att. rules',
        'user activity tracking': 'Activity',
        'attendance bulk feed': 'Bulk feed',
        'monthly attendance feed': 'Monthly feed',
        'client dashboard': 'Client dash',
        'site dashboard': 'Site dash',
        'management dashboard': 'Mgmt dash',
        'company holiday selection': 'Holidays',
        'back office & id series': 'Back office',
        'costing & resource': 'Costing',
        'gate registration': 'Gate reg.',
        'role management': 'Roles',
        'user management': 'Users',
        'helpdesk tickets': 'Helpdesk',
        'preventive maintenance': 'Maintenance',
        'contract manager': 'Contracts',
        'invoice summary': 'Invoices',
        'verification costing': 'Costing',
        'device approvals': 'Dev. approvals',
        'biometric devices': 'Devices',
        'kiosk monitoring': 'Kiosks',
        'linked devices': 'Linked',
        'gate logs': 'Logs',
        'gate kiosk': 'Kiosk',
        'letter templates': 'Letters',
        'reports dashboard': 'Reports',
        'hr call queue': 'HR calls',
        'referral management': 'Referrals',
        'my referrals': 'My referrals',
        'new enrollment': 'Enroll',
        'enrollment rules': 'Rules',
        'family verification': 'Family',
        'client structure': 'Structure',
        'site configuration': 'Site config',
        'staff designation': 'Designation',
        'gmc policy': 'GMC policy',
        'tools list': 'Tools',
        'attendance overview': 'Overview',
        'client management': 'Templates',
        'profitability': 'Profit',
        'payment tracker': 'Payments',
        'audit trail': 'Audit trail',
        'field reports': 'Field rep.',
        'task manager': 'Tasks',
        'my team': 'My team',
        'uniform management': 'Uniforms',
        'policies & insurance': 'Policies',
        'geo locations': 'Geo loc.',
        'my locations': 'Locations',
        'site management': 'Sites',
    };
    const k = str.toLowerCase();
    if (overrides[k]) return overrides[k];
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// ─── Component ───────────────────────────────────────────────────────────────
const MobileHome: React.FC = () => {
    const user = useAuthStore(state => state.user);
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();
    const { isMobile } = useDevice();
    const [searchParams, setSearchParams] = useSearchParams();
    const categoryFromUrl = searchParams.get('category');
    const [activeCategory, setActiveCategoryState] = useState<string | null>(categoryFromUrl || null);

    // Keep activeCategory in sync with URL ?category= query param
    useEffect(() => {
        const cat = searchParams.get('category');
        setActiveCategoryState(cat || null);
    }, [searchParams]);

    const setActiveCategory = (cat: string | null) => {
        setActiveCategoryState(cat);
        if (cat) {
            setSearchParams({ category: cat });
        } else {
            setSearchParams({});
        }
    };

    useEffect(() => {
        if (!isMobile) navigate('/profile');
    }, [isMobile, navigate]);

    if (!user) return null;

    const getUserPermissions = () => {
        if (!user || !permissions) return [];
        const roleId = user.roleId?.toLowerCase() || '';
        const roleName = user.role?.toLowerCase() || '';
        const roleNameUnderscore = roleName.replace(/\s+/g, '_');
        return permissions[roleId] ||
               permissions[roleName] ||
               permissions[roleNameUnderscore] ||
               permissions[user.role] || [];
    };

    const userPermissions = getUserPermissions();

    const roleLower = (user.role || '').toLowerCase();
    const roleIdLower = (user.roleId || '').toLowerCase();
    const isDirector = roleLower.includes('director') || roleIdLower.includes('director');

    const availableLinks = user
        ? allNavLinks.filter(link => {
            if (isDirector && (link.category === 'Finance & Invoicing' || link.category === 'Finance Hub' || link.permission === 'view_verification_costing')) {
                return false;
            }
            return isAdmin(user.role) || userPermissions.includes(link.permission);
        })
        : [];

    // Group by category preserving allNavLinks order
    const groupedLinks: Record<string, typeof availableLinks> = {};
    allNavLinks.forEach(link => {
        if (!availableLinks.find(l => l.to === link.to)) return;
        const cat = link.category || 'Other';
        if (!groupedLinks[cat]) groupedLinks[cat] = [];
        groupedLinks[cat].push(link);
    });

    // Group categories into super-categories
    const superGroups: Record<string, string[]> = {};
    Object.keys(groupedLinks).forEach(cat => {
        const superCat = SUPER_CATEGORY_MAP[cat] || 'OTHER';
        if (!superGroups[superCat]) superGroups[superCat] = [];
        superGroups[superCat].push(cat);
    });

    // Ordered list of sections present
    const orderedSections = SUPER_CATEGORY_ORDER.filter(s => superGroups[s]);
    const otherSections = Object.keys(superGroups).filter(s => !SUPER_CATEGORY_ORDER.includes(s));

    const handleLogout = () => navigate('/auth/logout');

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
    };
    const itemVariants: Variants = {
        hidden: { y: 14, opacity: 0, scale: 0.92 },
        show: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 28 } },
    };

    // ─── Tile ────────────────────────────────────────────────────────────────
    const Tile = ({
        icon: Icon,
        label,
        count,
        onClick,
        isExit = false,
    }: {
        icon: React.ElementType;
        label: string;
        count?: number;
        onClick: () => void;
        tileBg?: string;
        iconColor?: string;
        isExit?: boolean;
    }) => (
        <motion.button
            variants={itemVariants}
            whileTap={{ scale: 0.88 }}
            onClick={onClick}
            className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer w-full max-w-[76px]"
        >
            {/* Native Android Squircle Container */}
            <div className="relative">
                {count !== undefined && count > 0 && (
                    <span className="
                        absolute -top-1 -right-1 z-20
                        min-w-[19px] h-[19px] px-1
                        flex items-center justify-center
                        rounded-full text-[10px] font-black
                        bg-gradient-to-br from-[#ff7a00] to-[#ea580c] text-white shadow-[0_2px_8px_rgba(234,88,12,0.5)]
                        border-2 border-[#092c19]
                    ">
                        {count}
                    </span>
                )}
                <div
                    className={`w-[54px] h-[54px] flex items-center justify-center rounded-[18px] transition-all duration-150 group-active:scale-90 border shadow-sm ${
                        isExit 
                            ? 'bg-[#220a0f] border-rose-900/40 text-rose-400 group-hover:border-rose-500/50' 
                            : 'bg-[#041b0f] border-[#134426] group-hover:border-[#44D62C]/50 group-active:bg-[#072414] text-[#44D62C]'
                    }`}
                >
                    <Icon
                        className="w-[23px] h-[23px] drop-shadow-[0_2px_6px_rgba(68,214,44,0.25)]"
                        style={{ color: isExit ? '#f43f5e' : '#44D62C' }}
                        strokeWidth={2.2}
                    />
                </div>
            </div>
            <span 
                className="text-[10.5px] text-center font-bold leading-tight w-full line-clamp-2 px-0.5"
                style={{ color: isExit ? '#f43f5e' : 'rgba(255,255,255,0.88)' }}
                title={label}
            >
                {label}
            </span>
        </motion.button>
    );

    // Active category theme (for sub-item view)
    const activeSuperCat = activeCategory ? (SUPER_CATEGORY_MAP[activeCategory] || 'WORKFORCE') : 'WORKFORCE';
    const activeTheme = SECTION_THEMES[activeSuperCat] || SECTION_THEMES['WORKFORCE'];

    return (
        <div className="min-h-[calc(100vh-180px)] flex flex-col bg-[#0b1a10]">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden pt-7 pb-9 px-5 bg-gradient-to-br from-[#0d2a1a] to-[#0b1a10] rounded-b-[36px] -mx-4 mb-4 shadow-xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-[70px] -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex items-center space-x-3">
                    <div className="relative">
                        <ProfilePlaceholder
                            photoUrl={user.photoUrl}
                            seed={user.id}
                            className="h-12 w-12 rounded-full border-2 border-emerald-500/25 shadow-md"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 h-3 w-3 rounded-full border-2 border-[#0d2a1a]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 opacity-45 mb-0.5">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span className="text-[9px] uppercase font-black tracking-[0.22em] text-white">Security Uplink Active</span>
                        </div>
                        <h1 className="text-[19px] font-black text-white tracking-tight leading-none">
                            Hi, {user.name}
                        </h1>
                        <p className="text-[9px] text-emerald-100/35 font-bold uppercase tracking-[0.2em] mt-0.5">
                            {user.role.replace(/_/g, ' ')}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="flex-1 px-3 pb-6">
                <AnimatePresence mode="wait">

                    {activeCategory === null ? (
                        /* ── MATERIAL 3 SECTION CARDS ────────────────── */
                        <motion.div
                            key="home"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.16 }}
                            className="space-y-4"
                        >
                            {[...orderedSections, ...otherSections].map((section) => {
                                const cats = superGroups[section] || [];
                                if (cats.length === 0) return null;

                                return (
                                    <div 
                                        key={section} 
                                        className="bg-[#092c19] border border-[#134426] rounded-[24px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.35)] relative overflow-hidden"
                                    >
                                        {/* Subtle top surface highlight sheen */}
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#44D62C]/25 to-transparent pointer-events-none" />

                                        {/* Section Card Header */}
                                        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#134426]">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-[#44D62C] shadow-[0_0_8px_rgba(68,214,44,0.6)]" />
                                                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">
                                                    {section}
                                                </h3>
                                            </div>
                                            <span className="text-[10px] font-extrabold text-[#7D967B] bg-[#041b0f] px-2.5 py-0.5 rounded-full border border-[#134426]">
                                                {cats.length} {cats.length === 1 ? 'Module' : 'Modules'}
                                            </span>
                                        </div>

                                        {/* Category tiles */}
                                        <motion.div
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="show"
                                            className="grid grid-cols-4 gap-x-2 gap-y-3.5 justify-items-center"
                                        >
                                            {cats.map(cat => {
                                                const Icon = CATEGORY_ICONS[cat] || Folder;
                                                const count = groupedLinks[cat]?.length;
                                                return (
                                                    <Tile
                                                        key={cat}
                                                        icon={Icon}
                                                        label={cat}
                                                        count={count}
                                                        onClick={() => setActiveCategory(cat)}
                                                    />
                                                );
                                            })}
                                        </motion.div>
                                    </div>
                                );
                            })}

                            {/* Exit Card */}
                            <div className="bg-[#1f0a0e]/80 border border-rose-950/60 rounded-[20px] p-3 shadow-md">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-between px-2 py-1 cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
                                            <LogOut className="w-5 h-5" strokeWidth={2.2} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black text-rose-300">Sign Out</p>
                                            <p className="text-[10px] font-semibold text-rose-400/60">End current session securely</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                                        Exit
                                    </span>
                                </button>
                            </div>
                        </motion.div>

                    ) : (
                        /* ── SUB-ITEM SECTION CARD ───────────────────────────────── */
                        <motion.div
                            key={`sub-${activeCategory}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.16 }}
                        >
                            {/* Back Navigation Bar */}
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={() => setActiveCategory(null)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Back</span>
                                </button>
                                <div className="h-[1px] flex-1 bg-[#134426]" />
                                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                                    {activeCategory}
                                </span>
                            </div>

                            {/* Sub-item Section Card */}
                            <div className="bg-[#092c19] border border-[#134426] rounded-[24px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.35)] relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#44D62C]/25 to-transparent pointer-events-none" />

                                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#134426]">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#44D62C] shadow-[0_0_8px_rgba(68,214,44,0.6)]" />
                                        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">
                                            {activeCategory} Features
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-[#7D967B] bg-[#041b0f] px-2.5 py-0.5 rounded-full border border-[#134426]">
                                        {(groupedLinks[activeCategory] || []).length} Actions
                                    </span>
                                </div>

                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    className="grid grid-cols-4 gap-x-2 gap-y-3.5 justify-items-center"
                                >
                                    {(groupedLinks[activeCategory] || []).map(link => {
                                        const Icon = getSubItemIcon(link.to, link.label, link.icon);
                                        return (
                                            <Tile
                                                key={link.to}
                                                icon={Icon}
                                                label={toDisplayLabel(link.label)}
                                                onClick={() => navigate(link.to)}
                                            />
                                        );
                                    })}
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

        </div>
    );
};

export default MobileHome;
