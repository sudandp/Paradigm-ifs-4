



import React, { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Trash2, Plus, Settings, Calendar, Clock, LifeBuoy, Bell, Save, Monitor, Edit, Moon, Sun, BarChart3, Briefcase, Building2, Palmtree, Shield, FileText, IndianRupee, Lock, AlertTriangle, History } from 'lucide-react';
import DatePicker from '../../components/ui/DatePicker';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import Select from '../../components/ui/Select';
import { format, subDays } from 'date-fns';
import type { StaffAttendanceRules, AttendanceSettings, RecurringHolidayRule, Role, SiteStaffDesignation, SiteShiftDefinition } from '../../types';
import SiteAttendanceConfig from '../../components/attendance/SiteAttendanceConfig';
import SiteAttendanceSummary from '../../components/attendance/SiteAttendanceSummary';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { supabase } from '../../services/supabase';
import StaffBillingConfig from '../billing/StaffBillingConfig';
import SiteHolidayAllocator from '../../components/billing/SiteHolidayAllocator';
import { TravelRulesConfigPanel } from '../../components/hr/TravelRulesConfigPanel';


/** Normalize role display names to Title Case regardless of DB storage format */
const toTitleCase = (str: string): string =>
    str
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();

const AttendanceSettings: React.FC = () => {
    const { attendance, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays, addHoliday, removeHoliday, addRecurringHoliday, removeRecurringHoliday, updateAttendanceSettings: updateStore } = useSettingsStore();
    const [orgStructure, setOrgStructure] = useState<any[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('global');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    const [localAttendance, setLocalAttendance] = useState<AttendanceSettings>(attendance);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [activeTab, setActiveTab] = useState<'office' | 'field' | 'site' | 'admin' | 'management' | 'selections'>('office');
    const [subTab, setSubTab] = useState<'general' | 'policies' | 'calc_rules' | 'shifts' | 'departments' | 'lumpsum' | 'holidays' | 'leaves' | 'notifications' | 'fixed_hours' | 'summary' | 'billing_config' | 'travel'>('general');
    const [lumpsumItems, setLumpsumItems] = useState<{ id?: string, itemName: string, ratePerMonth: number, isActive: boolean }[]>([]);


    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        if (tab !== 'site' && (subTab === 'shifts' || subTab === 'departments' || subTab === 'summary' || subTab === 'billing_config')) {
            setSubTab('general');
        }
        if (tab === 'site' && subTab === 'fixed_hours') {
            setSubTab('general');
        }
    };
    const [newHolidayName, setNewHolidayName] = useState('');
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newRecurringN, setNewRecurringN] = useState(3);
    const [newRecurringDay, setNewRecurringDay] = useState('Saturday');
    const [newRecurringEligibleRoles, setNewRecurringEligibleRoles] = useState<string[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [newPoolHolidayName, setNewPoolHolidayName] = useState('');
    const [newPoolHolidayDate, setNewPoolHolidayDate] = useState('');
    const [editingPoolIndex, setEditingPoolIndex] = useState<number | null>(null);

    // Rule Versioning Modal state
    const [ruleVersionModal, setRuleVersionModal] = useState<{
        open: boolean;
        effectiveFrom: string;
        changeReason: string;
        affectedMonths: { label: string; locked: boolean }[];
        isLoadingImpact: boolean;
    }>({
        open: false,
        effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
        changeReason: '',
        affectedMonths: [],
        isLoadingImpact: false,
    });

    const { user: currentUser } = useAuthStore();


    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingRoles(true);
            try {
                const [roles, designations, structure] = await Promise.all([
                    api.getRoles(),
                    api.getSiteStaffDesignations(),
                    api.getOrganizationStructure()
                ]);
                
                // Deduplicate fetchedRoles by displayName (in case DB has two entries for same role)
                const seenRoleNames = new Set<string>();
                const dedupedRoles = roles.filter(r => {
                    const key = (r.displayName || r.id).toLowerCase();
                    if (seenRoleNames.has(key)) return false;
                    seenRoleNames.add(key);
                    return true;
                });

                // Merge system roles with site staff designations
                const mergedRoles: Role[] = [...dedupedRoles];
                
                designations.forEach(desig => {
                    if (!desig.designation) return;
                    const slug = desig.designation.toLowerCase().replace(/\s+/g, '_');
                    const nameNorm = desig.designation.toLowerCase();
                    // Deduplicate by both slug-id AND displayName (DB roles use UUID ids, not slugs)
                    const alreadyExists = mergedRoles.some(r =>
                        r.id === slug || (r.displayName || '').toLowerCase() === nameNorm
                    );
                    if (!alreadyExists) {
                        mergedRoles.push({
                            id: slug,
                            displayName: toTitleCase(desig.designation)
                        });
                    }
                });

                // Normalize all displayNames to Title Case for visual consistency
                mergedRoles.forEach(r => {
                    if (r.displayName) r.displayName = toTitleCase(r.displayName);
                });
                
                // Sort roles alphabetically by displayName
                mergedRoles.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

                setAllRoles(mergedRoles);
                setOrgStructure(structure);
                
                // Collect unique locations from organization structure
                const uniqueLocations = new Set<string>();
                structure.forEach(group => {
                    group.companies.forEach(company => {
                        if (company.location) uniqueLocations.add(company.location);
                        company.entities.forEach(entity => {
                            if (entity.location) uniqueLocations.add(entity.location);
                        });
                    });
                });
                setLocations(Array.from(uniqueLocations).sort());
            } catch (error) {
                console.error('Failed to fetch roles or organization structure:', error);
            } finally {
                setIsLoadingRoles(false);
            }
        };
        fetchData();
    }, []);

    // Derived options for Societies and Entities
    const availableCompanies = useMemo(() => {
        if (selectedLocation === 'global') return [];
        const companies: { id: string, name: string }[] = [];
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                const matchesLoc = company.location === selectedLocation || 
                                 company.entities.some(e => e.location === selectedLocation);
                if (matchesLoc) {
                    companies.push({ id: company.id, name: company.name });
                }
            });
        });
        return companies;
    }, [orgStructure, selectedLocation]);

    const availableEntities = useMemo(() => {
        if (!selectedCompanyId) return [];
        const entities: { id: string, name: string, holidayConfig?: any }[] = [];
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                if (company.id === selectedCompanyId) {
                    company.entities.forEach(entity => {
                        entities.push({ id: entity.id, name: entity.name, holidayConfig: entity.holidayConfig });
                    });
                }
            });
        });
        return entities;
    }, [orgStructure, selectedCompanyId]);

    // Fetch scoped settings when selection changes
    useEffect(() => {
        const fetchScopedSettings = async () => {
            let scope: 'location' | 'company' | 'entity' | 'global' = 'global';
            let scopeId = '';

            if (selectedEntityId) {
                scope = 'entity';
                scopeId = selectedEntityId;
            } else if (selectedCompanyId) {
                scope = 'company';
                scopeId = selectedCompanyId;
            } else if (selectedLocation !== 'global') {
                scope = 'location';
                scopeId = selectedLocation;
            }

            if (scope === 'global') {
                setLocalAttendance(attendance);
                return;
            }

            setIsLoadingSettings(true);
            try {
                const settings = await api.getScopedAttendanceSettings(scope as any, scopeId);
                if (settings) {
                    setLocalAttendance(settings);
                } else {
                    // Fallback to global settings if no scoped settings yet
                    setLocalAttendance(attendance);
                }
            } catch (error) {
                console.error('Failed to fetch scoped settings:', error);
                setToast({ message: `Failed to fetch settings for ${scope}. Using global defaults.`, type: 'error' });
                setLocalAttendance(attendance);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        fetchScopedSettings();
    }, [selectedLocation, selectedCompanyId, selectedEntityId, attendance]);

    // Fetch lumpsum billing items
    useEffect(() => {
        const fetchLumpsumItems = async () => {
            const siteId = selectedEntityId || selectedCompanyId || 'global';
            try {
                const { data, error } = await supabase
                    .from('lumpsum_billing_items')
                    .select('*')
                    .eq('site_id', siteId);
                if (data && !error) {
                    setLumpsumItems(data.map(item => ({
                        id: item.id,
                        itemName: item.item_name,
                        ratePerMonth: Number(item.rate_per_month),
                        isActive: item.is_active
                    })));
                }
            } catch (error) {
                console.error('Failed to fetch lumpsum billing items:', error);
            }
        };
        if (activeTab === 'site') {
            fetchLumpsumItems();
        }
    }, [selectedEntityId, selectedCompanyId, activeTab]);

    // Reset subordinate selections when parent changes
    const handleLocationChange = (val: string) => {
        setSelectedLocation(val);
        setSelectedCompanyId('');
        setSelectedEntityId('');
    };

    const handleCompanyChange = (val: string) => {
        setSelectedCompanyId(val);
        setSelectedEntityId('');
    };

    useEffect(() => {
        // Initialize admin and management if missing
        setLocalAttendance(prev => {
            const updated = { ...attendance };
            if (!updated.admin) updated.admin = { ...attendance.office, deviceLimits: { web: 5, android: 5, ios: 5 } };
            if (!updated.management) updated.management = { ...attendance.office, deviceLimits: { web: 5, android: 5, ios: 5 } };
            return updated;
        });
    }, [attendance]);

    useEffect(() => {
        const isGlobal = selectedLocation === 'global' && !selectedCompanyId && !selectedEntityId;
        setIsDirty(JSON.stringify(localAttendance) !== JSON.stringify(isGlobal ? attendance : localAttendance));
    }, [localAttendance, attendance, selectedLocation, selectedCompanyId, selectedEntityId]);

    // Automatically switch tabs if the active tab is hidden by the current entity selection
    useEffect(() => {
        const isHeadOfficeSelected = selectedEntityId === `${selectedCompanyId}_head_office`;
        const isSpecificEntitySelected = selectedEntityId && !isHeadOfficeSelected;

        if (isHeadOfficeSelected && activeTab === 'site') {
            setActiveTab('office');
        } else if (isSpecificEntitySelected && (activeTab === 'office' || activeTab === 'field')) {
            setActiveTab('site');
        }
    }, [selectedEntityId, selectedCompanyId, activeTab]);

    // Load geofencing settings
    // No extra loading here, it's part of attendance settings

    const currentRules = (activeTab === 'selections' ? localAttendance?.office : localAttendance?.[activeTab as 'office' | 'field' | 'site' | 'admin' | 'management']) || {} as any;
    const currentHolidaysFromStore = activeTab === 'office' || activeTab === 'admin' || activeTab === 'management' 
        ? officeHolidays // Admin/Management share office holidays generally, or we could separate them. For now, sharing seems appropriate or they can be configured separately if the backend supported it. Actually the `type` field in holidays supports 'office', 'field', 'site'. Let's stick to 'office' holidays for Admin/Mgmt for now unless we add specific holiday lists. 
        : activeTab === 'field' ? fieldHolidays : siteHolidays;
    
    // NOTE: For simplicity, Admin and Management will view/edit "Office" holidays when in their tabs, 
    // or we can just hide the holiday section for them and say "Inherits Office Holidays".
    // Let's hide the holiday section for Admin/Mgmt to avoid confusion, or map them to office.
    // The previous code mapped `activeTab` directly to holiday type.

    const currentYear = new Date().getFullYear();
    
    // Merge fixed holidays with store holidays, ensuring no duplicates by name
    const currentHolidays = [
        ...FIXED_HOLIDAYS.map(fh => ({
            id: `fixed-${fh.date}`,
            name: fh.name,
            date: `${currentYear}-${fh.date}`,
            type: activeTab
        })),
        ...currentHolidaysFromStore.filter(h => !FIXED_HOLIDAYS.some(fh => fh.name === h.name))
    ].sort((a, b) => new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime());

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newHolidayName && newHolidayDate && activeTab !== 'selections') {
            // For now, only allow adding holidays to core types or map admin/mgmt to office
            // If activeTab is admin/management, we might want to block adding holidays strictly to them unless backend supports it.
            // Let's assume for now we only edit holidays for office/field/site.
            if (activeTab === 'admin' || activeTab === 'management') {
                setToast({ message: 'Holiday configuration for Admin/Management is inherited from Office rules.', type: 'error' });
                return;
            }

            const adminAllocated = 5; // Fixed 5 admin holidays
            const nonFixedHolidays = currentHolidays.filter(h => !FIXED_HOLIDAYS.some(fh => fh.name === h.name));
            
            if (nonFixedHolidays.length >= 0 && currentHolidays.length >= (currentRules.maxHolidaysPerCategory || 10)) {
                setToast({ message: `Maximum total limit of 10 holidays reached.`, type: 'error' });
                return;
            }

            if (currentHolidays.some(h => h.date === newHolidayDate)) {
                setToast({ message: 'A holiday for this date already exists.', type: 'error' });
                return;
            }
            try {
                await addHoliday(activeTab as 'office' | 'field' | 'site', { name: newHolidayName, date: newHolidayDate });
                setNewHolidayName('');
                setNewHolidayDate('');
                setToast({ message: 'Holiday added successfully.', type: 'success' });
            } catch (error) {
                setToast({ message: 'Failed to add holiday.', type: 'error' });
            }
        } else {
            setToast({ message: 'Please provide both a name and a date.', type: 'error' });
        }
    };

    const handleRemoveHoliday = async (id: string) => {
        if (id.startsWith('fixed-')) return; // Cannot remove fixed holidays
        if (activeTab !== 'selections') {
            if (activeTab === 'admin' || activeTab === 'management') return;
            try {
                await removeHoliday(activeTab as 'office' | 'field' | 'site', id);
                setToast({ message: 'Holiday removed successfully.', type: 'success' });
            } catch (error) {
                setToast({ message: 'Failed to remove holiday.', type: 'error' });
            }
        }
    };

    const handleAddPoolHoliday = () => {
        if (!newPoolHolidayName || !newPoolHolidayDate) {
            setToast({ message: 'Please provide both a name and a date.', type: 'error' });
            return;
        }

        // Convert YYYY-MM-DD to -MM-DD format for consistency with constants if needed
        const datePart = newPoolHolidayDate.substring(4); // Keep -MM-DD

        const pool = [...(currentRules.holidayPool || HOLIDAY_SELECTION_POOL)];
        pool.push({ name: newPoolHolidayName, date: datePart });
        pool.sort((a, b) => a.date.localeCompare(b.date));
        
            // Apply changes globaly to all categories so the pool is synced everywhere
            setLocalAttendance(prev => {
                const updated = { ...prev };
                const categories = ['office', 'field', 'site', 'admin', 'management'] as const;
                categories.forEach(cat => {
                    if (updated[cat]) {
                        updated[cat] = { ...updated[cat], holidayPool: pool };
                    }
                });
                return updated;
            });
            
            setNewPoolHolidayName('');
            setNewPoolHolidayDate('');
        };
    
        const handleRemovePoolHoliday = (index: number) => {
            const pool = [...(currentRules.holidayPool || HOLIDAY_SELECTION_POOL)];
            pool.splice(index, 1);
            
            setLocalAttendance(prev => {
                const updated = { ...prev };
                const categories = ['office', 'field', 'site', 'admin', 'management'] as const;
                categories.forEach(cat => {
                    if (updated[cat]) {
                        updated[cat] = { ...updated[cat], holidayPool: pool };
                    }
                });
                return updated;
            });
        };

    const handleEditPoolHoliday = (index: number) => {
        const pool = [...(currentRules.holidayPool || HOLIDAY_SELECTION_POOL)];
        const item = pool[index];
        setNewPoolHolidayName(item.name);
        setNewPoolHolidayDate(`${currentYear}${item.date}`);
        setEditingPoolIndex(index);
    };

    const handleSavePoolEdit = () => {
        if (editingPoolIndex === null) return;
        
        const dateStr = newPoolHolidayDate.substring(4);

        const pool = [...(currentRules.holidayPool || HOLIDAY_SELECTION_POOL)];
        pool[editingPoolIndex] = { name: newPoolHolidayName, date: dateStr };
        pool.sort((a, b) => a.date.localeCompare(b.date));
        
        setLocalAttendance(prev => {
            const updated = { ...prev };
            const categories = ['office', 'field', 'site', 'admin', 'management'] as const;
            categories.forEach(cat => {
                if (updated[cat]) {
                    updated[cat] = { ...updated[cat], holidayPool: pool };
                }
            });
            return updated;
        });

        setNewPoolHolidayName('');
        setNewPoolHolidayDate('');
        setEditingPoolIndex(null);
    };

    const handleSettingChange = (setting: keyof StaffAttendanceRules, value: any) => {
        if (activeTab === 'selections') return;
        setLocalAttendance(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab as 'office' | 'field' | 'site' | 'admin' | 'management'],
                [setting]: value
            }
        }));
    };

    const handleTriggerMissedCheckouts = async () => {
        if (!window.confirm('This will record a manual force check-out at the CURRENT TIME for all configured staff who haven\'t checked out today. Continue?')) {
            return;
        }

        setIsTriggering(true);
        try {
            const result = await api.triggerMissedCheckouts(localAttendance);
            setToast({ 
                message: `Successfully triggered missed check-outs for ${result.count} staff.`, 
                type: 'success' 
            });
        } catch (error) {
            console.error('Failed to trigger missed check-outs:', error);
            setToast({ message: 'Failed to trigger missed check-outs. Please try again.', type: 'error' });
        } finally {
            setIsTriggering(false);
        }
    };

    const handleSave = async () => {
        const isGlobal = selectedLocation === 'global' && !selectedCompanyId && !selectedEntityId;

        // For global scope: show the rule versioning impact modal first
        if (isGlobal) {
            setRuleVersionModal(prev => ({ ...prev, open: true, isLoadingImpact: true }));

            // Detect affected unlocked months (last 6 months)
            const impactMonths: { label: string; locked: boolean }[] = [];
            const today = new Date();
            for (let i = 1; i <= 6; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const locked = await api.isMonthLocked(d.getFullYear(), d.getMonth() + 1).catch(() => false);
                impactMonths.push({
                    label: format(d, 'MMMM yyyy'),
                    locked,
                });
            }
            setRuleVersionModal(prev => ({
                ...prev,
                isLoadingImpact: false,
                affectedMonths: impactMonths,
            }));
            return;
        }

        // Non-global scope: save directly (no versioning for scoped settings yet)
        await doSave();
    };

    const doSave = async (withVersion?: { effectiveFrom: string; changeReason: string }) => {
        setIsSaving(true);
        try {
            const isGlobal = selectedLocation === 'global' && !selectedCompanyId && !selectedEntityId;

            let scope: 'location' | 'company' | 'entity' | 'global' = 'global';
            let scopeId = '';

            if (selectedEntityId) {
                scope = 'entity';
                scopeId = selectedEntityId;
            } else if (selectedCompanyId) {
                scope = 'company';
                scopeId = selectedCompanyId;
            } else if (selectedLocation !== 'global') {
                scope = 'location';
                scopeId = selectedLocation;
            }

            if (scope === 'global') {
                if (withVersion && currentUser) {
                    // Save as versioned rule — closes previous version, inserts new
                    await api.saveAttendanceRuleVersion(
                        localAttendance,
                        withVersion.effectiveFrom,
                        currentUser.id,
                        currentUser.name,
                        withVersion.changeReason || undefined
                    );
                } else {
                    // Fallback plain save (non-global, or no user context)
                    await api.updateAttendanceSettings(localAttendance);
                }
                updateStore(localAttendance);
            } else {
                await api.saveScopedAttendanceSettings(scope as any, scopeId, localAttendance);
            }

            if (activeTab === 'site') {
                const siteId = selectedEntityId || selectedCompanyId || 'global';
                await supabase.from('lumpsum_billing_items').delete().eq('site_id', siteId);
                if (lumpsumItems.length > 0) {
                    const toInsert = lumpsumItems.map(item => ({
                        site_id: siteId,
                        item_name: item.itemName,
                        rate_per_month: item.ratePerMonth,
                        is_active: item.isActive
                    }));
                    await supabase.from('lumpsum_billing_items').insert(toInsert);
                }
            }

            setIsDirty(false);
            setRuleVersionModal(prev => ({ ...prev, open: false }));
            setToast({ message: `Settings saved${withVersion ? ` (effective ${withVersion.effectiveFrom})` : ''}!`, type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to save settings.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };


    if (isLoadingRoles) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 md:p-6 space-y-6 pb-40">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* ── Rule Version Impact Modal ───────────────────────────────────────── */}
            {ruleVersionModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200">
                        {/* Header */}
                        <div className="bg-amber-50 border-b border-amber-200 p-5 flex items-start gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-amber-900">Rule Change Impact</h2>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    This rule change will be versioned. Past locked months are protected.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Effective From */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Effective From <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={ruleVersionModal.effectiveFrom}
                                    onChange={e => setRuleVersionModal(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    New rule applies from the 1st of this month. Previous rule stays active for dates before this.
                                </p>
                            </div>

                            {/* Change Reason */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Change Reason (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. New financial year policy"
                                    value={ruleVersionModal.changeReason}
                                    onChange={e => setRuleVersionModal(prev => ({ ...prev, changeReason: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>

                            {/* Impact Preview */}
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Past 6 Months Impact</p>
                                {ruleVersionModal.isLoadingImpact ? (
                                    <p className="text-xs text-gray-400 animate-pulse">Checking locked months...</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {ruleVersionModal.affectedMonths.map(m => (
                                            <div key={m.label} className="flex items-center justify-between">
                                                <span className="text-xs text-gray-700">{m.label}</span>
                                                {m.locked ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        <Lock className="h-2.5 w-2.5" /> Protected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        <AlertTriangle className="h-2.5 w-2.5" /> Will recalculate
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-100">
                                💡 Lock past months first to freeze their data before saving this rule change.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-gray-100 p-4 flex gap-2 justify-end">
                            <button
                                onClick={() => setRuleVersionModal(prev => ({ ...prev, open: false }))}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => doSave({ effectiveFrom: ruleVersionModal.effectiveFrom, changeReason: ruleVersionModal.changeReason })}
                                disabled={isSaving || !ruleVersionModal.effectiveFrom}
                                className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-60 flex items-center gap-2"
                            >
                                <History className="h-4 w-4" />
                                {isSaving ? 'Saving...' : `Save from ${ruleVersionModal.effectiveFrom || '...'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary-text">Attendance & Leave Rules</h1>
                    <p className="text-muted mt-1">Set company-wide rules for attendance and leave calculation.</p>
                </div>
                <Button onClick={handleSave} isLoading={isSaving} disabled={!isDirty} size="md" className="py-2 px-6 shrink-0">
                    <Save className="mr-2 h-4 w-4" /> Save Rules
                </Button>
            </div>

            {/* ── Scope Filters Card ───────────────────────────────────────────────── */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider shrink-0">
                        <Settings className="h-3.5 w-3.5" /> Scope
                    </div>
                    <div className="flex flex-wrap gap-3 flex-1">
                        <div className="min-w-[180px]">
                            <Select
                                id="location-filter"
                                value={selectedLocation}
                                onChange={(e) => handleLocationChange(e.target.value)}
                            >
                                <option value="global">🌐 Global Rules</option>
                                {locations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="min-w-[180px] animate-in slide-in-from-right-2 duration-300">
                            <Select
                                id="society-filter"
                                value={selectedCompanyId}
                                onChange={(e) => handleCompanyChange(e.target.value)}
                            >
                                <option value="">All Societies</option>
                                {availableCompanies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="min-w-[180px] animate-in slide-in-from-right-2 duration-300">
                            <Select
                                id="entity-filter"
                                value={selectedEntityId}
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                            >
                                <option value="">All Entities</option>
                                {selectedCompanyId && (
                                    <option value={`${selectedCompanyId}_head_office`}>Head Office</option>
                                )}
                                {availableEntities.map(ent => (
                                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>
                </div>

                {/* ── Staff Type Tabs ─────────────────────────────────────────────── */}
                <div className="mt-5 border-t border-border pt-4">
                    <nav className="flex flex-wrap gap-1" aria-label="Staff type tabs">
                        {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && (
                            <>
                                <button onClick={() => handleTabChange('office')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                                    activeTab === 'office'
                                        ? 'bg-accent text-white shadow-sm'
                                        : 'text-muted hover:text-primary-text hover:bg-page'
                                }`}>
                                    Office Staff
                                </button>
                                <button onClick={() => handleTabChange('field')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                                    activeTab === 'field'
                                        ? 'bg-accent text-white shadow-sm'
                                        : 'text-muted hover:text-primary-text hover:bg-page'
                                }`}>
                                    Field Staff
                                </button>
                            </>
                        )}
                        {(!selectedEntityId || (selectedEntityId && selectedEntityId !== `${selectedCompanyId}_head_office`)) && (
                            <button onClick={() => handleTabChange('site')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                                activeTab === 'site'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-muted hover:text-primary-text hover:bg-page'
                            }`}>
                                Site Staff
                            </button>
                        )}
                        <button onClick={() => handleTabChange('admin')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                            activeTab === 'admin'
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-muted hover:text-primary-text hover:bg-page'
                        }`}>
                            Admin
                        </button>
                        <button onClick={() => handleTabChange('management')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                            activeTab === 'management'
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-muted hover:text-primary-text hover:bg-page'
                        }`}>
                            Management
                        </button>
                        <button onClick={() => handleTabChange('selections')} className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                            activeTab === 'selections'
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-muted hover:text-primary-text hover:bg-page'
                        }`}>
                            Staff Selections
                        </button>
                    </nav>
                    <div className="mt-2">
                        {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && activeTab === 'office' && <p className="text-xs text-muted">Applies to Receptionist, Accountant, and general Office Staff.</p>}
                        {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && activeTab === 'field' && <p className="text-xs text-muted">Applies to Field Staff and Field Managers.</p>}
                        {(!selectedEntityId || (selectedEntityId && selectedEntityId !== `${selectedCompanyId}_head_office`)) && activeTab === 'site' && <p className="text-xs text-muted">Applies to Site Staff (e.g. Site Managers, Security Guards).</p>}
                        {activeTab === 'admin' && <p className="text-xs text-muted">Applies to System Administrators and HR Admins.</p>}
                        {activeTab === 'management' && <p className="text-xs text-muted">Applies to Top Management, CEO, GM, etc.</p>}
                    </div>
                </div>

                {/* ── Sub-Tab Pills ───────────────────────────────────────────────── */}
                {activeTab !== 'selections' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                    {[
                        { key: 'general', label: 'General', icon: Settings },
                        { key: 'calc_rules', label: 'Calculation Rules', icon: BarChart3 },
                        ...(activeTab === 'site' 
                            ? [
                                { key: 'shifts', label: 'Shift Roster', icon: Clock },
                                { key: 'departments', label: 'Departments', icon: Building2 },
                                { key: 'lumpsum', label: 'Lumpsum Items', icon: Briefcase },
                                { key: 'billing_config', label: 'Staff Billing Config', icon: IndianRupee },
                                { key: 'summary', label: 'Summary Sheet', icon: FileText }
                              ]
                            : (activeTab === 'field'
                               ? [
                                   { key: 'travel', label: 'Travel & Fuel', icon: IndianRupee }
                                 ]
                               : [
                                   { key: 'fixed_hours', label: 'Fixed Hours', icon: Clock }
                                 ])),
                        { key: 'policies', label: 'Policies & Limits', icon: Shield },
                        { key: 'holidays', label: 'Holidays', icon: Palmtree },
                        { key: 'leaves', label: 'Leave Allocation', icon: LifeBuoy },
                        { key: 'notifications', label: 'Notifications & Geo', icon: Bell },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = subTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSubTab(tab.key as any)}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                    isActive
                                        ? 'bg-accent text-white border-accent shadow-sm shadow-accent/30'
                                        : 'bg-page text-muted border-border/50 hover:border-accent/40 hover:text-accent-dark'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                )}
            </div>

            {activeTab === 'selections' && <p className="text-sm text-muted">Select staff groups to include in automated actions like missed check-out triggers.</p>}


            <div className="space-y-6">
                {activeTab !== 'selections' && (
                <>
                <section style={{ display: subTab === 'general' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Settings className="mr-2 h-5 w-5 text-muted" />General Rules</h3>
                    {activeTab !== 'site' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <Input
                                label="Minimum Hours for Full Day"
                                id="minHoursFull"
                                type="number"
                                value={currentRules.minimumHoursFullDay}
                                onChange={(e) => handleSettingChange('minimumHoursFullDay', parseFloat(e.target.value) || 0)}
                            />
                            <Input
                                label="Minimum Hours for Half Day"
                                id="minHoursHalf"
                                type="number"
                                value={currentRules.minimumHoursHalfDay}
                                onChange={(e) => handleSettingChange('minimumHoursHalfDay', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    ) : (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl mb-6">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-blue-700">Shift-Based Attendance Enabled</h4>
                                    <p className="text-xs text-blue-600/80 leading-relaxed mt-1">
                                        For Site Staff, the system automatically calculates attendance codes (P, 0.75P, etc.) by comparing worked time against the <strong>Shift Roster</strong> window. Manual work duration goals are not required.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <Input
                            label="Check-in Grace Period (Minutes)"
                            id="gracePeriodMinutes"
                            type="number"
                            value={currentRules.gracePeriodMinutes || 0}
                            onChange={(e) => handleSettingChange('gracePeriodMinutes', parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 15"
                            className="max-w-xs"
                        />
                        <p className="text-xs text-muted mt-1">Allow up to this many minutes of delay before a shortfall or half-day is triggered.</p>
                    </div>

                    <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                        <Checkbox
                            id="enableOtToCompOffConversion"
                            label="Enable OT to Comp Off Conversion"
                            description="Automatically convert Overtime (OT) hours in a month into Compensatory Off days. Also shows the OT Calendar on User Dashboard."
                            checked={currentRules.enableOtToCompOffConversion || false}
                            onChange={(e) => handleSettingChange('enableOtToCompOffConversion', e.target.checked)}
                        />
                        <Checkbox
                            id="enableShortfall"
                            label="Enable Shortfall"
                            description="Show shortfall card and calendar on User Dashboard based on 8h net work goal."
                            checked={currentRules.enableShortfall || false}
                            onChange={(e) => handleSettingChange('enableShortfall', e.target.checked)}
                        />
                        {currentRules.enableOtToCompOffConversion && (
                            <div className="pl-8 w-full max-w-xs">
                                <Input
                                    label="OT Hours required for 1 Comp Off Day"
                                    id="otConversionThreshold"
                                    type="number"
                                    min="1"
                                    value={currentRules.otConversionThreshold || 8}
                                    onChange={(e) => handleSettingChange('otConversionThreshold', parseFloat(e.target.value) || 8)}
                                    description="Every X hours of OT adds 1 Comp Off day."
                                />
                            </div>
                        )}
                    </div>
                </section>

                <section style={{ display: subTab === 'policies' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Shield className="mr-2 h-5 w-5 text-muted" />Policies & Limits</h3>
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                        <Checkbox
                            id="enableViolationBlocking"
                            label="Enable Violation Blocking"
                            description="Restrict app access and hold salary automatically when a user reaches the strike limit (default 3)."
                            checked={currentRules.enableViolationBlocking ?? true}
                            onChange={(e) => handleSettingChange('enableViolationBlocking', e.target.checked)}
                        />
                        <Checkbox
                            id="enableFieldReport"
                            label="Enable Field Reports"
                            description="Automatically trigger field report submission upon check-out when geofencing is enabled."
                            checked={currentRules.enableFieldReport ?? true}
                            onChange={(e) => handleSettingChange('enableFieldReport', e.target.checked)}
                        />
                        <Checkbox
                            id="enablePermission"
                            label="Enable Permissions"
                            description="Allow users to request short permissions (e.g. arriving late or leaving early) up to a specific time limit. Approval required from reporting manager."
                            checked={currentRules.enablePermission || false}
                            onChange={(e) => handleSettingChange('enablePermission', e.target.checked)}
                        />
                        {currentRules.enablePermission && (
                            <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Max Permission Duration (Hours)"
                                    id="maxPermissionDurationHours"
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={currentRules.maxPermissionDurationHours || 2}
                                    onChange={(e) => handleSettingChange('maxPermissionDurationHours', parseFloat(e.target.value) || 2)}
                                    description="Maximum duration per permission request."
                                />
                                <Input
                                    label="Max Permissions Per Month"
                                    id="maxPermissionsPerMonth"
                                    type="number"
                                    min="1"
                                    value={currentRules.maxPermissionsPerMonth || 3}
                                    onChange={(e) => handleSettingChange('maxPermissionsPerMonth', parseInt(e.target.value) || 3)}
                                    description="Maximum number of permission requests allowed per month."
                                />
                            </div>
                        )}
                        <Checkbox
                            id="enableCorrectionLimits"
                            label="Enable Correction Limits"
                            description="Apply a specific duration limit and monthly quota to correction requests."
                            checked={currentRules.enableCorrectionLimits || false}
                            onChange={(e) => handleSettingChange('enableCorrectionLimits', e.target.checked)}
                        />
                        {currentRules.enableCorrectionLimits && (
                            <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l-2 border-red-500 rounded-md">
                                <Input
                                    label="Max Correction Duration (Hours)"
                                    id="maxCorrectionDurationHours"
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={currentRules.maxCorrectionDurationHours || 2}
                                    onChange={(e) => handleSettingChange('maxCorrectionDurationHours', parseFloat(e.target.value) || 2)}
                                    description="Maximum duration per correction request."
                                />
                                <Input
                                    label="Max Corrections Per Month"
                                    id="maxCorrectionsPerMonth"
                                    type="number"
                                    min="1"
                                    value={currentRules.maxCorrectionsPerMonth || 3}
                                    onChange={(e) => handleSettingChange('maxCorrectionsPerMonth', parseInt(e.target.value) || 3)}
                                    description="Maximum number of correction requests allowed per month."
                                />
                            </div>
                        )}

                        {activeTab === 'site' && (
                            <div className="mt-6 p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-xl space-y-4">
                                <h4 className="text-md font-bold text-emerald-800 flex items-center">
                                    <Shield className="mr-2 h-5 w-5 text-emerald-600" /> Holiday Configuration (Moved to Staff Billing Config)
                                </h4>
                                <p className="text-sm text-emerald-700">
                                    NH Billing Configuration and NH Salary Configuration are now managed at the individual staff level under the <strong>Staff Billing Config</strong> tab.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Calculation Rules Section — previously hardcoded, now configurable */}
                <section className="pt-6 border-t border-border" style={{ display: subTab === 'calc_rules' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
                        <Settings className="mr-2 h-5 w-5 text-muted" />Calculation Rules
                    </h3>
                    <p className="text-sm text-muted mb-4">
                        Configure how attendance status (P, 0.75P, 0.5P, 1/4P, A) is determined. These rules control the engine that calculates every employee's daily status.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                            <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Full Day (P)</label>
                            <p className="text-xs text-muted mb-1">Uses "Min Hours for Full Day" above</p>
                            <div className="text-lg font-black text-emerald-600">{currentRules.minimumHoursFullDay || 8}h+</div>
                        </div>
                        <Input
                            label="3/4 Day Hours (0.75P)"
                            id="threeQuarterDayHours"
                            type="number"
                            step="0.5"
                            min="0"
                            value={currentRules.threeQuarterDayHours ?? Math.round((currentRules.minimumHoursFullDay || 8) * 0.75 * 10) / 10}
                            onChange={(e) => handleSettingChange('threeQuarterDayHours', parseFloat(e.target.value) || 0)}
                            description={`Hours needed for 3/4 day status (0.75P). Default: ${Math.round((currentRules.minimumHoursFullDay || 8) * 0.75 * 10) / 10}h`}
                        />
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                            <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Half Day (0.5P)</label>
                            <p className="text-xs text-muted mb-1">Uses "Min Hours for Half Day" above</p>
                            <div className="text-lg font-black text-blue-600">{currentRules.minimumHoursHalfDay || 4}h+</div>
                        </div>
                        <Input
                            label="1/4 Day Hours (0.25P)"
                            id="quarterDayHours"
                            type="number"
                            step="0.5"
                            min="0"
                            value={currentRules.quarterDayHours ?? 2}
                            onChange={(e) => handleSettingChange('quarterDayHours', parseFloat(e.target.value) || 0)}
                            description="Hours needed for 1/4 day status (0.25P). Default: 2h"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <Input
                            label="Weekend Eligibility Threshold"
                            id="weekendPresentThreshold"
                            type="number"
                            min="0"
                            max="7"
                            value={currentRules.weekendPresentThreshold ?? 3}
                            onChange={(e) => handleSettingChange('weekendPresentThreshold', parseInt(e.target.value) || 0)}
                            description="Minimum days present in a week to earn paid status for W/O (Weekly Off), Holidays, and Leaves in the following week. Default: 3 days"
                        />
                        <div>
                            <label className="block text-sm font-medium text-primary-text mb-2">Weekly Off Days</label>
                            <div className="flex flex-wrap gap-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel, dayIdx) => {
                                    const offDays = currentRules.weeklyOffDays || [0];
                                    const isActive = offDays.includes(dayIdx);
                                    return (
                                        <button
                                            key={dayIdx}
                                            type="button"
                                            onClick={() => {
                                                const updated = isActive
                                                    ? offDays.filter((d: number) => d !== dayIdx)
                                                    : [...offDays, dayIdx].sort();
                                                handleSettingChange('weeklyOffDays', updated);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                isActive
                                                    ? 'bg-accent/20 border-accent text-accent-dark shadow-sm'
                                                    : 'bg-page border-border/50 text-muted hover:border-accent/50'
                                            }`}
                                        >
                                            {dayLabel}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted mt-1.5">Select which days are treated as Weekly Offs.</p>
                        </div>
                    </div>

                    {(activeTab === 'field' || activeTab === 'site') && (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <Checkbox
                                id="enableHoursBasedFallback"
                                label="Enable Hours-Based Fallback"
                                description="When site/GPS tracking returns 'Absent' but the employee has real working hours (e.g. Operation Managers), evaluate attendance based on worked hours instead. Recommended: ON."
                                checked={currentRules.enableHoursBasedFallback !== false}
                                onChange={(e) => handleSettingChange('enableHoursBasedFallback', e.target.checked)}
                            />
                        </div>
                    )}

                    {activeTab === 'site' && (
                        <div className="mt-6 p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-xl space-y-6">
                            <h4 className="text-md font-bold text-emerald-800 flex items-center">
                                <Briefcase className="mr-2 h-5 w-5 text-emerald-600" /> Contract & Billing Configuration (Site Staff Only)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Input
                                    label="CTC / Month (₹)"
                                    id="ctcPerMonth"
                                    type="number"
                                    min="0"
                                    value={currentRules.ctcPerMonth ?? 0}
                                    onChange={(e) => handleSettingChange('ctcPerMonth', parseFloat(e.target.value) || 0)}
                                    description="Fixed contractual monthly cost to company"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-primary-text mb-1">Weekly Offs per Week (X)</label>
                                    <Select
                                        id="weeklyOffsPerWeek"
                                        value={currentRules.weeklyOffsPerWeek ?? 1}
                                        onChange={(e) => handleSettingChange('weeklyOffsPerWeek', parseFloat(e.target.value) || 0)}
                                    >
                                        <option value="0">0 (None)</option>
                                        <option value="0.5">0.5 (2 per month)</option>
                                        <option value="1">1 (4 per month)</option>
                                        <option value="2">2 (8 per month)</option>
                                    </Select>
                                    <p className="text-[10px] text-muted mt-1">Weekly off days configured in contract</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-primary-text mb-1">Earned Leaves per Annum (Y)</label>
                                    <Select
                                        id="earnedLeavesPerAnnum"
                                        value={currentRules.earnedLeavesPerAnnum ?? 0}
                                        onChange={(e) => handleSettingChange('earnedLeavesPerAnnum', parseInt(e.target.value) || 0)}
                                    >
                                        <option value="0">0</option>
                                        <option value="18">18</option>
                                    </Select>
                                    <p className="text-[10px] text-muted mt-1">Annual EL quota</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-primary-text mb-1">NFH per Annum (Z)</label>
                                    <Select
                                        id="nfhPerAnnum"
                                        value={currentRules.nfhPerAnnum ?? 12}
                                        onChange={(e) => handleSettingChange('nfhPerAnnum', parseInt(e.target.value) || 0)}
                                    >
                                        <option value="0">0</option>
                                        <option value="10">10</option>
                                        <option value="12">12</option>
                                    </Select>
                                    <p className="text-[10px] text-muted mt-1">Annual National/Festival Holidays</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                        <p className="text-xs text-amber-600 font-medium">
                            <strong>How status is calculated:</strong> Employee worked hours are compared against these thresholds in order: Full Day → 0.75P → 0.5P → 0.25P → Absent. For field/site staff with GPS tracking, the site-time percentage is used first; if it returns Absent and fallback is ON, hours are used instead.
                        </p>
                    </div>
                </section>

                {/* Device Limits Section */}
                <section className="pt-6 border-t border-border" style={{ display: subTab === 'policies' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center">
                        <Monitor className="mr-2 h-5 w-5 text-muted" />Device Limits
                    </h3>
                    <p className="text-sm text-muted mb-4">
                        Set the maximum number of devices an employee can use to access the application. 
                        Exceeding these limits will require admin/HR approval.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Input
                            label="Web Sessions"
                            id="limitWeb"
                            type="number"
                            min="0"
                            value={currentRules.deviceLimits?.web ?? 1}
                            onChange={(e) => handleSettingChange('deviceLimits', { 
                                ...currentRules.deviceLimits, 
                                web: parseInt(e.target.value) || 0 
                            })}
                            description="Max allowed browsers"
                        />
                        <Input
                            label="Android Devices"
                            id="limitAndroid"
                            type="number"
                            min="0"
                            value={currentRules.deviceLimits?.android ?? 1}
                            onChange={(e) => handleSettingChange('deviceLimits', { 
                                ...currentRules.deviceLimits, 
                                android: parseInt(e.target.value) || 0 
                            })}
                        />
                        <Input
                            label="iOS Devices"
                            id="limitIos"
                            type="number"
                            min="0"
                            value={currentRules.deviceLimits?.ios ?? 1}
                            onChange={(e) => handleSettingChange('deviceLimits', { 
                                ...currentRules.deviceLimits, 
                                ios: parseInt(e.target.value) || 0 
                            })}
                        />
                    </div>
                </section>

                    {/* Fixed Office Hours - Applicable for Office AND Field Staff now */}
                    {(activeTab === 'office' || activeTab === 'field' || activeTab === 'admin' || activeTab === 'management') && (
                    <section className="pt-6 border-t border-border">
                        <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-muted" />Fixed Office Hours</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                            <Input
                                label="Check-in Start Time"
                                id="checkInTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.checkInTime || '09:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, checkInTime: e.target.value })}
                            />
                            <Input
                                label="Check-out End Time"
                                id="checkOutTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.checkOutTime || '19:30'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, checkOutTime: e.target.value })}
                            />
                            <Input
                                label="Lunch Break Start"
                                id="breakInTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.breakInTime || '13:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, breakInTime: e.target.value })}
                            />
                            <Input
                                label="Lunch Break End"
                                id="breakOutTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.breakOutTime || '14:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, breakOutTime: e.target.value })}
                            />
                            <Input
                                label="Default Site OT In"
                                id="siteOtInTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.siteOtInTime || '18:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, siteOtInTime: e.target.value })}
                            />
                            <Input
                                label="Default Site OT Out"
                                id="siteOtOutTime"
                                type="time"
                                value={currentRules.fixedOfficeHours?.siteOtOutTime || '20:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, siteOtOutTime: e.target.value })}
                            />
                            <Input
                                label="Min Daily Hours"
                                id="minDailyHours"
                                type="number"
                                value={currentRules.dailyWorkingHours?.min || 7}
                                onChange={(e) => handleSettingChange('dailyWorkingHours', { ...currentRules.dailyWorkingHours, min: parseFloat(e.target.value) || 7 })}
                            />
                            <Input
                                label="Max Daily Hours"
                                id="maxDailyHours"
                                type="number"
                                value={currentRules.dailyWorkingHours?.max || 9}
                                onChange={(e) => handleSettingChange('dailyWorkingHours', { ...currentRules.dailyWorkingHours, max: parseFloat(e.target.value) || 9 })}
                            />
                        </div>
                    </section>
                    )}

                    {/* Shift Management - Only for Site Staff */}
                    {subTab === 'shifts' && (
                    <section className="pt-6 border-t border-border">
                        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
                            <Clock className="mr-2 h-5 w-5 text-muted" />Shift Management
                        </h3>
                        <p className="text-sm text-muted mb-4">Configure shift windows for site staff. Attendance is auto-detected based on punch-in time — no duty roster needed.</p>
                        
                        {activeTab === 'site' && (
                            <div className="mb-6 p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-xl space-y-4">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center">
                                    <Clock className="mr-1.5 h-4.5 w-4.5 text-emerald-600" /> Default Shift Configuration
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-primary-text mb-1">Standard Shift ID</label>
                                        <Select
                                            id="defaultShift"
                                            value={currentRules.shift || 'A'}
                                            onChange={(e) => handleSettingChange('shift', e.target.value)}
                                        >
                                            <option value="A">Shift A</option>
                                            <option value="B">Shift B</option>
                                            <option value="C">Shift C</option>
                                            <option value="D">Shift D</option>
                                            <option value="E">Shift E</option>
                                        </Select>
                                        <p className="text-[10px] text-muted mt-1">Default assigned shift identifier.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-primary-text mb-1">Standard Shift Hours</label>
                                        <Select
                                            id="defaultShiftHours"
                                            value={currentRules.shiftHours ?? 8}
                                            onChange={(e) => handleSettingChange('shiftHours', parseInt(e.target.value) || 8)}
                                        >
                                            <option value="8">8 Hours</option>
                                            <option value="10">10 Hours</option>
                                            <option value="12">12 Hours</option>
                                        </Select>
                                        <p className="text-[10px] text-muted mt-1">Daily hours configured for standard shift.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <Checkbox
                                id="enableShiftManagement"
                                label="Enable Shift Management"
                                description="When enabled, auto-checkout is disabled for site staff. They punch out manually. Hours are calculated based on the detected shift window."
                                checked={currentRules.enableShiftManagement || false}
                                onChange={(e) => handleSettingChange('enableShiftManagement', e.target.checked)}
                            />

                            {currentRules.enableShiftManagement && (
                                <div className="w-full md:w-auto min-w-[200px] mt-2 md:mt-0">
                                    <label className="block text-xs font-semibold text-primary-text mb-1">
                                        Shift Grace Period (minutes)
                                    </label>
                                    <Input
                                        id="shiftGraceMinutes"
                                        type="number"
                                        min="0"
                                        max="60"
                                        placeholder="e.g. 15"
                                        value={currentRules.shiftGraceMinutes ?? 15}
                                        onChange={(e) => handleSettingChange('shiftGraceMinutes', parseInt(e.target.value) || 0)}
                                    />
                                    <p className="text-[10px] text-muted mt-1">Shortage minutes allowed for full present (P) status.</p>
                                </div>
                            )}
                        </div>

                        {currentRules.enableShiftManagement && (
                            <>
                                {/* Shift Table */}
                                <div className="rounded-xl border border-border overflow-hidden mb-4">
                                    <table className="w-full text-sm">
                                        <thead className="bg-page">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-semibold text-primary-text">Shift Name</th>
                                                <th className="text-left px-4 py-3 font-semibold text-primary-text">Start Time</th>
                                                <th className="text-left px-4 py-3 font-semibold text-primary-text">End Time</th>
                                                <th className="text-center px-4 py-3 font-semibold text-primary-text">Shift Type</th>
                                                <th className="text-left px-4 py-3 font-semibold text-primary-text">Buffer (min)</th>
                                                <th className="text-center px-4 py-3 font-semibold text-primary-text">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(currentRules.siteShifts || []).map((shift: SiteShiftDefinition, idx: number) => {
                                                // Auto-detect if shift crosses midnight
                                                const startMin = parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1] || '0');
                                                const endMin = parseInt(shift.endTime.split(':')[0]) * 60 + parseInt(shift.endTime.split(':')[1] || '0');
                                                const isCrossMidnight = endMin < startMin;

                                                return (
                                                    <tr key={shift.id} className="border-t border-border/50 hover:bg-accent/5 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <input
                                                                id={`shift-name-${idx}`}
                                                                type="text"
                                                                className="w-full bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none"
                                                                value={shift.name}
                                                                onChange={(e) => {
                                                                    const updated = [...(currentRules.siteShifts || [])];
                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                    handleSettingChange('siteShifts', updated);
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="time"
                                                                className="bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none"
                                                                value={shift.startTime}
                                                                onChange={(e) => {
                                                                    const updated = [...(currentRules.siteShifts || [])];
                                                                    const newStart = e.target.value;
                                                                    const newEndMin = parseInt(updated[idx].endTime.split(':')[0]) * 60 + parseInt(updated[idx].endTime.split(':')[1] || '0');
                                                                    const newStartMin = parseInt(newStart.split(':')[0]) * 60 + parseInt(newStart.split(':')[1] || '0');
                                                                    updated[idx] = { ...updated[idx], startTime: newStart, crossesMidnight: newEndMin < newStartMin };
                                                                    handleSettingChange('siteShifts', updated);
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="time"
                                                                className="bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none"
                                                                value={shift.endTime}
                                                                onChange={(e) => {
                                                                    const updated = [...(currentRules.siteShifts || [])];
                                                                    const newEnd = e.target.value;
                                                                    const newStartMin = parseInt(updated[idx].startTime.split(':')[0]) * 60 + parseInt(updated[idx].startTime.split(':')[1] || '0');
                                                                    const newEndMin = parseInt(newEnd.split(':')[0]) * 60 + parseInt(newEnd.split(':')[1] || '0');
                                                                    updated[idx] = { ...updated[idx], endTime: newEnd, crossesMidnight: newEndMin < newStartMin };
                                                                    handleSettingChange('siteShifts', updated);
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {isCrossMidnight 
                                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 text-[10px] font-bold uppercase tracking-wider"><Moon className="h-3 w-3" />Night</span>
                                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider"><Sun className="h-3 w-3" />Day</span>
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="120"
                                                                className="w-20 bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none"
                                                                value={shift.autoCheckoutBufferMinutes ?? 30}
                                                                onChange={(e) => {
                                                                    const updated = [...(currentRules.siteShifts || [])];
                                                                    updated[idx] = { ...updated[idx], autoCheckoutBufferMinutes: parseInt(e.target.value) || 0 };
                                                                    handleSettingChange('siteShifts', updated);
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        document.getElementById(`shift-name-${idx}`)?.focus();
                                                                    }}
                                                                    className="text-indigo-400 hover:text-indigo-600 transition-colors p-1"
                                                                    title="Edit shift"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updated = (currentRules.siteShifts || []).filter((_: any, i: number) => i !== idx);
                                                                        handleSettingChange('siteShifts', updated);
                                                                    }}
                                                                    className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                                    title="Remove shift"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Add Shift Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const shifts = [...(currentRules.siteShifts || [])];
                                        const nextId = `shift_${String.fromCharCode(97 + shifts.length)}`; // shift_d, shift_e, etc.
                                        shifts.push({
                                            id: nextId,
                                            name: `Shift ${String.fromCharCode(65 + shifts.length)}`,
                                            startTime: '06:00',
                                            endTime: '14:00',
                                            crossesMidnight: false,
                                            autoCheckoutBufferMinutes: 30
                                        });
                                        handleSettingChange('siteShifts', shifts);
                                    }}
                                    className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-dark transition-colors px-4 py-2 rounded-lg border border-dashed border-accent/30 hover:border-accent/60"
                                >
                                    <Plus className="h-4 w-4" /> Add Shift
                                </button>

                                {/* Info Card */}
                                <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/15 rounded-lg">
                                    <p className="text-xs text-blue-600 font-medium">
                                        <strong>How shift detection works:</strong> When site staff punches in, the system automatically matches 
                                        them to the shift window that contains their punch-in time. Night shifts (crossing midnight) will keep the 
                                        session active until the next morning. Auto-checkout is <strong>disabled</strong> for site staff — they must punch out manually.
                                    </p>
                                </div>
                            </>
                        )}
                    </section>
                    )}

                    {/* Site Attendance Department Configuration — Only for Site Staff */}
                    {activeTab === 'site' && subTab === 'departments' && (
                        <SiteAttendanceConfig
                            currentRules={currentRules}
                            onSettingChange={handleSettingChange}
                        />
                    )}

                    {activeTab === 'site' && subTab === 'lumpsum' && (
                        <section className="pt-6 border-t border-border space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-primary-text flex items-center">
                                        <Briefcase className="mr-2 h-5 w-5 text-muted" /> Lumpsum Billing Items
                                    </h3>
                                    <p className="text-sm text-muted">
                                        Manage non-attendance contractual billing items (e.g. machinery rental, consumables, management fee) for this site.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLumpsumItems([
                                            ...lumpsumItems,
                                            { itemName: '', ratePerMonth: 0, isActive: true }
                                        ]);
                                        setIsDirty(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    <Plus className="h-4 w-4" /> Add Lumpsum Item
                                </button>
                            </div>

                            <div className="rounded-xl border border-border overflow-hidden bg-card">
                                <table className="w-full text-sm">
                                    <thead className="bg-page border-b border-border">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold text-primary-text">Item Name</th>
                                            <th className="text-left px-4 py-3 font-semibold text-primary-text w-1/3">Rate Per Month (₹)</th>
                                            <th className="text-center px-4 py-3 font-semibold text-primary-text w-24">Status</th>
                                            <th className="text-center px-4 py-3 font-semibold text-primary-text w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {lumpsumItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-muted">
                                                    No lumpsum items configured. Click "Add Lumpsum Item" to add one.
                                                </td>
                                            </tr>
                                        ) : (
                                            lumpsumItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3">
                                                        <Input
                                                            id={`itemName-${idx}`}
                                                            value={item.itemName}
                                                            onChange={(e) => {
                                                                const updated = [...lumpsumItems];
                                                                updated[idx].itemName = e.target.value;
                                                                setLumpsumItems(updated);
                                                                setIsDirty(true);
                                                            }}
                                                            placeholder="e.g. Consumibles, Machinery Rent"
                                                            className="w-full border-none shadow-none focus:ring-0 bg-transparent p-0"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Input
                                                            id={`ratePerMonth-${idx}`}
                                                            type="number"
                                                            min="0"
                                                            value={item.ratePerMonth}
                                                            onChange={(e) => {
                                                                const updated = [...lumpsumItems];
                                                                updated[idx].ratePerMonth = parseFloat(e.target.value) || 0;
                                                                setLumpsumItems(updated);
                                                                setIsDirty(true);
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full border-none shadow-none focus:ring-0 bg-transparent p-0"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.isActive}
                                                            onChange={(e) => {
                                                                const updated = [...lumpsumItems];
                                                                updated[idx].isActive = e.target.checked;
                                                                setLumpsumItems(updated);
                                                                setIsDirty(true);
                                                            }}
                                                            className="h-4 w-4 text-emerald-600 border-border rounded focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const updated = lumpsumItems.filter((_, i) => i !== idx);
                                                                setLumpsumItems(updated);
                                                                setIsDirty(true);
                                                            }}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {activeTab === 'site' && subTab === 'billing_config' && (
                        <section className="pt-6 border-t border-border space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold text-primary-text flex items-center">
                                    <IndianRupee className="mr-2 h-5 w-5 text-muted" /> Individual Staff Billing Parameters
                                </h3>
                                <p className="text-sm text-muted">
                                    Manage individual site staff CTC, weekly offs, earned leaves, and national holiday billing configurations.
                                </p>
                            </div>
                            <StaffBillingConfig />
                        </section>
                    )}


                    {/* Site & Travel Tracking - Only for Field Staff */}
                    {activeTab === 'field' && (
                    <section className="pt-6 border-t border-border">
                        <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center">
                            <Clock className="mr-2 h-5 w-5 text-muted" />
                            Site & Travel Time Tracking
                        </h3>
                        <div className="mb-4">
                            <Checkbox
                                id="enableSiteTimeTracking"
                                label="Enable Site/Travel Time Validation"
                                description="Track and validate the percentage of time field staff spend on-site vs traveling"
                                checked={currentRules.enableSiteTimeTracking || false}
                                onChange={(e) => handleSettingChange('enableSiteTimeTracking', e.target.checked)}
                            />
                        </div>
                        {currentRules.enableSiteTimeTracking && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                                    <Input
                                        label="Minimum Site Time (%)"
                                        id="minimumSitePercentage"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={currentRules.minimumSitePercentage || 75}
                                        onChange={(e) => handleSettingChange('minimumSitePercentage', parseFloat(e.target.value) || 75)}
                                    />
                                    <Input
                                        label="Maximum Travel Time (%)"
                                        id="maximumTravelPercentage"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={currentRules.maximumTravelPercentage || 25}
                                        onChange={(e) => handleSettingChange('maximumTravelPercentage', parseFloat(e.target.value) || 25)}
                                    />
                                </div>
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <p className="text-sm text-blue-400 mb-2">
                                        <strong>How it works:</strong>
                                    </p>
                                    <ul className="text-sm text-blue-400 space-y-1 list-disc list-inside">
                                        <li><strong>Site Time:</strong> Sum of all (check-out - check-in) durations at each site location</li>
                                        <li><strong>Travel Time:</strong> Time between sites (site checkout → next site check-in)</li>
                                        <li><strong>Example:</strong> 8 hrs total → 6 hrs on-site (75%) + 2 hrs travel (25%) = Present</li>
                                        <li><strong>Violation:</strong> If site time falls below {currentRules.minimumSitePercentage || 75}%, a violation is created and the reporting manager is notified</li>
                                        <li><strong>Grant Attendance:</strong> Manager acknowledgment of violation grants (P) Present status for the day</li>
                                    </ul>
                                </div>
                            </>
                        )}
                    </section>
                    )}


                    <section className="pt-6 border-t border-border" style={{ display: subTab === 'policies' ? undefined : 'none' }}>
                        <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-muted" />Break Tracking</h3>
                        <div className="space-y-4">
                            <Checkbox
                                id="enableBreakTracking"
                                label="Enable Break Tracking"
                                description="Allow employees to record lunch breaks. Working hours will exclude break time."
                                checked={currentRules.enableBreakTracking || false}
                                onChange={(e) => handleSettingChange('enableBreakTracking', e.target.checked)}
                            />
                            {currentRules.enableBreakTracking && (
                                <Input
                                    label="Standard Lunch Break Duration (minutes)"
                                    id="lunchBreakDuration"
                                    type="number"
                                    value={currentRules.lunchBreakDuration || 60}
                                    onChange={(e) => handleSettingChange('lunchBreakDuration', parseInt(e.target.value, 10) || 60)}
                                />
                            )}
                        </div>
                    </section>


                <section className="pt-6 border-t border-border" style={{ display: subTab === 'leaves' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><LifeBuoy className="mr-2 h-5 w-5 text-muted" />Leave Allocation</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col">
                            <Input
                                label="Annual Earned Leaves"
                                id="annualEarnedLeaves"
                                type="number"
                                value={currentRules.annualEarnedLeaves}
                                onChange={(e) => handleSettingChange('annualEarnedLeaves', parseInt(e.target.value, 10) || 0)}
                                description="Base annual quota if dynamic accrual is disabled."
                            />
                            <div className="mt-4 space-y-4">
                                <DatePicker
                                    label="Valid From"
                                    id="earnedLeavesValidFrom"
                                    value={currentRules.earnedLeavesValidFrom || ''}
                                    onChange={(date) => handleSettingChange('earnedLeavesValidFrom', date)}
                                />
                                <DatePicker
                                    label="Valid Till"
                                    id="earnedLeavesExpiryDate"
                                    value={currentRules.earnedLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('earnedLeavesExpiryDate', date)}
                                />
                                {(!currentRules.earnedLeavesValidFrom && !currentRules.earnedLeavesExpiryDate) ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity Range</p>
                                ) : (
                                    (() => {
                                        const now = new Date().toISOString().split('T')[0];
                                        const from = currentRules.earnedLeavesValidFrom;
                                        const till = currentRules.earnedLeavesExpiryDate;
                                        const isInvalid = (from && now < from) || (till && now > till);
                                        return isInvalid ? (
                                            <p className="text-xs text-amber-500 mt-1">⚠ Invalid - Outside Range</p>
                                        ) : (
                                            <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <Input
                                label="Annual Sick Leaves"
                                id="annualSickLeaves"
                                type="number"
                                value={currentRules.annualSickLeaves}
                                onChange={(e) => handleSettingChange('annualSickLeaves', parseInt(e.target.value, 10) || 0)}
                            />
                            <div className="mt-4 space-y-4">
                                <DatePicker
                                    label="Valid From"
                                    id="sickLeavesValidFrom"
                                    value={currentRules.sickLeavesValidFrom || ''}
                                    onChange={(date) => handleSettingChange('sickLeavesValidFrom', date)}
                                />
                                <DatePicker
                                    label="Valid Till"
                                    id="sickLeavesExpiryDate"
                                    value={currentRules.sickLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('sickLeavesExpiryDate', date)}
                                />
                                {(!currentRules.sickLeavesValidFrom && !currentRules.sickLeavesExpiryDate) ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity Range</p>
                                ) : (
                                    (() => {
                                        const now = new Date().toISOString().split('T')[0];
                                        const from = currentRules.sickLeavesValidFrom;
                                        const till = currentRules.sickLeavesExpiryDate;
                                        const isInvalid = (from && now < from) || (till && now > till);
                                        return isInvalid ? (
                                            <p className="text-xs text-amber-500 mt-1">⚠ Invalid - Outside Range</p>
                                        ) : (
                                            <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <Input
                                label="Monthly Floating Holidays"
                                id="monthlyFloatingLeaves"
                                type="number"
                                value={currentRules.monthlyFloatingLeaves}
                                onChange={(e) => handleSettingChange('monthlyFloatingLeaves', parseInt(e.target.value, 10) || 0)}
                            />
                            <div className="mt-4 space-y-4">
                                <Select
                                    label="Year Type"
                                    id="floatingHolidayYearType"
                                    value={currentRules.floatingHolidayYearType || 'calendar'}
                                    onChange={(e) => handleSettingChange('floatingHolidayYearType', e.target.value)}
                                >
                                    <option value="calendar">Calendar Year (Jan - Dec)</option>
                                    <option value="financial">Financial Year (Apr - Mar)</option>
                                </Select>
                                
                                <div>
                                    <label className="block text-sm font-medium text-primary-text mb-2">Applicable Months</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(currentRules.floatingHolidayYearType === 'financial' 
                                            ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2] // Apr to Mar
                                            : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // Jan to Dec
                                        ).map((monthIdx) => {
                                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                            const selectedMonths = currentRules.floatingHolidayMonths || [];
                                            const isActive = selectedMonths.includes(monthIdx);
                                            return (
                                                <button
                                                    key={monthIdx}
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = isActive
                                                            ? selectedMonths.filter(m => m !== monthIdx)
                                                            : [...selectedMonths, monthIdx].sort((a, b) => a - b);
                                                        handleSettingChange('floatingHolidayMonths', updated);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                        isActive
                                                            ? 'bg-accent/20 border-accent text-accent-dark shadow-sm'
                                                            : 'bg-page border-border/50 text-muted hover:border-accent/50'
                                                    }`}
                                                >
                                                    {monthNames[monthIdx]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted mt-1.5">Months without floating holidays will be normal working days.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <h4 className="text-sm font-semibold text-emerald-600 mb-4 flex items-center">
                            <Settings className="mr-2 h-4 w-4" /> Earned Leave Accrual Rule
                        </h4>
                        <div className="flex flex-col gap-4">
                            <Checkbox
                                id="enableAccrual"
                                label="Enable Dynamic Accrual"
                                description="Automatically calculate earned leave based on attendance history."
                                checked={!!currentRules.earnedLeaveAccrual}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleSettingChange('earnedLeaveAccrual', { daysRequired: 10, amountEarned: 0.5 });
                                    } else {
                                        handleSettingChange('earnedLeaveAccrual', undefined);
                                    }
                                }}
                            />
                            
                            {currentRules.earnedLeaveAccrual && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-8">
                                    <Input
                                        label="Days Required"
                                        type="number"
                                        value={currentRules.earnedLeaveAccrual.daysRequired}
                                        onChange={(e) => handleSettingChange('earnedLeaveAccrual', {
                                            ...currentRules.earnedLeaveAccrual,
                                            daysRequired: parseFloat(e.target.value) || 10
                                        })}
                                        description="Countable days (Worked + Holiday + Weekoff)"
                                    />
                                    <Input
                                        label="Leave Earned (Days)"
                                        type="number"
                                        step="0.1"
                                        value={currentRules.earnedLeaveAccrual.amountEarned}
                                        onChange={(e) => handleSettingChange('earnedLeaveAccrual', {
                                            ...currentRules.earnedLeaveAccrual,
                                            amountEarned: parseFloat(e.target.value) || 0.5
                                        })}
                                        description="Amount of leave granted per period"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <h4 className="text-sm font-semibold text-emerald-600 mb-4 flex items-center">
                            <LifeBuoy className="mr-2 h-4 w-4" /> Sick Leave Accrual Rule
                        </h4>
                        <div className="flex flex-col gap-4">
                            <Checkbox
                                id="enableSickAccrual"
                                label="Enable Monthly Sick Leave Accrual"
                                description="Automatically grant 1 day of sick leave for every month with attendance."
                                checked={!!currentRules.enableSickLeaveAccrual}
                                onChange={(e) => handleSettingChange('enableSickLeaveAccrual', e.target.checked)}
                            />
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h4 className="text-sm font-semibold text-pink-600 flex items-center mb-0">
                                <LifeBuoy className="mr-2 h-4 w-4" /> Maternity & Child Care Leave (Female Employees)
                            </h4>
                            <Checkbox
                                label="Enable Maternity & Child Care Leave"
                                checked={!!currentRules.enableMaternityChildCare}
                                onChange={(e) => handleSettingChange('enableMaternityChildCare', e.target.checked)}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Input
                                label="Maternity Leave (weeks)"
                                id="maternityLeaveWeeks"
                                type="number"
                                value={currentRules.maternityLeaveWeeks ?? 26}
                                onChange={(e) => handleSettingChange('maternityLeaveWeeks', parseInt(e.target.value, 10) || 26)}
                                description="26 weeks as per policy (8 before + 18 after delivery)"
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                            <Input
                                label="Min. Tenure (months)"
                                id="maternityMinTenureMonths"
                                type="number"
                                value={currentRules.maternityMinTenureMonths ?? 6}
                                onChange={(e) => handleSettingChange('maternityMinTenureMonths', parseInt(e.target.value, 10) || 6)}
                                description="Minimum months in company to be eligible"
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                            <Input
                                label="Child Care (< 5 yrs)"
                                id="childCareLeaveUnder5"
                                type="number"
                                value={currentRules.childCareLeaveUnder5 ?? 6}
                                onChange={(e) => handleSettingChange('childCareLeaveUnder5', parseInt(e.target.value, 10) || 6)}
                                description="Days/year for child under 5 years"
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                            <Input
                                label="Child Care (5-15 yrs)"
                                id="childCareLeave5to15"
                                type="number"
                                value={currentRules.childCareLeave5to15 ?? 3}
                                onChange={(e) => handleSettingChange('childCareLeave5to15', parseInt(e.target.value, 10) || 3)}
                                description="Days/year for child 5-15 years"
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 p-4 bg-white/5 rounded-lg">
                            <DatePicker
                                label="Child Care Valid From"
                                id="childCareLeavesValidFrom"
                                value={currentRules.childCareLeavesValidFrom || ''}
                                onChange={(date) => handleSettingChange('childCareLeavesValidFrom', date)}
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                            <DatePicker
                                label="Child Care Valid Till"
                                id="childCareLeavesExpiryDate"
                                value={currentRules.childCareLeavesExpiryDate || ''}
                                onChange={(date) => handleSettingChange('childCareLeavesExpiryDate', date)}
                                disabled={!currentRules.enableMaternityChildCare}
                            />
                            <div className="flex items-end pb-2">
                                {(!currentRules.childCareLeavesValidFrom && !currentRules.childCareLeavesExpiryDate) ? (
                                    <p className="text-xs text-gray-400">No Validity Range</p>
                                ) : (
                                    (() => {
                                        const now = new Date().toISOString().split('T')[0];
                                        const from = currentRules.childCareLeavesValidFrom;
                                        const till = currentRules.childCareLeavesExpiryDate;
                                        const isInvalid = (from && now < from) || (till && now > till);
                                        return isInvalid ? (
                                            <p className="text-xs text-amber-500">⚠ Invalid - Outside Range</p>
                                        ) : (
                                            <p className="text-xs text-emerald-500">✓ Valid</p>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        <div className="flex flex-col">
                            <Input
                                label="Annual Compensatory Off"
                                id="annualCompOffLeaves"
                                type="number"
                                value={currentRules.annualCompOffLeaves}
                                onChange={(e) => handleSettingChange('annualCompOffLeaves', parseInt(e.target.value, 10) || 0)}
                            />
                            <div className="mt-4 space-y-4">
                                <DatePicker
                                    label="Valid From"
                                    id="compOffLeavesValidFrom"
                                    value={currentRules.compOffLeavesValidFrom || ''}
                                    onChange={(date) => handleSettingChange('compOffLeavesValidFrom', date)}
                                />
                                <DatePicker
                                    label="Valid Till"
                                    id="compOffLeavesExpiryDate"
                                    value={currentRules.compOffLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('compOffLeavesExpiryDate', date)}
                                />
                                {(!currentRules.compOffLeavesValidFrom && !currentRules.compOffLeavesExpiryDate) ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity Range</p>
                                ) : (
                                    (() => {
                                        const now = new Date().toISOString().split('T')[0];
                                        const from = currentRules.compOffLeavesValidFrom;
                                        const till = currentRules.compOffLeavesExpiryDate;
                                        const isInvalid = (from && now < from) || (till && now > till);
                                        return isInvalid ? (
                                            <p className="text-xs text-amber-500 mt-1">⚠ Invalid - Outside Range</p>
                                        ) : (
                                            <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                        <Input
                            label="Sick Leave Cert. After (Days)"
                            id="sickLeaveCertThreshold"
                            type="number"
                            value={currentRules.sickLeaveCertificateThreshold}
                            onChange={(e) => handleSettingChange('sickLeaveCertificateThreshold', parseInt(e.target.value, 10) || 0)}
                            title="Require a doctor's certificate if total sick leave taken exceeds this number of days."
                        />
                    </div>
                </section>

                <section className="pt-6 border-t border-border" style={{ display: subTab === 'notifications' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Bell className="mr-2 h-5 w-5 text-muted" />Notifications</h3>
                    <Checkbox
                        id="attendance-notifications"
                        label="Enable Check-in/Check-out Notifications"
                        description="Send a notification to Site Managers, Ops Managers, and HR when a Field Staff checks in or out."
                        checked={currentRules.enableAttendanceNotifications}
                        onChange={(e) => handleSettingChange('enableAttendanceNotifications', e.target.checked)}
                    />
                </section>

                <section className="pt-6 border-t border-border" style={{ display: subTab === 'notifications' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Settings className="mr-2 h-5 w-5 text-muted" />Geofencing Verification</h3>
                    <div className="space-y-4">
                        <Checkbox
                            id="geofencing-verification"
                            label="Enable Geofencing Verification"
                            description={
                                activeTab === 'office' 
                                    ? "Verify office staff are at PIFS Bangalore office (100m radius) during check-in/out. Violations are tracked and salary may be withheld."
                                    : activeTab === 'field'
                                        ? "Verify field staff are at their assigned location during check-in/out. Violations are tracked and salary may be withheld after exceeding the limit."
                                        : "Verify site staff are at their assigned site during check-in/out. Geofencing is strictly enforced."
                            }
                            checked={currentRules.geofencingEnabled}
                            onChange={(e) => {
                                const isChecked = e.target.checked;
                                handleSettingChange('geofencingEnabled', isChecked);
                                if (isChecked && activeTab === 'field') {
                                    handleSettingChange('enableFieldReport', true);
                                }
                            }}
                        />
                        <Input
                            label="Maximum Violations Per Month"
                            id="maxViolations"
                            type="number"
                            value={currentRules.maxViolationsPerMonth}
                            onChange={(e) => handleSettingChange('maxViolationsPerMonth', parseInt(e.target.value) || 3)}
                            title="After this many violations in a month, salary will be put on hold"
                        />
                    </div>
                </section>

                <section className="pt-6 border-t border-border" style={{ display: subTab === 'summary' ? undefined : 'none' }}>
                    <SiteAttendanceSummary currentRules={currentRules} />
                </section>

                <section className="pt-6 border-t border-border" style={{ display: subTab === 'holidays' ? undefined : 'none' }}>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Calendar className="mr-2 h-5 w-5 text-muted" />Recurring Holidays</h3>
                    <div className="p-4 bg-page rounded-lg border border-border/50">
                        <h4 className="font-semibold mb-3">Add Recurring Holiday</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <Select label="Occurrence" value={newRecurringN} onChange={e => setNewRecurringN(parseInt(e.target.value))}>
                                <option value={1}>1st</option>
                                <option value={2}>2nd</option>
                                <option value={3}>3rd</option>
                                <option value={4}>4th</option>
                                <option value={5}>5th</option>
                            </Select>
                            <Select label="Day" value={newRecurringDay} onChange={e => setNewRecurringDay(e.target.value)}>
                                <option value="Monday">Monday</option>
                                <option value="Tuesday">Tuesday</option>
                                <option value="Wednesday">Wednesday</option>
                                <option value="Thursday">Thursday</option>
                                <option value="Friday">Friday</option>
                                <option value="Saturday">Saturday</option>
                                <option value="Sunday">Sunday</option>
                            </Select>
                        </div>

                        {/* Role Eligibility Picker */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                                Eligible Roles
                                <span className="ml-1 text-[10px] font-normal normal-case text-muted/70">(leave empty = all roles in this category)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 p-3 bg-white/5 rounded-lg border border-border/50 max-h-36 overflow-y-auto">
                                {allRoles
                                    .filter(r => {
                                        const mapping = localAttendance.missedCheckoutConfig?.roleMapping;
                                        if (!mapping) return true;
                                        const catRoles = (mapping as any)[activeTab] as string[] | undefined;
                                        return !catRoles || catRoles.length === 0 || catRoles.includes(r.id);
                                    })
                                    .map(role => {
                                        const isSelected = (newRecurringEligibleRoles || []).includes(role.id);
                                        return (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => {
                                                    const cur = newRecurringEligibleRoles || [];
                                                    setNewRecurringEligibleRoles(isSelected ? cur.filter(x => x !== role.id) : [...cur, role.id]);
                                                }}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                                    isSelected
                                                        ? 'bg-accent/20 border-accent text-accent-dark'
                                                        : 'bg-page border-border/50 text-muted hover:border-accent/50'
                                                }`}
                                            >
                                                {toTitleCase(role.displayName || role.id)}
                                            </button>
                                        );
                                    })
                                }
                                {allRoles.length === 0 && <p className="text-xs text-muted italic">No roles found. Roles load after opening the page.</p>}
                            </div>
                            {(newRecurringEligibleRoles || []).length > 0 && (
                                <p className="text-xs text-amber-500 mt-1.5">
                                    ⚠ Restricted to {(newRecurringEligibleRoles || []).length} selected role(s). Other roles will get W/O or A on this day.
                                </p>
                            )}
                        </div>

                        <Button
                            type="button"
                            onClick={async () => {
                                try {
                                    await addRecurringHoliday({
                                        day: newRecurringDay as any,
                                        n: newRecurringN,
                                        type: activeTab as 'office' | 'field' | 'site' | 'admin' | 'management',
                                        eligibleRoles: (newRecurringEligibleRoles || []).length > 0 ? newRecurringEligibleRoles! : []
                                    });
                                    setNewRecurringEligibleRoles([]);
                                    setToast({ message: 'Recurring holiday added successfully.', type: 'success' });
                                } catch (error) {
                                    setToast({ message: 'Failed to add recurring holiday.', type: 'error' });
                                }
                            }}
                            className="w-full sm:w-auto py-2 px-6"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Rule
                        </Button>
                    </div>
                    <div className="mt-4 space-y-2">
                        {recurringHolidays
                            .filter(rule => (rule.type || 'office') === activeTab)
                            .map((rule, index) => (
                                <div key={rule.id || index} className="flex justify-between items-start p-4 pr-6 border border-white/10 rounded-lg bg-white/5 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-primary-text truncate">{rule.n === 1 ? '1st' : rule.n === 2 ? '2nd' : rule.n === 3 ? '3rd' : rule.n + 'th'} {rule.day}</p>
                                        <p className="text-sm text-muted mb-1.5">Repeats every month</p>
                                        {/* Eligible role pills */}
                                        {(rule.eligibleRoles && rule.eligibleRoles.length > 0) ? (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                <span className="text-[10px] font-bold text-amber-500 self-center">Only:</span>
                                                {rule.eligibleRoles.map(roleId => {
                                                    const roleMeta = allRoles.find(r => r.id === roleId);
                                                    return (
                                                        <span key={roleId} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent-dark border border-accent/20">
                                                            {toTitleCase(roleMeta?.displayName || roleId)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                                                All roles eligible
                                            </span>
                                        )}
                                    </div>
                                    <div className="ml-4 shrink-0">
                                        <Button variant="icon" onClick={async () => {
                                            if (rule.id) {
                                                try {
                                                    await removeRecurringHoliday(rule.id);
                                                    setToast({ message: 'Recurring holiday removed successfully.', type: 'success' });
                                                } catch (error) {
                                                    setToast({ message: 'Failed to remove recurring holiday.', type: 'error' });
                                                }
                                            }
                                        }} className="p-2 hover:bg-red-500/10 rounded-full transition-colors">
                                            <Trash2 className="h-5 w-5 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        {recurringHolidays.filter(rule => (rule.type || 'office') === (activeTab as any)).length === 0 && (
                            <p className="text-center text-muted py-4">No recurring holidays configured.</p>
                        )}
                    </div>
                </section>

                <section className="pt-6 border-t border-border" style={{ display: subTab === 'holidays' ? undefined : 'none' }}>
                    
                    {activeTab === 'site' ? (
                        <SiteHolidayAllocator initialSiteId={selectedEntityId} filteredSites={availableEntities} />
                    ) : (
                        <>
                            <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Calendar className="mr-2 h-5 w-5 text-muted" />Holiday List</h3>
                            
                            <div className="mb-6 space-y-4">
                        <Checkbox
                            id="enableCustomHolidays"
                            label="Enable Custom Holiday Selection"
                            description="Allow employees to select 5 holidays from the company selection list. Admin or HR will feed the remaining 5."
                            checked={currentRules.enableCustomHolidays || false}
                            onChange={(e) => handleSettingChange('enableCustomHolidays', e.target.checked)}
                        />
                    </div>

                    <div className="p-4 bg-page rounded-lg">
                        <h4 className="font-semibold mb-2">Add Admin Allocated Holiday</h4>
                        {currentRules.enableCustomHolidays ? (
                            <div className="mb-3 text-sm text-muted">
                                <span className="font-medium">Admin Holidays: {currentHolidays.length} / {currentRules.adminAllocatedHolidays || 5}</span>
                                {currentHolidays.length >= (currentRules.adminAllocatedHolidays || 5) && (
                                    <span className="ml-2 text-red-500">Maximum admin limit reached</span>
                                )}
                            </div>
                        ) : (
                            <div className="mb-3 text-sm text-muted">
                                <span className="font-medium">Holidays: {currentHolidays.length} / {currentRules.maxHolidaysPerCategory || 10}</span>
                                {currentHolidays.length >= (currentRules.maxHolidaysPerCategory || 10) && (
                                    <span className="ml-2 text-red-500">Maximum limit reached</span>
                                )}
                            </div>
                        )}
                        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                            <Input label="Holiday Name" id="holidayName" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                            <DatePicker label="Date" id="holidayDate" value={newHolidayDate} onChange={setNewHolidayDate} />
                            <Button 
                                type="submit" 
                                className="w-full sm:w-auto py-2 px-6"
                                disabled={currentHolidays.length >= (currentRules.enableCustomHolidays ? (currentRules.adminAllocatedHolidays || 5) : (currentRules.maxHolidaysPerCategory || 10))}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </form>
                    </div>

                    <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 my-6 animate-fade-in shadow-sm">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h5 className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                <Plus className="h-3 w-3" /> Quick Select from Master Pool
                            </h5>
                            <span className="text-[10px] bg-accent/20 text-accent-dark px-2 py-0.5 rounded-full font-bold">
                                {currentHolidays.length} / {currentRules.maxHolidaysPerCategory || 10}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                            {(currentRules.holidayPool || HOLIDAY_SELECTION_POOL).map((ph) => {
                                const poolDate = `${currentYear}${ph.date}`;
                                const isSelected = currentHolidays.some(h => h.date === poolDate || (h.id.startsWith('fixed-') && h.name === ph.name));
                                const limit = currentRules.maxHolidaysPerCategory || 10;

                                return (
                                    <button
                                        key={ph.name + ph.date}
                                        type="button"
                                        disabled={!isSelected && currentHolidays.length >= limit}
                                        onClick={async () => {
                                            if (isSelected) {
                                                const holiday = currentHolidays.find(h => h.date === poolDate && !h.id.startsWith('fixed-'));
                                                if (holiday) handleRemoveHoliday(holiday.id);
                                            } else if (currentHolidays.length < limit) {
                                                try {
                                                    await addHoliday(activeTab as 'office' | 'field' | 'site', { name: ph.name, date: poolDate });
                                                    setToast({ message: `${ph.name} added to allocated list.`, type: 'success' });
                                                } catch (e) {
                                                    setToast({ message: 'Failed to add holiday.', type: 'error' });
                                                }
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all text-left group ${
                                            isSelected 
                                            ? 'bg-accent/20 text-accent-dark border-accent/50' 
                                            : 'bg-white hover:border-accent/50 text-primary-text border-border/50 disabled:opacity-50'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-accent bg-accent text-white shadow-sm shadow-accent/50 scale-110' : 'border-border group-hover:border-accent/30'}`}>
                                            {isSelected && <Plus className="h-3 w-3 rotate-45" />}
                                        </div>
                                        <div className="flex-grow truncate">
                                            <div className="font-semibold">{ph.name}</div>
                                            <div className={isSelected ? 'text-accent-dark/70' : 'text-muted'}>{ph.date}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {currentRules.enableCustomHolidays && (
                        <div className="mt-8 pt-6 border-t border-border/50">
                            <h4 className="font-semibold mb-2 flex items-center text-primary-text">
                                <Settings className="mr-2 h-4 w-4 text-muted" /> 
                                Holiday Selection Pool
                            </h4>
                            <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                <h4 className="text-sm font-semibold text-emerald-600 mb-4 flex items-center">
                                    <Plus className="mr-2 h-4 w-4" /> {editingPoolIndex !== null ? 'Edit Pool Holiday' : 'Add to Selection Pool'}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                                    <Input 
                                        label="Holiday Name" 
                                        value={newPoolHolidayName} 
                                        onChange={e => setNewPoolHolidayName(e.target.value)} 
                                        placeholder="e.g. Christmas"
                                    />
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted ml-1">Date (Year Ignored)</label>
                                        <DatePicker 
                                            id="pool-holiday-date"
                                            label=""
                                            value={newPoolHolidayDate} 
                                            onChange={setNewPoolHolidayDate} 
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            onClick={editingPoolIndex !== null ? handleSavePoolEdit : handleAddPoolHoliday}
                                            className="w-full sm:w-auto py-2 px-6"
                                        >
                                            {editingPoolIndex !== null ? 'Update' : 'Add to Pool'}
                                        </Button>
                                        {editingPoolIndex !== null && (
                                            <Button 
                                                variant="secondary" 
                                                onClick={() => {
                                                    setEditingPoolIndex(null);
                                                    setNewPoolHolidayName('');
                                                    setNewPoolHolidayDate('');
                                                }}
                                                className="py-2 px-6"
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
                                {(currentRules.holidayPool || HOLIDAY_SELECTION_POOL).map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg group">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{h.name}</p>
                                            <p className="text-xs text-muted">{new Date(`${currentYear}${h.date}`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleEditPoolHoliday(i)}
                                                className="p-1.5 hover:bg-white/10 rounded-md text-muted hover:text-primary transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleRemovePoolHoliday(i)}
                                                className="p-1.5 hover:bg-red-500/10 rounded-md text-red-400 hover:text-red-500 transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-8">
                        <h4 className="font-semibold mb-4 text-primary-text">Allocated Holidays</h4>
                        <div className="space-y-2">
                            {currentHolidays.length > 0 ? (
                                currentHolidays.map(holiday => (
                                    <div key={holiday.id} className="flex justify-between items-start p-4 pr-6 border border-white/10 rounded-lg bg-white/5 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-primary-text truncate">{holiday.name}</p>
                                            <p className="text-sm text-muted">{new Date(holiday.date.replace(/-/g, '/')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                        <div className="ml-4 shrink-0">
                                            {FIXED_HOLIDAYS.some(fh => fh.name === holiday.name) ? (
                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded uppercase font-semibold">Common</span>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => handleRemoveHoliday(holiday.id)} className="p-2 border-red-500/20 hover:bg-red-500/10 rounded-full transition-colors">
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-muted py-4">No allocated holidays yet for {activeTab} staff.</p>
                            )}
                        </div>
                    </div>
                        </>
                    )}
                </section>
            </>
            )}

                {/* Staff Selections Tab */}
                {(activeTab as string) === 'selections' && (
                <section className="space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Settings className="mr-2 h-5 w-5 text-muted" />Missed Check-out Configuration</h3>
                        
                        <div className="mb-8">
                            <h4 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">1. Select Active Categories</h4>
                            <p className="text-sm text-muted mb-4">Choose which staff categories should be included in the "Trigger Missed Check-outs" action.</p>
                            <div className="flex flex-wrap gap-6 p-4 bg-page rounded-lg border border-border/50">
                                <Checkbox
                                    id="cat-office"
                                    label="Office Staff"
                                    checked={localAttendance.missedCheckoutConfig?.enabledGroups?.includes('office') ?? true}
                                    onChange={(e) => {
                                        const current = localAttendance.missedCheckoutConfig?.enabledGroups || ['office'];
                                        const updated = e.target.checked 
                                            ? [...new Set([...current, 'office' as const])]
                                            : current.filter(g => g !== 'office');
                                        setLocalAttendance(prev => ({ 
                                            ...prev, 
                                            missedCheckoutConfig: { 
                                                ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                enabledGroups: updated 
                                            } 
                                        }));
                                    }}
                                />
                                <Checkbox
                                    id="cat-field"
                                    label="Field Staff"
                                    checked={localAttendance.missedCheckoutConfig?.enabledGroups?.includes('field') ?? false}
                                    onChange={(e) => {
                                        const current = localAttendance.missedCheckoutConfig?.enabledGroups || ['office'];
                                        const updated = e.target.checked 
                                            ? [...new Set([...current, 'field' as const])]
                                            : current.filter(g => g !== 'field');
                                        setLocalAttendance(prev => ({ 
                                            ...prev, 
                                            missedCheckoutConfig: { 
                                                ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                enabledGroups: updated 
                                            } 
                                        }));
                                    }}
                                />
                                <Checkbox
                                    id="cat-site"
                                    label="Site Staff"
                                    checked={localAttendance.missedCheckoutConfig?.enabledGroups?.includes('site') ?? false}
                                    onChange={(e) => {
                                        const current = localAttendance.missedCheckoutConfig?.enabledGroups || ['office'];
                                        const updated = e.target.checked 
                                            ? [...new Set([...current, 'site' as const])]
                                            : current.filter(g => g !== 'site');
                                        setLocalAttendance(prev => ({ 
                                            ...prev, 
                                            missedCheckoutConfig: { 
                                                ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                enabledGroups: updated 
                                            } 
                                        }));
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">2. Manage Category Roles</h4>
                            <p className="text-sm text-muted mb-4">Assign individual roles to each category. Based on these selections, employees will be processed as Office, Field, or Site staff.</p>
                            
                            {isLoadingRoles ? (
                                <div className="p-8 text-center text-muted bg-page rounded-lg border border-border/50">
                                    <Clock className="animate-spin h-5 w-5 mx-auto mb-2 opacity-50" />
                                    Loading available roles...
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {(['office', 'field', 'site'] as const).map(group => {
                                        const rawGroupRoles = localAttendance.missedCheckoutConfig?.roleMapping?.[group] || 
                                            (group === 'office' ? ['admin', 'hr', 'finance', 'developer'] : 
                                             group === 'field' ? ['field_staff', 'field_officer', 'technical_reliever'] : 
                                             ['site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter', 
                                              'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer']);
                                        // Deduplicate by displayName — keep first occurrence, remove old/duplicate role IDs with same name
                                        const seenNames = new Set<string>();
                                        const groupRoles = rawGroupRoles.filter(roleId => {
                                            const name = (allRoles.find(r => r.id === roleId)?.displayName || roleId).toLowerCase();
                                            if (seenNames.has(name)) return false;
                                            seenNames.add(name);
                                            return true;
                                        });
                                        
                                        return (
                                            <div key={group} className="bg-page rounded-lg border border-border/50 flex flex-col h-full">
                                                <div className="p-3 border-b border-border/30 bg-white/5 flex justify-between items-center">
                                                    <span className="text-sm font-semibold uppercase tracking-tight">{group} Staff Roles</span>
                                                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">{groupRoles.length}</span>
                                                </div>
                                                <div className="p-3 flex-1 space-y-2 max-h-[300px] overflow-y-auto text-primary-text">
                                                    {groupRoles.map(roleId => {
                                                        const role = allRoles.find(r => r.id === roleId);
                                                        return (
                                                            <div key={roleId} className="flex items-center justify-between p-2 bg-white/5 rounded border border-border/10 group">
                                                                <span className="text-xs truncate" title={roleId}>{toTitleCase(role?.displayName || roleId)}</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        const mapping = localAttendance.missedCheckoutConfig?.roleMapping || { office: ['admin', 'hr', 'finance', 'developer'], field: ['field_staff', 'field_officer', 'technical_reliever'], site: ['site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter', 'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer'] };
                                                                        const updatedGroup = groupRoles.filter(r => r !== roleId);
                                                                        setLocalAttendance(prev => ({
                                                                            ...prev,
                                                                            missedCheckoutConfig: {
                                                                                ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                                                roleMapping: { ...mapping, [group]: updatedGroup }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {groupRoles.length === 0 && (
                                                        <p className="text-[11px] text-muted text-center py-4 italic">No roles assigned</p>
                                                    )}
                                                </div>
                                                <div className="p-3 border-t border-border/30 bg-white/5">
                                                    <select 
                                                        className="w-full bg-transparent border border-border/50 rounded p-1 text-xs text-primary-text outline-none focus:border-primary/50"
                                                        value=""
                                                        onChange={(e) => {
                                                            if (!e.target.value) return;
                                                            const roleId = e.target.value;
                                                            const mapping = localAttendance.missedCheckoutConfig?.roleMapping || { office: ['admin', 'hr', 'finance', 'developer'], field: ['field_staff', 'field_officer', 'technical_reliever'], site: ['site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter', 'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer'] };
                                                            const updatedGroup = [...new Set([...groupRoles, roleId])];
                                                            setLocalAttendance(prev => ({
                                                                ...prev,
                                                                missedCheckoutConfig: {
                                                                    ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                                    roleMapping: { ...mapping, [group]: updatedGroup }
                                                                }
                                                            }));
                                                        }}
                                                    >
                                                        <option value="" disabled className="bg-page">Assign Role...</option>
                                                        {allRoles
                                                            .filter(r => {
                                                                if (groupRoles.includes(r.id)) return false;
                                                                // Also hide roles whose displayName already exists in this group
                                                                const existingNames = new Set(groupRoles.map(rid => (allRoles.find(ar => ar.id === rid)?.displayName || rid).toLowerCase()));
                                                                return !existingNames.has((r.displayName || r.id).toLowerCase());
                                                            })
                                                            .map(role => (
                                                                <option key={role.id} value={role.id} className="bg-page">{toTitleCase(role.displayName || role.id)}</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <h4 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">3. Set Auto Check-out Times</h4>
                            <p className="text-sm text-muted mb-4">Set the specific time each staff category should be automatically checked out if they miss their check-out.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {(['office', 'field', 'site'] as const).map(group => {
                                    if (!localAttendance.missedCheckoutConfig?.enabledGroups?.includes(group)) return null;
                                    const triggerTimes = localAttendance.missedCheckoutConfig?.triggerTimes || {};
                                    const value = triggerTimes[group] || localAttendance[group]?.fixedOfficeHours?.checkOutTime || '19:30';
                                    return (
                                        <div key={group} className="bg-page rounded-lg border border-border/50 p-4">
                                            <Input
                                                id={`checkout-time-${group}`}
                                                label={`${group.charAt(0).toUpperCase() + group.slice(1)} Auto Check-out Time`}
                                                type="time"
                                                value={value}
                                                onChange={(e) => {
                                                    setLocalAttendance(prev => ({
                                                        ...prev,
                                                        missedCheckoutConfig: {
                                                            ...(prev.missedCheckoutConfig || { enabledGroups: ['office'] }),
                                                            triggerTimes: {
                                                                ...(prev.missedCheckoutConfig?.triggerTimes || {}),
                                                                [group]: e.target.value
                                                            }
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                        <div className="pt-6 border-t border-border/50">
                            <h4 className="text-sm font-semibold text-primary-text mb-2">Automated Actions</h4>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-emerald-500 font-medium flex items-center">
                                    <Clock className="h-3 w-3 mr-1.5" />
                                    Auto-Checkout Active
                                </p>
                                <p className="text-xs text-muted mt-1">
                                    The system automatically checks out eligible staff at their configured <strong>Auto Check-out Time</strong>.
                                    This check runs every 15 minutes. You can also use the button below to manually run the trigger immediately for testing or overrides.
                                </p>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={handleTriggerMissedCheckouts} 
                                isLoading={isTriggering}
                                className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                                disabled={!localAttendance.missedCheckoutConfig?.enabledGroups?.length}
                            >
                                <Clock className="mr-2 h-4 w-4" /> Run Manual Trigger Now
                            </Button>
                        </div>
                    </section>
                    )}

                {/* Travel & Fuel Rules Section */}
                <section className="pt-6 border-t border-border" style={{ display: subTab === 'travel' ? undefined : 'none' }}>
                    <TravelRulesConfigPanel 
                        scopeType={selectedEntityId ? 'entity' : (selectedCompanyId ? 'company' : (selectedLocation !== 'global' ? 'location' : 'global'))}
                        scopeId={selectedEntityId || selectedCompanyId || (selectedLocation !== 'global' ? selectedLocation : null)}
                        changedBy={currentUser?.name || 'Admin'}
                    />
                </section>
            </div>
        </div>
    );
};

export default AttendanceSettings;