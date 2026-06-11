import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import { api } from '../../services/api';
import type { OrganizationGroup, Organization, SiteStaffDesignation } from '../../types';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Loader2, Building, ArrowRight, ArrowLeft, MapPin, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';

const SelectOrganization = () => {
    const navigate = useNavigate();
    const { updateOrganization, updatePersonal } = useOnboardingStore();
    const { enforceManpowerLimit, manpowerLimitRule } = useEnrollmentRulesStore();
    const { user } = useAuthStore();

    const [isLoading, setIsLoading] = useState(true);
    const [groups, setGroups] = useState<OrganizationGroup[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [siteStaffDesignations, setSiteStaffDesignations] = useState<SiteStaffDesignation[]>([]);

    // Cascade state
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedEntityId, setSelectedEntityId] = useState('');
    const [isManualSite, setIsManualSite] = useState(false);
    const [manualSiteName, setManualSiteName] = useState('');
    const [selectedDesignation, setSelectedDesignation] = useState('');
    const [isManualDesignation, setIsManualDesignation] = useState(false);
    const [manualDesignationName, setManualDesignationName] = useState('');
    const [designationsForSite, setDesignationsForSite] = useState<SiteStaffDesignation[]>([]);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [manpowerStatus, setManpowerStatus] = useState({ isOverLimit: false, message: '' });

    const isMobileView = user?.role === 'field_staff' && isMobile;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [structure, orgs, designations] = await Promise.all([
                    api.getOrganizationStructure(),
                    api.getOrganizations(),
                    api.getSiteStaffDesignations(),
                ]);
                setGroups(structure);
                setOrganizations(orgs);
                setSiteStaffDesignations(designations);
            } catch (error) {
                console.error('Failed to fetch organization structure', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ── Cascade derivations ────────────────────────────────────────────────

    // Deduplicate groups by normalized name
    const uniqueGroups = useMemo(() => {
        const seen = new Set<string>();
        return groups.filter(g => {
            const key = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [groups]);

    const selectedGroup = useMemo(
        () => groups.find(g => g.id === selectedGroupId),
        [groups, selectedGroupId]
    );

    // All companies in the selected group
    const allGroupCompanies = useMemo(() => selectedGroup?.companies || [], [selectedGroup]);

    // Unique locations extracted from company.location field — this is the source of truth
    const availableLocations = useMemo(() => {
        const locs = allGroupCompanies
            .map(c => (c.location || '').trim())
            .filter(Boolean);
        return [...new Set(locs)].sort();
    }, [allGroupCompanies]);

    // Companies filtered by selected location
    const locationFilteredCompanies = useMemo(() => {
        if (!selectedLocation) return [];
        return allGroupCompanies.filter(
            c => (c.location || '').trim().toLowerCase() === selectedLocation.trim().toLowerCase()
        );
    }, [allGroupCompanies, selectedLocation]);

    const selectedCompany = useMemo(
        () => locationFilteredCompanies.find(c => c.id === selectedCompanyId),
        [locationFilteredCompanies, selectedCompanyId]
    );

    // Sites / entities for the selected company
    const entities = useMemo(() => selectedCompany?.entities || [], [selectedCompany]);

    // Designations unlock once a site (or manual site) is chosen
    useEffect(() => {
        setSelectedDesignation('');
        const hasSite = !!entities.find(e => e.id === selectedEntityId) || isManualSite;
        setDesignationsForSite(hasSite ? siteStaffDesignations : []);
    }, [selectedEntityId, entities, siteStaffDesignations, isManualSite]);

    // Manpower limit check
    useEffect(() => {
        const checkManpower = async () => {
            setManpowerStatus({ isOverLimit: false, message: '' });
            if (!selectedEntityId || !enforceManpowerLimit || isManualSite) return;

            const selectedEntity = entities.find(e => e.id === selectedEntityId);
            const orgId = selectedEntity?.organizationId;
            if (!orgId) return;

            const organization = organizations.find(o => o.id === orgId);
            const approvedCount = organization?.manpowerApprovedCount;

            if (approvedCount === undefined || approvedCount === null) {
                setManpowerStatus({ isOverLimit: false, message: 'Manpower limit not set for this site.' });
                return;
            }
            try {
                const submissions = await api.getVerificationSubmissions();
                const currentCount = submissions.filter(
                    s => s.organizationId === orgId && (s.status === 'verified' || s.status === 'pending')
                ).length;
                if (currentCount >= approvedCount) {
                    setManpowerStatus({ isOverLimit: true, message: `Manpower limit of ${approvedCount} reached (${currentCount} deployed).` });
                } else {
                    setManpowerStatus({ isOverLimit: false, message: `Manpower: ${currentCount} / ${approvedCount} deployed.` });
                }
            } catch {
                setManpowerStatus({ isOverLimit: false, message: 'Could not verify manpower count.' });
            }
        };
        checkManpower();
    }, [selectedEntityId, organizations, entities, enforceManpowerLimit, isManualSite]);

    // ── Handlers ──────────────────────────────────────────────────────────

    const resetFromGroup = () => { setSelectedLocation(''); setSelectedCompanyId(''); setSelectedEntityId(''); setIsManualSite(false); setManualSiteName(''); setSelectedDesignation(''); };
    const resetFromLocation = () => { setSelectedCompanyId(''); setSelectedEntityId(''); setIsManualSite(false); setManualSiteName(''); setSelectedDesignation(''); };
    const resetFromCompany = () => { setSelectedEntityId(''); setIsManualSite(false); setManualSiteName(''); setSelectedDesignation(''); };

    const handleContinue = () => {
        // Resolve designation details — may be undefined for manual entries
        const designationDetails = siteStaffDesignations.find(d => d.designation === selectedDesignation);
        const department = designationDetails?.department || '';
        const salary = designationDetails?.monthlySalary || null;

        if (isManualSite) {
            if (!manualSiteName.trim() || !selectedDesignation.trim()) return;
            updateOrganization({
                organizationId: `manual_${Date.now()}`,
                organizationName: manualSiteName.trim(),
                joiningDate: format(new Date(), 'yyyy-MM-dd'),
                workType: 'Full-time',
                designation: selectedDesignation.trim(),
                department,
                defaultSalary: salary,
                site: manualSiteName.trim(),
                groupId: selectedGroupId,
                location: selectedLocation,
                companyId: selectedCompanyId,
            });
            updatePersonal({ salary });
            navigate('/onboarding/pre-upload');
            return;
        }

        const selectedEntity = entities.find(e => e.id === selectedEntityId);
        if (!selectedEntity || !selectedDesignation.trim()) return;

        let organization = organizations.find(o => o.id === (selectedEntity.organizationId || selectedEntity.id));

        if (!organization && (selectedEntity.organizationId || selectedEntity.id)) {
            organization = {
                id: selectedEntity.organizationId || selectedEntity.id,
                shortName: selectedEntity.name,
                fullName: selectedEntity.name,
                address: selectedEntity.registeredAddress || '',
            } as Organization;
        }

        if (organization) {
            updateOrganization({
                organizationId: organization.id,
                organizationName: organization.shortName,
                joiningDate: format(new Date(), 'yyyy-MM-dd'),
                workType: 'Full-time',
                designation: selectedDesignation.trim(),
                department,
                defaultSalary: salary,
                groupId: selectedGroupId,
                location: selectedLocation,
                companyId: selectedCompanyId,
            });
            updatePersonal({ salary });
            navigate('/onboarding/pre-upload');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    const siteIsSelected = isManualSite ? !!manualSiteName.trim() : !!selectedEntityId;
    const canContinue = !siteIsSelected || !selectedDesignation ||
        (!isManualSite && manpowerStatus.isOverLimit && manpowerLimitRule === 'block');

    // ── Mobile View ───────────────────────────────────────────────────────
    if (isMobileView) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 flex items-center gap-4 fo-mobile-header text-white">
                    <button onClick={() => navigate('/onboarding')} aria-label="Go back" className="text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold">New Enrollment</h1>
                </header>

                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Building className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">Select Site</h2>
                            <p className="text-sm text-gray-400">Choose the client and site for the new employee.</p>
                        </div>

                        <div className="space-y-4">
                            {/* Company Group */}
                            <select
                                value={selectedGroupId}
                                onChange={e => { setSelectedGroupId(e.target.value); resetFromGroup(); }}
                                className="form-input"
                            >
                                <option value="">-- Select a Group --</option>
                                {uniqueGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>

                            {/* Location — from company.location values */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" /> Location
                                </label>
                                <select
                                    value={selectedLocation}
                                    onChange={e => { setSelectedLocation(e.target.value); resetFromLocation(); }}
                                    disabled={!selectedGroupId}
                                    className="form-input"
                                >
                                    <option value="">-- Select a Location --</option>
                                    {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                </select>
                            </div>

                            {/* Company — filtered by location */}
                            <select
                                value={selectedCompanyId}
                                onChange={e => { setSelectedCompanyId(e.target.value); resetFromCompany(); }}
                                disabled={!selectedLocation}
                                className="form-input"
                            >
                                <option value="">-- Select a Company --</option>
                                {locationFilteredCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            {/* Client / Site */}
                            {!isManualSite ? (
                                <div className="space-y-2">
                                    <select
                                        value={selectedEntityId}
                                        onChange={e => setSelectedEntityId(e.target.value)}
                                        disabled={!selectedCompanyId}
                                        className="form-input"
                                    >
                                        <option value="">-- Select a Client/Site --</option>
                                        {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                    {selectedCompanyId && (
                                        <button onClick={() => { setIsManualSite(true); setSelectedEntityId(''); }} className="text-xs text-accent underline flex items-center gap-1">
                                            <Plus className="h-3 w-3" /> Can't find the site? Add manually
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={manualSiteName}
                                            onChange={e => setManualSiteName(e.target.value)}
                                            placeholder="Type client/site name..."
                                            className="form-input flex-1"
                                            autoFocus
                                        />
                                        <button onClick={() => { setIsManualSite(false); setManualSiteName(''); }} className="text-gray-400 hover:text-red-400 p-2">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-amber-400">⚠ Manual entry — this site is not in the system.</p>
                                </div>
                            )}

                            {/* Designation — with manual entry fallback */}
                            {!isManualDesignation ? (
                                <div className="space-y-2">
                                    <select
                                        value={selectedDesignation}
                                        onChange={e => setSelectedDesignation(e.target.value)}
                                        disabled={!siteIsSelected}
                                        className="form-input"
                                    >
                                        <option value="">-- Select a Designation --</option>
                                        {designationsForSite.map(d => <option key={d.id} value={d.designation}>{d.designation}</option>)}
                                    </select>
                                    {siteIsSelected && (
                                        <button onClick={() => { setIsManualDesignation(true); setSelectedDesignation(''); }} className="text-xs text-accent underline flex items-center gap-1">
                                            <Plus className="h-3 w-3" /> Not listed? Add manually
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={manualDesignationName}
                                            onChange={e => { setManualDesignationName(e.target.value); setSelectedDesignation(e.target.value); }}
                                            placeholder="Type designation name..."
                                            className="form-input flex-1"
                                            autoFocus
                                        />
                                        <button onClick={() => { setIsManualDesignation(false); setManualDesignationName(''); setSelectedDesignation(''); }} className="text-gray-400 hover:text-red-400 p-2">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-amber-400">⚠ Manual entry — this designation is not in the system.</p>
                                </div>
                            )}

                            {manpowerStatus.message && (
                                <div className={`text-sm p-3 rounded-lg ${manpowerStatus.isOverLimit ? 'bg-red-900/50 text-red-300 border border-red-500/50' : 'bg-green-900/50 text-green-300 border border-green-500/50'}`}>
                                    {manpowerStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="p-4 flex-shrink-0 flex items-center justify-between gap-4">
                    <button onClick={() => navigate('/onboarding')} className="fo-btn-secondary px-6">Back</button>
                    <button onClick={handleContinue} disabled={canContinue} className="fo-btn-primary flex-1">
                        Continue
                    </button>
                </footer>
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    // ── Desktop View ──────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-0">
            <div className="bg-card p-8 rounded-xl shadow-card w-full">
                <div className="flex items-center mb-6">
                    <div className="bg-accent-light p-3 rounded-full mr-4">
                        <Building className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Select Site</h2>
                        <p className="text-muted">Choose the client and site for the new employee.</p>
                    </div>
                </div>

                <div className="space-y-6">

                    {/* ── 1. Company Group ───────────────────────────────── */}
                    <Select
                        label="Company Group"
                        id="group"
                        value={selectedGroupId}
                        onChange={e => { setSelectedGroupId(e.target.value); resetFromGroup(); }}
                    >
                        <option value="">-- Select a Group --</option>
                        {uniqueGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </Select>

                    {/* ── 2. Location (from company.location in DB) ──────── */}
                    <Select
                        label="Location"
                        id="location"
                        value={selectedLocation}
                        onChange={e => { setSelectedLocation(e.target.value); resetFromLocation(); }}
                        disabled={!selectedGroupId}
                    >
                        <option value="">-- Select a Location --</option>
                        {availableLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </Select>

                    {/* ── 3. Company (filtered by location) ─────────────── */}
                    <Select
                        label="Company"
                        id="company"
                        value={selectedCompanyId}
                        onChange={e => { setSelectedCompanyId(e.target.value); resetFromCompany(); }}
                        disabled={!selectedLocation}
                    >
                        <option value="">-- Select a Company --</option>
                        {locationFilteredCompanies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </Select>

                    {/* ── 4. Client / Site (with manual fallback) ────────── */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-primary-text">
                            Client / Site
                        </label>

                        {!isManualSite ? (
                            <>
                                <select
                                    id="entity"
                                    value={selectedEntityId}
                                    onChange={e => setSelectedEntityId(e.target.value)}
                                    disabled={!selectedCompanyId}
                                    className="form-select w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-input text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">-- Select a Client/Site --</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                                    ))}
                                </select>
                                {selectedCompanyId && (
                                    <button
                                        type="button"
                                        onClick={() => { setIsManualSite(true); setSelectedEntityId(''); }}
                                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-dark font-medium transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Site not listed? Add it manually
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                                        <input
                                            id="manual-site"
                                            type="text"
                                            value={manualSiteName}
                                            onChange={e => setManualSiteName(e.target.value)}
                                            placeholder="Type the client / site name..."
                                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-accent/60 bg-input text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setIsManualSite(false); setManualSiteName(''); setSelectedDesignation(''); }}
                                        title="Cancel manual entry"
                                        className="p-2 rounded-lg border border-border text-muted hover:border-red-400 hover:text-red-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                                    <p className="text-xs text-amber-700">
                                        <strong>Manual entry</strong> — this site is not registered in the system. It will be saved as-is and may need to be verified later.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 5. Designation (with manual entry fallback) ────── */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-primary-text">Designation</label>
                        {!isManualDesignation ? (
                            <>
                                <select
                                    id="designation"
                                    value={selectedDesignation}
                                    onChange={e => setSelectedDesignation(e.target.value)}
                                    disabled={!siteIsSelected}
                                    className="form-select w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-input text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">-- Select a Designation --</option>
                                    {designationsForSite.map(d => (
                                        <option key={d.id} value={d.designation}>{d.designation}</option>
                                    ))}
                                </select>
                                {siteIsSelected && (
                                    <button
                                        type="button"
                                        onClick={() => { setIsManualDesignation(true); setSelectedDesignation(''); }}
                                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-dark font-medium transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Not listed? Add it manually
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="manual-designation"
                                        type="text"
                                        value={manualDesignationName}
                                        onChange={e => { setManualDesignationName(e.target.value); setSelectedDesignation(e.target.value); }}
                                        placeholder="Type the designation name..."
                                        className="w-full pl-3 pr-3 py-2 rounded-lg border border-accent/60 bg-input text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setIsManualDesignation(false); setManualDesignationName(''); setSelectedDesignation(''); }}
                                        title="Cancel manual entry"
                                        className="p-2 rounded-lg border border-border text-muted hover:border-red-400 hover:text-red-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                                    <p className="text-xs text-amber-700">
                                        <strong>Manual entry</strong> — this designation is not in the master list. It will be saved as typed.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {manpowerStatus.message && (
                    <div className={`mt-4 text-sm p-3 rounded-lg ${manpowerStatus.isOverLimit ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {manpowerStatus.message}
                    </div>
                )}

                <div className="mt-8 pt-6 border-t flex justify-end">
                    <Button onClick={handleContinue} disabled={canContinue}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SelectOrganization;