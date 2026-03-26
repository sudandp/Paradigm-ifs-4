



import React, { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Trash2, Plus, Settings, Calendar, Clock, LifeBuoy, Bell, Save, Monitor, Edit } from 'lucide-react';
import DatePicker from '../../components/ui/DatePicker';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import Select from '../../components/ui/Select';
import type { StaffAttendanceRules, AttendanceSettings, RecurringHolidayRule, Role } from '../../types';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { api } from '../../services/api';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import LoadingScreen from '../../components/ui/LoadingScreen';


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
    const [newHolidayName, setNewHolidayName] = useState('');
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newRecurringN, setNewRecurringN] = useState(3);
    const [newRecurringDay, setNewRecurringDay] = useState('Saturday');
    const [isTriggering, setIsTriggering] = useState(false);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [newPoolHolidayName, setNewPoolHolidayName] = useState('');
    const [newPoolHolidayDate, setNewPoolHolidayDate] = useState('');
    const [editingPoolIndex, setEditingPoolIndex] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingRoles(true);
            try {
                const [roles, structure] = await Promise.all([
                    api.getAppRoles(),
                    api.getOrganizationStructure()
                ]);
                setAllRoles(roles);
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
        const entities: { id: string, name: string }[] = [];
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                if (company.id === selectedCompanyId) {
                    company.entities.forEach(entity => {
                        entities.push({ id: entity.id, name: entity.name });
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

    const currentRules = activeTab === 'selections' ? localAttendance.office : localAttendance[activeTab as 'office' | 'field' | 'site' | 'admin' | 'management'];
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
        if (!window.confirm('This will record a manual check-out at 7:00 PM for all configured staff who haven\'t checked out today. Continue?')) {
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
        setIsSaving(true);
        try {
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
                await api.updateAttendanceSettings(localAttendance);
                updateStore(localAttendance);
            } else {
                await api.saveScopedAttendanceSettings(scope as any, scopeId, localAttendance);
            }
            setIsDirty(false);
            setToast({ message: 'Settings saved successfully!', type: 'success' });
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
        <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full pb-40">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AdminPageHeader title="Attendance & Leave Rules">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-48">
                         <Select
                            id="location-filter"
                            value={selectedLocation}
                            onChange={(e) => handleLocationChange(e.target.value)}
                        >
                            <option value="global">Global Rules</option>
                            {locations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="w-48 animate-in slide-in-from-right-2 duration-300">
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

                    <div className="w-48 animate-in slide-in-from-right-2 duration-300">
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

                    <Button onClick={handleSave} isLoading={isSaving} disabled={!isDirty} size="md" className="py-2 px-6">
                        <Save className="mr-2 h-4 w-4" /> Save Rules
                    </Button>
                </div>
            </AdminPageHeader>
            <p className="text-muted -mt-4 mb-6">Set company-wide rules for attendance and leave calculation.</p>


            <div className="mb-6 border-b border-border">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && (
                        <>
                            <button onClick={() => setActiveTab('office')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'office' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                                Office Staff
                            </button>
                            <button onClick={() => setActiveTab('field')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'field' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                                Field Staff
                            </button>
                        </>
                    )}
                    {(!selectedEntityId || (selectedEntityId && selectedEntityId !== `${selectedCompanyId}_head_office`)) && (
                        <button onClick={() => setActiveTab('site')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'site' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                            Site Staff
                        </button>
                    )}
                    <button onClick={() => setActiveTab('admin')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'admin' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                        Admin
                    </button>
                    <button onClick={() => setActiveTab('management')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'management' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                        Management
                    </button>
                    <button onClick={() => setActiveTab('selections')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'selections' ? 'border-accent text-accent-dark' : 'border-transparent text-muted hover:text-accent-dark hover:border-accent'}`}>
                        Staff Selections
                    </button>
                </nav>
            </div>

            {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && activeTab === 'office' && <p className="text-sm text-muted -mt-4 mb-4">These rules apply to Receptionist, Accountant, and general Office Staff.</p>}
            {(!selectedEntityId || selectedEntityId === `${selectedCompanyId}_head_office`) && activeTab === 'field' && <p className="text-sm text-muted -mt-4 mb-4">These rules apply to Field Staff and Field Managers.</p>}
            {(!selectedEntityId || (selectedEntityId && selectedEntityId !== `${selectedCompanyId}_head_office`)) && activeTab === 'site' && <p className="text-sm text-muted -mt-4 mb-4">These rules apply to Site Staff (e.g. Site Managers, Security Guards).</p>}
            {activeTab === 'admin' && <p className="text-sm text-muted -mt-4 mb-4">These rules apply to System Administrators and HR Admins.</p>}
            {activeTab === 'management' && <p className="text-sm text-muted -mt-4 mb-4">These rules apply to Top Management, CEO, GM, etc.</p>}
            {activeTab === 'selections' && <p className="text-sm text-muted -mt-4 mb-4">Select staff groups to include in automated actions like missed check-out triggers.</p>}


            <div className="space-y-6">
                {activeTab !== 'selections' && (
                <>
                <section>
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-muted" />Work Hours</h3>
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
                        <Checkbox
                            id="enableViolationBlocking"
                            label="Enable Violation Blocking"
                            description="Restrict app access and hold salary automatically when a user reaches the strike limit (default 3)."
                            checked={currentRules.enableViolationBlocking ?? true}
                            onChange={(e) => handleSettingChange('enableViolationBlocking', e.target.checked)}
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

                {/* Device Limits Section */}
                <section className="pt-6 border-t border-border">
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
                                value={currentRules.fixedOfficeHours?.checkOutTime || '18:00'}
                                onChange={(e) => handleSettingChange('fixedOfficeHours', { ...currentRules.fixedOfficeHours, checkOutTime: e.target.value })}
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


                    <section className="pt-6 border-t border-border">
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


                <section className="pt-6 border-t border-border">
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
                            <div className="mt-4">
                                <DatePicker
                                    label="Valid Till"
                                    id="earnedLeavesExpiryDate"
                                    value={currentRules.earnedLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('earnedLeavesExpiryDate', date)}
                                />
                                {!currentRules.earnedLeavesExpiryDate ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity</p>
                                ) : new Date(currentRules.earnedLeavesExpiryDate) < new Date(new Date().toISOString().split('T')[0]) ? (
                                    <p className="text-xs text-amber-500 mt-1">⚠ Expired - Not Applicable</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
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
                            <div className="mt-4">
                                <DatePicker
                                    label="Valid Till"
                                    id="sickLeavesExpiryDate"
                                    value={currentRules.sickLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('sickLeavesExpiryDate', date)}
                                />
                                {!currentRules.sickLeavesExpiryDate ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity</p>
                                ) : new Date(currentRules.sickLeavesExpiryDate) < new Date(new Date().toISOString().split('T')[0]) ? (
                                    <p className="text-xs text-amber-500 mt-1">⚠ Expired - Not Applicable</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
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
                            <div className="mt-4">
                                <DatePicker
                                    label="Valid Till"
                                    id="floatingLeavesExpiryDate"
                                    value={currentRules.floatingLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('floatingLeavesExpiryDate', date)}
                                />
                                {!currentRules.floatingLeavesExpiryDate ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity</p>
                                ) : new Date(currentRules.floatingLeavesExpiryDate) < new Date(new Date().toISOString().split('T')[0]) ? (
                                    <p className="text-xs text-amber-500 mt-1">⚠ Expired - Not Applicable</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
                                )}
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
                            <div className="mt-4">
                                <DatePicker
                                    label="Valid Till"
                                    id="compOffLeavesExpiryDate"
                                    value={currentRules.compOffLeavesExpiryDate || ''}
                                    onChange={(date) => handleSettingChange('compOffLeavesExpiryDate', date)}
                                />
                                {!currentRules.compOffLeavesExpiryDate ? (
                                    <p className="text-xs text-gray-400 mt-1">No Validity</p>
                                ) : new Date(currentRules.compOffLeavesExpiryDate) < new Date(new Date().toISOString().split('T')[0]) ? (
                                    <p className="text-xs text-amber-500 mt-1">⚠ Expired - Not Applicable</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 mt-1">✓ Valid</p>
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

                <section className="pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Bell className="mr-2 h-5 w-5 text-muted" />Notifications</h3>
                    <Checkbox
                        id="attendance-notifications"
                        label="Enable Check-in/Check-out Notifications"
                        description="Send a notification to Site Managers, Ops Managers, and HR when a Field Staff checks in or out."
                        checked={currentRules.enableAttendanceNotifications}
                        onChange={(e) => handleSettingChange('enableAttendanceNotifications', e.target.checked)}
                    />
                </section>

                <section className="pt-6 border-t border-border">
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
                            onChange={(e) => handleSettingChange('geofencingEnabled', e.target.checked)}
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

                <section className="pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center"><Calendar className="mr-2 h-5 w-5 text-muted" />Recurring Holidays</h3>
                    <div className="p-4 bg-page rounded-lg">
                        <h4 className="font-semibold mb-2">Add Recurring Holiday</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
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
                            <Button 
                                type="button" 
                                onClick={async () => {
                                    try {
                                        await addRecurringHoliday({
                                            day: newRecurringDay as any,
                                            n: newRecurringN,
                                            type: activeTab as 'office' | 'field' | 'site' | 'admin' | 'management'
                                        });
                                        setToast({ message: 'Recurring holiday added successfully.', type: 'success' });
                                    } catch (error) {
                                        setToast({ message: 'Failed to add recurring holiday.', type: 'error' });
                                    }
                                }} 
                                className="w-full sm:w-auto h-[46px] px-6 text-sm"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Rule
                            </Button>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {recurringHolidays
                            .filter(rule => (rule.type || 'office') === activeTab)
                            .map((rule, index) => (
                                <div key={rule.id || index} className="flex justify-between items-start p-4 pr-6 border border-white/10 rounded-lg bg-white/5 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-primary-text truncate">{rule.n === 1 ? '1st' : rule.n === 2 ? '2nd' : rule.n === 3 ? '3rd' : rule.n + 'th'} {rule.day}</p>
                                        <p className="text-sm text-muted">Repeats every month</p>
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

                <section className="pt-6 border-t border-border">
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
                        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <Input label="Holiday Name" id="holidayName" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                            <DatePicker label="Date" id="holidayDate" value={newHolidayDate} onChange={setNewHolidayDate} />
                            <Button 
                                type="submit" 
                                className="w-full sm:w-auto h-[46px] px-8 text-sm"
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
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
                                            className="flex-1 h-[46px] text-sm"
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
                                                className="h-[46px] px-4"
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
                                        const groupRoles = localAttendance.missedCheckoutConfig?.roleMapping?.[group] || 
                                            (group === 'office' ? ['admin', 'hr', 'finance', 'developer'] : 
                                             group === 'field' ? ['field_staff', 'field_officer'] : 
                                             ['site_manager', 'security_guard', 'supervisor']);
                                        
                                        return (
                                            <div key={group} className="bg-page rounded-lg border border-border/50 flex flex-col h-full">
                                                <div className="p-3 border-b border-border/30 bg-white/5 flex justify-between items-center">
                                                    <span className="text-sm font-semibold uppercase tracking-tight">{group} Staff Roles</span>
                                                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">{groupRoles.length}</span>
                                                </div>
                                                <div className="p-3 flex-1 space-y-2 max-h-[300px] overflow-y-auto">
                                                    {groupRoles.map(roleId => {
                                                        const role = allRoles.find(r => r.id === roleId);
                                                        return (
                                                            <div key={roleId} className="flex items-center justify-between p-2 bg-white/5 rounded border border-border/10 group">
                                                                <span className="text-xs truncate" title={roleId}>{role?.displayName || roleId}</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        const mapping = localAttendance.missedCheckoutConfig?.roleMapping || { office: ['admin', 'hr', 'finance', 'developer'], field: ['field_staff', 'field_officer'], site: ['site_manager', 'security_guard', 'supervisor'] };
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
                                                            const mapping = localAttendance.missedCheckoutConfig?.roleMapping || { office: ['admin', 'hr', 'finance', 'developer'], field: ['field_staff', 'field_officer'], site: ['site_manager', 'security_guard', 'supervisor'] };
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
                                                            .filter(r => !groupRoles.includes(r.id))
                                                            .map(role => (
                                                                <option key={role.id} value={role.id} className="bg-page">{role.displayName || role.id}</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                    The system automatically checks out eligible staff at your configured <strong>Check-out End Time</strong> (currently {localAttendance.office.fixedOfficeHours?.checkOutTime || '19:00'}).
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
            </div>
        </div>
    );
};

export default AttendanceSettings;