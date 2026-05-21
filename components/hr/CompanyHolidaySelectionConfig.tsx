import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import type { OrganizationGroup, Entity } from '../../types';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import { Building, Save, Sun, Search, Filter, X, MapPin, Globe, RotateCcw } from 'lucide-react';

interface CompanyHolidaySelectionConfigProps {
    searchTerm?: string;
    selectedLocation?: string;
}

export const CompanyHolidaySelectionConfig: React.FC<CompanyHolidaySelectionConfigProps> = ({
    searchTerm = '',
    selectedLocation = ''
}) => {
    const [groups, setGroups] = useState<OrganizationGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Advanced Local Filter States
    const [localSearchTerm, setLocalSearchTerm] = useState('');
    const [selectedLocalLocation, setSelectedLocalLocation] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedEntityId, setSelectedEntityId] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    // Sync local filters with parent page filter actions
    useEffect(() => {
        if (selectedLocation !== undefined) {
            setSelectedLocalLocation(selectedLocation);
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (searchTerm !== undefined) {
            setLocalSearchTerm(searchTerm);
        }
    }, [searchTerm]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const structure = await api.getOrganizationStructure();
            setGroups(structure);
        } catch (error) {
            setToast({ message: "Failed to load client structure.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectionChange = (groupId: string, companyId: string, entityId: string, holidayType: 'company_10' | 'company_12' | '') => {
        setGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== groupId) return group;
            return {
                ...group,
                companies: group.companies.map(company => {
                    if (company.id !== companyId) return company;
                    return {
                        ...company,
                        entities: company.entities.map(entity => {
                            if (entity.id !== entityId) return entity;
                            
                            // Initialize holidayConfig if it doesn't exist
                            const currentConfig = entity.holidayConfig || {};
                            
                            return {
                                ...entity,
                                holidayConfig: {
                                    ...currentConfig,
                                    holidayType: holidayType
                                }
                            };
                        })
                    };
                })
            };
        }));
    };

    const handleSaveEntity = async (entity: Entity) => {
        setIsSaving(entity.id);
        try {
            await api.saveEntity(entity);
            setToast({ message: `Holiday settings for ${entity.name} saved successfully.`, type: 'success' });
        } catch (error) {
            console.error('Failed to save entity:', error);
            setToast({ message: `Failed to save holiday settings for ${entity.name}.`, type: 'error' });
        } finally {
            setIsSaving(null);
        }
    };

    // Reset Filters Handler
    const handleResetFilters = () => {
        setLocalSearchTerm('');
        setSelectedLocalLocation('');
        setSelectedCompanyId('');
        setSelectedEntityId('');
    };

    // Auto-reset dependent selections when parent selections change
    useEffect(() => {
        if (selectedLocalLocation && selectedCompanyId) {
            // Find if selected company is valid under the selected location
            const isValid = groups.some(group => 
                group.companies.some(company => 
                    company.id === selectedCompanyId && 
                    (company.location === selectedLocalLocation || 
                     company.entities.some(e => e.location === selectedLocalLocation))
                )
            );
            if (!isValid) {
                setSelectedCompanyId('');
            }
        }
    }, [selectedLocalLocation, groups]);

    useEffect(() => {
        if (selectedEntityId) {
            // Find if the selected site is valid under current company & location filters
            const isValid = groups.some(group => 
                group.companies.some(company => {
                    // If company filter is active, must match company
                    if (selectedCompanyId && company.id !== selectedCompanyId) return false;
                    
                    return company.entities.some(entity => {
                        if (entity.id !== selectedEntityId) return false;
                        
                        // If location filter is active, either company or entity must match the location
                        if (selectedLocalLocation) {
                            const companyMatches = company.location === selectedLocalLocation;
                            const entityMatches = entity.location === selectedLocalLocation;
                            return companyMatches || entityMatches;
                        }
                        
                        return true;
                    });
                })
            );
            if (!isValid) {
                setSelectedEntityId('');
            }
        }
    }, [selectedLocalLocation, selectedCompanyId, groups]);

    // Memoize Selectors for Unique Dropdown Options
    const allCompanies = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        groups.forEach(group => {
            group.companies.forEach(company => {
                if (!seen.has(company.id)) {
                    // Check if company matches the selected local location
                    if (selectedLocalLocation) {
                        const companyMatches = company.location === selectedLocalLocation;
                        const hasMatchingEntity = company.entities.some(entity => entity.location === selectedLocalLocation);
                        if (!companyMatches && !hasMatchingEntity) {
                            return;
                        }
                    }
                    seen.add(company.id);
                    list.push({ id: company.id, name: company.name });
                }
            });
        });
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [groups, selectedLocalLocation]);

    const allSites = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        groups.forEach(group => {
            group.companies.forEach(company => {
                // Filter by company if selected
                if (selectedCompanyId && company.id !== selectedCompanyId) {
                    return;
                }
                company.entities.forEach(entity => {
                    if (!seen.has(entity.id)) {
                        // Filter by location if selected
                        if (selectedLocalLocation) {
                            const companyMatches = company.location === selectedLocalLocation;
                            const entityMatches = entity.location === selectedLocalLocation;
                            if (!companyMatches && !entityMatches) {
                                return;
                            }
                        }
                        seen.add(entity.id);
                        list.push({ id: entity.id, name: entity.name });
                    }
                });
            });
        });
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [groups, selectedLocalLocation, selectedCompanyId]);


    const allLocations = useMemo(() => {
        const set = new Set<string>();
        groups.forEach(group => {
            group.companies.forEach(company => {
                if (company.location) {
                    set.add(company.location);
                }
                company.entities.forEach(entity => {
                    if (entity.location) {
                        set.add(entity.location);
                    }
                });
            });
        });
        return Array.from(set).sort();
    }, [groups]);

    // Check if any filter is active to perform clean filtering logic
    const isAnyFilterActive = useMemo(() => {
        return !!(
            localSearchTerm.trim() || 
            selectedLocalLocation || 
            selectedCompanyId || 
            selectedEntityId
        );
    }, [localSearchTerm, selectedLocalLocation, selectedCompanyId, selectedEntityId]);

    // Memoize Filtered Groups structure
    const filteredGroups = useMemo(() => {
        const activeSearch = localSearchTerm.trim().toLowerCase();
        const activeLocation = selectedLocalLocation;
        const activeCompanyId = selectedCompanyId;
        const activeSiteId = selectedEntityId;

        // Comma-separated multi-search query split
        const searchTerms = activeSearch
            ? activeSearch.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        return groups.map(group => {
            const filteredCompanies = group.companies.map(company => {
                const companyMatchesLocation = activeLocation ? company.location === activeLocation : true;

                const filteredEntities = company.entities.filter(entity => {
                    // 1. Location Filter check
                    if (activeLocation) {
                        const entityMatchesLocation = entity.location === activeLocation;
                        if (!companyMatchesLocation && !entityMatchesLocation) {
                            return false;
                        }
                    }

                    // 2. Company Filter check
                    if (activeCompanyId && company.id !== activeCompanyId) {
                        return false;
                    }

                    // 3. Site Filter check
                    if (activeSiteId && entity.id !== activeSiteId) {
                        return false;
                    }

                    // 4. Multi-Search bar query check (OR logic across split words)
                    if (searchTerms.length > 0) {
                        const matchesAnyTerm = searchTerms.some(term => {
                            const matchGroup = group.name.toLowerCase().includes(term);
                            const matchCompany = company.name.toLowerCase().includes(term);
                            const matchEntity = entity.name.toLowerCase().includes(term);
                            const matchLocation = entity.location?.toLowerCase().includes(term) || false;
                            return matchGroup || matchCompany || matchEntity || matchLocation;
                        });
                        if (!matchesAnyTerm) {
                            return false;
                        }
                    }

                    return true;
                });

                return {
                    ...company,
                    entities: filteredEntities
                };
            }).filter(company => !isAnyFilterActive || company.entities.length > 0);

            return {
                ...group,
                companies: filteredCompanies
            };
        }).filter(group => !isAnyFilterActive || group.companies.length > 0);
    }, [groups, localSearchTerm, selectedLocalLocation, selectedCompanyId, selectedEntityId, isAnyFilterActive]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="flex justify-between items-center border-b border-border pb-4">
                <div>
                    <h4 className="text-xl font-bold text-primary-text flex items-center gap-2">
                        <Sun className="h-6 w-6 text-accent" />
                        Company Holiday Selection
                    </h4>
                    <p className="text-sm text-muted">Assign holiday packages (Fixed 10, Fixed 12, or Custom) for each site.</p>
                </div>
            </div>

            {/* Advanced Local Filter Panel */}
            <div className="bg-card border border-border shadow-sm rounded-xl p-5 space-y-4 transition-all duration-300">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary-text">
                        <Filter className="h-4 w-4 text-accent" />
                        <span>Advanced Site Filters</span>
                    </div>
                    {isAnyFilterActive && (
                        <button
                            onClick={handleResetFilters}
                            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-bold transition-colors cursor-pointer bg-accent/5 px-2.5 py-1 rounded-md border border-accent/10 hover:bg-accent/10"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Multi-Search Input */}
                    <div className="relative md:col-span-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                            <Search className="h-4 w-4" />
                        </span>
                        <input
                            type="text"
                            placeholder="Multi-search: site, company, location (e.g. Fico, RMZ)..."
                            value={localSearchTerm}
                            onChange={(e) => setLocalSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-sm bg-page border border-border/80 rounded-lg text-primary-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all font-medium"
                        />
                        {localSearchTerm && (
                            <button
                                onClick={() => setLocalSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary-text transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Location Dropdown */}
                    <div className="relative">
                        <select
                            value={selectedLocalLocation}
                            onChange={(e) => setSelectedLocalLocation(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 text-sm bg-page border border-border/80 rounded-lg text-primary-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all appearance-none cursor-pointer font-medium"
                        >
                            <option value="">All Locations</option>
                            {allLocations.map((loc) => (
                                <option key={loc} value={loc}>
                                    {loc}
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                            <MapPin className="h-4 w-4" />
                        </span>
                    </div>

                    {/* Company Dropdown */}
                    <div className="relative">
                        <select
                            value={selectedCompanyId}
                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 text-sm bg-page border border-border/80 rounded-lg text-primary-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all appearance-none cursor-pointer font-medium"
                        >
                            <option value="">All Companies</option>
                            {allCompanies.map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                    {comp.name}
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                            <Building className="h-4 w-4" />
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {/* Site Dropdown */}
                    <div className="relative md:col-span-2">
                        <select
                            value={selectedEntityId}
                            onChange={(e) => setSelectedEntityId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 text-sm bg-page border border-border/80 rounded-lg text-primary-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all appearance-none cursor-pointer font-medium"
                        >
                            <option value="">All Sites</option>
                            {allSites.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.name}
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                            <Globe className="h-4 w-4" />
                        </span>
                    </div>

                    {/* Active Filter Badges */}
                    {isAnyFilterActive && (
                        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                            {localSearchTerm && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
                                    Search: "{localSearchTerm}"
                                    <X className="h-3 w-3 cursor-pointer hover:text-accent/80 transition-colors" onClick={() => setLocalSearchTerm('')} />
                                </span>
                            )}
                            {selectedLocalLocation && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
                                    Location: {selectedLocalLocation}
                                    <X className="h-3 w-3 cursor-pointer hover:text-accent/80 transition-colors" onClick={() => setSelectedLocalLocation('')} />
                                </span>
                            )}
                            {selectedCompanyId && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
                                    Company: {allCompanies.find(c => c.id === selectedCompanyId)?.name || 'Selected'}
                                    <X className="h-3 w-3 cursor-pointer hover:text-accent/80 transition-colors" onClick={() => setSelectedCompanyId('')} />
                                </span>
                            )}
                            {selectedEntityId && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
                                    Site: {allSites.find(s => s.id === selectedEntityId)?.name || 'Selected'}
                                    <X className="h-3 w-3 cursor-pointer hover:text-accent/80 transition-colors" onClick={() => setSelectedEntityId('')} />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {groups.length === 0 ? (
                    <div className="text-center py-12 bg-page/30 rounded-xl border border-dashed border-border">
                        <p className="text-muted">No clients found.</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="text-center py-20 bg-card border border-border shadow-sm rounded-xl">
                        <Building className="h-16 w-16 mx-auto mb-4 text-muted/30" />
                        <h5 className="text-lg font-bold text-primary-text">No matching sites found</h5>
                        <p className="text-muted text-sm mt-1 max-w-sm mx-auto">Try adjusting your filters or searching for another term. Comma-separated search can query multiple values simultaneously.</p>
                        {isAnyFilterActive && (
                            <Button
                                onClick={handleResetFilters}
                                variant="outline"
                                className="mt-5 border-accent/20 hover:bg-accent/5 text-accent font-bold"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset Active Filters
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredGroups.map(group => (
                        <div key={group.id} className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-shadow hover:shadow-md duration-300">
                            <div className="p-4 bg-page/10 border-b border-border/50">
                                <h3 className="font-bold text-lg text-primary-text">{group.name}</h3>
                            </div>
                            
                            <div className="divide-y divide-border/30">
                                {group.companies.map(company => (
                                    <div key={company.id} className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Building className="h-5 w-5 text-muted" />
                                            <h4 className="font-semibold text-primary-text">{company.name}</h4>
                                        </div>
                                        
                                        {company.entities.length === 0 ? (
                                            <p className="text-sm text-muted italic ml-7">No sites available for this company.</p>
                                        ) : (
                                            <div className="space-y-3 pl-7">
                                                {company.entities.map(entity => {
                                                    const currentHolidayType = entity.holidayConfig?.holidayType || '';
                                                    const isCustom = currentHolidayType === '' || currentHolidayType === 'custom_10' || currentHolidayType === 'custom_12';
                                                    
                                                    return (
                                                        <div key={entity.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-page/5 border border-border/40 rounded-lg hover:border-accent/30 transition-colors">
                                                            <div className="flex-1">
                                                                <span className="font-medium text-primary-text block">{entity.name}</span>
                                                                {entity.location && <span className="text-xs text-muted mt-1 bg-page px-2 py-0.5 rounded border border-border inline-block">{entity.location}</span>}
                                                            </div>
                                                            
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border text-sm transition-colors ${currentHolidayType === 'company_10' ? 'bg-accent/10 border-accent/30 text-accent font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`holiday-type-${entity.id}`}
                                                                        value="company_10"
                                                                        checked={currentHolidayType === 'company_10'}
                                                                        onChange={() => handleSelectionChange(group.id, company.id, entity.id, 'company_10')}
                                                                        className="accent-accent"
                                                                    />
                                                                    10 Days (Fixed)
                                                                </label>
                                                                
                                                                <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border text-sm transition-colors ${currentHolidayType === 'company_12' ? 'bg-accent/10 border-accent/30 text-accent font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`holiday-type-${entity.id}`}
                                                                        value="company_12"
                                                                        checked={currentHolidayType === 'company_12'}
                                                                        onChange={() => handleSelectionChange(group.id, company.id, entity.id, 'company_12')}
                                                                        className="accent-accent"
                                                                    />
                                                                    12 Days (Fixed)
                                                                </label>
                                                                
                                                                <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border text-sm transition-colors ${isCustom ? 'bg-accent/10 border-accent/30 text-accent font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`holiday-type-${entity.id}`}
                                                                        value=""
                                                                        checked={isCustom}
                                                                        onChange={() => handleSelectionChange(group.id, company.id, entity.id, '')}
                                                                        className="accent-accent"
                                                                    />
                                                                    Custom
                                                                </label>
 
                                                                <Button 
                                                                    onClick={() => handleSaveEntity(entity)}
                                                                    disabled={isSaving === entity.id}
                                                                    className="ml-2"
                                                                    size="sm"
                                                                >
                                                                    {isSaving === entity.id ? (
                                                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Saving...</>
                                                                    ) : (
                                                                        <><Save className="h-4 w-4 mr-1.5" /> Save</>
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CompanyHolidaySelectionConfig;
