import React, { useState, useEffect, useMemo } from 'react';
import type { 
    Organization, 
    MasterGentsUniforms, 
    GentsPantsSize, 
    GentsShirtSize, 
    MasterLadiesUniforms, 
    LadiesPantsSize, 
    LadiesShirtSize, 
    UniformRequest, 
    UniformRequestItem, 
    EmployeeUniformSelection 
} from '../../types';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { 
    Loader2, 
    Plus, 
    Shirt, 
    Edit, 
    Trash2, 
    Save, 
    ArrowLeft, 
    Building2, 
    Calendar, 
    Search, 
    Package, 
    Layers,
    CheckCircle2,
    Sparkles,
    X,
    Ruler
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';

type GarmentRow = {
    id: string; // unique local row key
    size: string;
    fit: string;
    quantity: number;
};

const UniformStatusChip: React.FC<{ status: UniformRequest['status'] }> = ({ status }) => {
    const styles: Record<UniformRequest['status'], string> = {
        'Pending': 'bg-amber-50 text-amber-700 border-amber-200/80',
        'Approved': 'bg-sky-50 text-sky-700 border-sky-200/80',
        'Issued': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        'Rejected': 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
    const dotColors: Record<UniformRequest['status'], string> = {
        'Pending': 'bg-amber-500',
        'Approved': 'bg-sky-500',
        'Issued': 'bg-emerald-500',
        'Rejected': 'bg-rose-500',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border shadow-xs ${styles[status] || styles['Pending']}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] || 'bg-amber-500'}`} />
            {status}
        </span>
    );
};

const REQUIRED_FITS = ['Regular Fit', 'Slim Fit', 'Loose Fit'] as const;

// Helper to find exact specs or compute tailored specifications for any fit variant (Slim Fit, Regular Fit, Loose Fit)
function getGarmentSpecifications(
    category: 'Pants' | 'Shirts',
    sizeStr: string,
    fitStr: string,
    catalog: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[]
) {
    if (!sizeStr) return null;

    // 1. Exact match in catalog
    const exact = catalog.find(s => String(s.size) === String(sizeStr) && s.fit === fitStr);
    if (exact) return exact;

    // 2. Base size match in catalog (e.g. Regular Fit or first available)
    const base = catalog.find(s => String(s.size) === String(sizeStr)) || catalog[0];
    if (!base) return null;

    const numSize = parseInt(sizeStr) || 32;
    const isLoose = fitStr === 'Loose Fit' || fitStr === 'Comfort Fit' || fitStr === 'Plump Fit';
    const isSlim = fitStr === 'Slim Fit';

    if (category === 'Pants') {
        const baseWaist = (base as any).waist ?? numSize;
        const baseHip = (base as any).hip ?? (baseWaist + 6);
        const baseTiles = (base as any).tilesLoose ?? 21;
        const baseBottom = (base as any).bottomWaist ?? 15;

        return {
            ...base,
            id: (base as any).id ? `${(base as any).id}_${fitStr.toLowerCase().replace(/\s+/g, '_')}` : `derived_pants_${sizeStr}`,
            size: sizeStr,
            fit: fitStr,
            length: base.length,
            waist: baseWaist,
            hip: isSlim ? baseHip - 1 : isLoose ? baseHip + 2 : baseHip,
            tilesLoose: isSlim ? Math.max(18, baseTiles - 1) : isLoose ? baseTiles + 1.5 : baseTiles,
            bottomWaist: isSlim ? Math.max(13, baseBottom - 0.5) : isLoose ? baseBottom + 0.5 : baseBottom,
        };
    } else {
        const baseChest = (base as any).chest;
        const baseBust = (base as any).bust;
        const baseShoulder = (base as any).shoulder ?? 17.5;
        const baseSleeves = (base as any).sleeves ?? 24;

        return {
            ...base,
            id: (base as any).id ? `${(base as any).id}_${fitStr.toLowerCase().replace(/\s+/g, '_')}` : `derived_shirts_${sizeStr}`,
            size: sizeStr,
            fit: fitStr,
            length: base.length,
            sleeves: baseSleeves,
            chest: baseChest ? (isSlim ? baseChest - 1 : isLoose ? baseChest + 2 : baseChest) : undefined,
            bust: baseBust ? (isSlim ? baseBust - 1 : isLoose ? baseBust + 2 : baseBust) : undefined,
            shoulder: isSlim ? baseShoulder : isLoose ? baseShoulder + 0.5 : baseShoulder,
            collar: (base as any).collar,
        };
    }
}

// Component for a single garment category (Pants or Shirts) with dropdown selectors & auto-filled specs
const GarmentCategorySelector: React.FC<{
    category: 'Pants' | 'Shirts';
    title: string;
    gender: 'Gents' | 'Ladies';
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    rows: GarmentRow[];
    onRowsChange: (newRows: GarmentRow[]) => void;
}> = ({ category, title, gender, sizes, rows, onRowsChange }) => {
    const uniqueSizes = useMemo<string[]>(() => {
        const rawSizes = sizes.map(s => String(s.size));
        const set = new Set<string>(rawSizes);
        return Array.from<string>(set).sort((a: string, b: string) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [sizes]);

    const handleAddRow = () => {
        const defaultSize = uniqueSizes[0] || '';
        const newRow: GarmentRow = {
            id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            size: defaultSize,
            fit: 'Regular Fit',
            quantity: 1,
        };
        onRowsChange([...rows, newRow]);
    };

    const handleRemoveRow = (rowId: string) => {
        if (rows.length === 1) {
            // Keep at least one empty row
            onRowsChange([{ id: `row_${Date.now()}`, size: '', fit: 'Regular Fit', quantity: 1 }]);
            return;
        }
        onRowsChange(rows.filter(r => r.id !== rowId));
    };

    const handleRowChange = (rowId: string, updates: Partial<GarmentRow>) => {
        onRowsChange(rows.map(r => {
            if (r.id !== rowId) return r;
            const updated = { ...r, ...updates };
            if (updates.size && !updated.fit) {
                updated.fit = 'Regular Fit';
            }
            return updated;
        }));
    };

    return (
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md">
            {/* Header */}
            <div className="px-5 py-4 bg-page/40 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Shirt className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-primary-text tracking-tight">{title}</h3>
                        <p className="text-[11px] text-muted">Select size, fit & quantity • Specs auto-fill</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 font-bold text-xs border border-emerald-200/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Size</span>
                </button>
            </div>

            {/* Rows List */}
            <div className="p-5 space-y-4 flex-1">
                {rows.map((row, index) => {
                    // Fits list explicitly includes user-requested fits: Regular Fit, Slim Fit, Loose Fit + catalog fits
                    const catalogFits = sizes.filter(s => String(s.size) === String(row.size)).map(s => s.fit);
                    const availableFits = Array.from(new Set([...REQUIRED_FITS, ...catalogFits]));

                    // Find matched or dynamically derived size object for auto-fill specs
                    const matchedSize = row.size ? getGarmentSpecifications(category, row.size, row.fit || 'Regular Fit', sizes) : null;

                    return (
                        <div 
                            key={row.id}
                            className="p-4 rounded-xl border border-border bg-page/40 space-y-3.5 transition-all hover:border-emerald-500/30 hover:bg-page/70"
                        >
                            {/* Top selector controls row: Size, Fit, Quantity, Delete */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                {/* Size Dropdown */}
                                <div className="flex-1 min-w-[130px]">
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                                        Size <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={row.size}
                                        onChange={e => handleRowChange(row.id, { size: e.target.value })}
                                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-border bg-card text-primary-text focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs cursor-pointer"
                                    >
                                        <option value="">-- Select Size --</option>
                                        {uniqueSizes.map(sz => (
                                            <option key={sz} value={sz}>
                                                Size {sz}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Fit Dropdown */}
                                <div className="flex-1 min-w-[140px]">
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                                        Fit <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={row.fit || 'Regular Fit'}
                                        onChange={e => handleRowChange(row.id, { fit: e.target.value })}
                                        disabled={!row.size}
                                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-border bg-card text-primary-text focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs disabled:opacity-50 cursor-pointer"
                                    >
                                        {availableFits.map(f => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Quantity Input */}
                                <div className="w-full sm:w-28">
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                                        Quantity
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={row.quantity || ''}
                                        onChange={e => handleRowChange(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                        placeholder="1"
                                        className="w-full px-3 py-2 text-center text-xs font-black rounded-lg border border-border bg-card text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                                    />
                                </div>

                                {/* Remove Button */}
                                {rows.length > 1 && (
                                    <div className="sm:self-end sm:pb-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRow(row.id)}
                                            className="p-2 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                            title="Remove item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Auto-filled specifications panel ("rest auto fill") */}
                            <div className="pt-2 border-t border-border/60">
                                {matchedSize ? (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mb-2">
                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Auto-filled Specifications ({row.size} • {row.fit}):</span>
                                        </div>

                                        {category === 'Pants' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Length (L)</span>
                                                    <span className="font-extrabold text-primary-text">{matchedSize.length}"</span>
                                                </div>
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Waist (W)</span>
                                                    <span className="font-extrabold text-primary-text">{(matchedSize as any).waist}"</span>
                                                </div>
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Hip (H)</span>
                                                    <span className="font-extrabold text-primary-text">{(matchedSize as any).hip}"</span>
                                                </div>
                                                {'tilesLoose' in matchedSize && (
                                                    <div className="bg-card p-1.5 rounded-lg border border-border">
                                                        <span className="text-[10px] text-muted block">Tiles Loose</span>
                                                        <span className="font-extrabold text-primary-text">{(matchedSize as any).tilesLoose}"</span>
                                                    </div>
                                                )}
                                                {'bottomWaist' in matchedSize && (
                                                    <div className="bg-card p-1.5 rounded-lg border border-border">
                                                        <span className="text-[10px] text-muted block">Bottom Waist</span>
                                                        <span className="font-extrabold text-primary-text">{(matchedSize as any).bottomWaist}"</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Length (L)</span>
                                                    <span className="font-extrabold text-primary-text">{matchedSize.length}"</span>
                                                </div>
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Sleeves (S)</span>
                                                    <span className="font-extrabold text-primary-text">{(matchedSize as any).sleeves}"</span>
                                                </div>
                                                {'chest' in matchedSize && (
                                                    <div className="bg-card p-1.5 rounded-lg border border-border">
                                                        <span className="text-[10px] text-muted block">Chest (C)</span>
                                                        <span className="font-extrabold text-primary-text">{(matchedSize as any).chest}"</span>
                                                    </div>
                                                )}
                                                {'bust' in matchedSize && (
                                                    <div className="bg-card p-1.5 rounded-lg border border-border">
                                                        <span className="text-[10px] text-muted block">Bust (B)</span>
                                                        <span className="font-extrabold text-primary-text">{(matchedSize as any).bust}"</span>
                                                    </div>
                                                )}
                                                <div className="bg-card p-1.5 rounded-lg border border-border">
                                                    <span className="text-[10px] text-muted block">Shoulder (Sh)</span>
                                                    <span className="font-extrabold text-primary-text">{(matchedSize as any).shoulder}"</span>
                                                </div>
                                                {'collar' in matchedSize && (
                                                    <div className="bg-card p-1.5 rounded-lg border border-border">
                                                        <span className="text-[10px] text-muted block">Collar</span>
                                                        <span className="font-extrabold text-primary-text">{(matchedSize as any).collar}"</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-page border border-dashed border-border text-xs text-muted">
                                        <Ruler className="w-4 h-4 text-muted/60" />
                                        <span>Select Size and Fit above to preview auto-filled measurements.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const UniformRequestForm: React.FC<{
    onSave: (data: UniformRequest) => void;
    onCancel: () => void;
    sites: Organization[];
    masterUniforms: { gents: MasterGentsUniforms, ladies: MasterLadiesUniforms };
    initialData?: UniformRequest | null;
}> = ({ onSave, onCancel, sites, masterUniforms, initialData }) => {
    const { data: onboardingData } = useOnboardingStore();
    const { user } = useAuthStore();

    // Intelligently resolve the site the user started onboarding with
    const resolveOnboardingSiteId = useMemo(() => {
        if (!sites || sites.length === 0) return '';
        
        // Priority 1: Existing request site
        if (initialData?.siteId && sites.some(s => s.id === initialData.siteId)) {
            return initialData.siteId;
        }

        // Priority 2: From active onboarding store organization data
        const orgId = onboardingData.organization?.organizationId?.trim();
        const orgName = (onboardingData.organization?.organizationName || (onboardingData.organization as any)?.site || '').trim().toLowerCase();
        const companyName = (onboardingData.organization?.companyName || '').trim().toLowerCase();

        if (orgId) {
            const matchById = sites.find(s => s.id === orgId);
            if (matchById) return matchById.id;
        }

        if (orgName) {
            const matchByName = sites.find(s => {
                const sn = (s.shortName || '').toLowerCase();
                const fn = (s.fullName || '').toLowerCase();
                return sn === orgName || fn === orgName || orgName.includes(sn) || sn.includes(orgName) || fn.includes(orgName);
            });
            if (matchByName) return matchByName.id;
        }

        if (companyName) {
            const matchByCompany = sites.find(s => {
                const sn = (s.shortName || '').toLowerCase();
                const fn = (s.fullName || '').toLowerCase();
                return companyName.includes(sn) || sn.includes(companyName) || fn.includes(companyName);
            });
            if (matchByCompany) return matchByCompany.id;
        }

        // Priority 3: From localStorage draft directly
        try {
            const rawDraft = typeof window !== 'undefined' ? localStorage.getItem('paradigm_onboarding_draft') : null;
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                const draftOrg = parsed?.state?.data?.organization;
                const draftOrgId = draftOrg?.organizationId?.trim();
                const draftOrgName = (draftOrg?.organizationName || draftOrg?.site || '').trim().toLowerCase();

                if (draftOrgId) {
                    const matchById = sites.find(s => s.id === draftOrgId);
                    if (matchById) return matchById.id;
                }
                if (draftOrgName) {
                    const matchByName = sites.find(s => {
                        const sn = (s.shortName || '').toLowerCase();
                        const fn = (s.fullName || '').toLowerCase();
                        return sn === draftOrgName || fn === draftOrgName || draftOrgName.includes(sn) || sn.includes(draftOrgName);
                    });
                    if (matchByName) return matchByName.id;
                }
            }
        } catch (_err) {
            /* ignore */
        }

        // Priority 4: User's profile society / site from authStore
        const userSociety = (user?.societyName || user?.organizationName || '').trim().toLowerCase();
        if (userSociety) {
            const matchByUser = sites.find(s => {
                const sn = (s.shortName || '').toLowerCase();
                const fn = (s.fullName || '').toLowerCase();
                return sn === userSociety || fn === userSociety || userSociety.includes(sn) || sn.includes(userSociety);
            });
            if (matchByUser) return matchByUser.id;
        }

        // Fallback default: First site in list
        return sites[0]?.id || '';
    }, [sites, initialData, onboardingData.organization, user]);

    const [siteId, setSiteId] = useState<string>(() => {
        return initialData?.siteId || resolveOnboardingSiteId || (sites.length > 0 ? sites[0].id : '');
    });

    // Auto-select site whenever sites load or onboarding site is resolved
    useEffect(() => {
        if (!siteId && resolveOnboardingSiteId) {
            setSiteId(resolveOnboardingSiteId);
        } else if (initialData?.siteId && initialData.siteId !== siteId) {
            setSiteId(initialData.siteId);
        }
    }, [resolveOnboardingSiteId, initialData, siteId]);

    const [searchParams] = useSearchParams();

    // Helper to normalize input gender to 'Ladies' or 'Gents'
    const normalizeCandidateGender = (val: string | null | undefined): 'Gents' | 'Ladies' | null => {
        if (!val) return null;
        const lower = val.trim().toLowerCase();
        if (lower === 'female' || lower === 'ladies' || lower === 'f' || lower === 'woman') {
            return 'Ladies';
        }
        if (lower === 'male' || lower === 'gents' || lower === 'm' || lower === 'man') {
            return 'Gents';
        }
        return null;
    };

    // Intelligently resolve the candidate's fed gender from onboarding
    const { resolvedGender, feededGenderLabel } = useMemo(() => {
        if (initialData?.gender === 'Gents' || initialData?.gender === 'Ladies') {
            return { resolvedGender: initialData.gender, feededGenderLabel: initialData.gender === 'Gents' ? 'Male' : 'Female' };
        }

        // 1. From onboardingStore personal details
        const storeNormalized = normalizeCandidateGender(onboardingData.personal?.gender);
        if (storeNormalized) {
            return {
                resolvedGender: storeNormalized,
                feededGenderLabel: storeNormalized === 'Ladies' ? 'Female' : 'Male'
            };
        }

        // 2. From localStorage draft
        try {
            const rawDraft = typeof window !== 'undefined' ? localStorage.getItem('paradigm_onboarding_draft') : null;
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                const draftGender = parsed?.state?.data?.personal?.gender;
                const draftNormalized = normalizeCandidateGender(draftGender);
                if (draftNormalized) {
                    return {
                        resolvedGender: draftNormalized,
                        feededGenderLabel: draftNormalized === 'Ladies' ? 'Female' : 'Male'
                    };
                }
            }
        } catch (_err) {
            /* ignore */
        }

        // 3. From URL search params (?gender=female / ?gender=male)
        const paramNormalized = normalizeCandidateGender(searchParams.get('gender'));
        if (paramNormalized) {
            return {
                resolvedGender: paramNormalized,
                feededGenderLabel: paramNormalized === 'Ladies' ? 'Female' : 'Male'
            };
        }

        return { resolvedGender: 'Gents' as const, feededGenderLabel: null };
    }, [initialData, onboardingData.personal?.gender, searchParams]);

    const [gender, setGender] = useState<'Gents' | 'Ladies'>(() => {
        return initialData?.gender || resolvedGender;
    });

    // Auto-sync gender when candidate's feeded gender is detected or changes
    useEffect(() => {
        if (!initialData?.gender && resolvedGender && resolvedGender !== gender) {
            setGender(resolvedGender);
            const catalogPants = resolvedGender === 'Gents' ? masterUniforms.gents.pants : masterUniforms.ladies.pants;
            const catalogShirts = resolvedGender === 'Gents' ? masterUniforms.gents.shirts : masterUniforms.ladies.shirts;
            const defPants = catalogPants[0];
            const defShirts = catalogShirts[0];
            setPantsRows([{
                id: `pants_auto_${Date.now()}`,
                size: defPants ? defPants.size : (resolvedGender === 'Gents' ? '32' : '30'),
                fit: 'Regular Fit',
                quantity: 2,
            }]);
            setShirtsRows([{
                id: `shirts_auto_${Date.now()}`,
                size: defShirts ? defShirts.size : (resolvedGender === 'Gents' ? '40' : '36'),
                fit: 'Regular Fit',
                quantity: 2,
            }]);
        }
    }, [resolvedGender, initialData]);

    // Initial pants and shirts rows
    const [pantsRows, setPantsRows] = useState<GarmentRow[]>(() => {
        if (initialData?.items) {
            const pantsItems = initialData.items.filter(i => i.category === 'Pants');
            if (pantsItems.length > 0) {
                return pantsItems.map(item => ({
                    id: `pants_${item.sizeId}_${Math.random()}`,
                    size: item.sizeLabel,
                    fit: item.fit,
                    quantity: item.quantity,
                }));
            }
        }
        // Default initial row
        const catalogPants = gender === 'Gents' ? masterUniforms.gents.pants : masterUniforms.ladies.pants;
        const defaultPants = catalogPants[0];
        return [{
            id: 'pants_init_1',
            size: defaultPants ? defaultPants.size : (gender === 'Gents' ? '32' : '30'),
            fit: 'Regular Fit',
            quantity: 2,
        }];
    });

    const [shirtsRows, setShirtsRows] = useState<GarmentRow[]>(() => {
        if (initialData?.items) {
            const shirtsItems = initialData.items.filter(i => i.category === 'Shirts');
            if (shirtsItems.length > 0) {
                return shirtsItems.map(item => ({
                    id: `shirts_${item.sizeId}_${Math.random()}`,
                    size: item.sizeLabel,
                    fit: item.fit,
                    quantity: item.quantity,
                }));
            }
        }
        // Default initial row
        const catalogShirts = gender === 'Gents' ? masterUniforms.gents.shirts : masterUniforms.ladies.shirts;
        const defaultShirts = catalogShirts[0];
        return [{
            id: 'shirts_init_1',
            size: defaultShirts ? defaultShirts.size : (gender === 'Gents' ? '40' : '36'),
            fit: 'Regular Fit',
            quantity: 2,
        }];
    });

    // When gender switches, adjust default sizes if they don't match the new catalog
    const handleGenderChange = (newGender: 'Gents' | 'Ladies') => {
        setGender(newGender);
        const catalogPants = newGender === 'Gents' ? masterUniforms.gents.pants : masterUniforms.ladies.pants;
        const catalogShirts = newGender === 'Gents' ? masterUniforms.gents.shirts : masterUniforms.ladies.shirts;

        setPantsRows(prev => prev.map(row => {
            const sizeExists = catalogPants.some(s => String(s.size) === String(row.size));
            if (!sizeExists) {
                const def = catalogPants[0];
                return { ...row, size: def?.size || '', fit: row.fit || 'Regular Fit' };
            }
            return row;
        }));

        setShirtsRows(prev => prev.map(row => {
            const sizeExists = catalogShirts.some(s => String(s.size) === String(row.size));
            if (!sizeExists) {
                const def = catalogShirts[0];
                return { ...row, size: def?.size || '', fit: row.fit || 'Regular Fit' };
            }
            return row;
        }));
    };

    const totalPants = useMemo(() => {
        return pantsRows.reduce((acc, r) => acc + (r.size && r.fit ? (r.quantity || 0) : 0), 0);
    }, [pantsRows]);

    const totalShirts = useMemo(() => {
        return shirtsRows.reduce((acc, r) => acc + (r.size && r.fit ? (r.quantity || 0) : 0), 0);
    }, [shirtsRows]);

    const grandTotal = totalPants + totalShirts;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const site = sites.find(s => s.id === siteId) || sites[0];
        if (!site || !user) return;

        const currentPantsCatalog = gender === 'Gents' ? masterUniforms.gents.pants : masterUniforms.ladies.pants;
        const currentShirtsCatalog = gender === 'Gents' ? masterUniforms.gents.shirts : masterUniforms.ladies.shirts;

        const items: UniformRequestItem[] = [];

        // Build pants items
        for (const row of pantsRows) {
            if (row.size && row.fit && row.quantity > 0) {
                const matched = currentPantsCatalog.find(s => String(s.size) === String(row.size) && s.fit === row.fit);
                items.push({
                    sizeId: matched?.id || `${gender === 'Gents' ? 'gp' : 'lp'}_${row.size}_${row.fit.toLowerCase().replace(/\s+/g, '_')}`,
                    sizeLabel: row.size,
                    fit: row.fit as any,
                    category: 'Pants',
                    quantity: row.quantity,
                });
            }
        }

        // Build shirts items
        for (const row of shirtsRows) {
            if (row.size && row.fit && row.quantity > 0) {
                const matched = currentShirtsCatalog.find(s => String(s.size) === String(row.size) && s.fit === row.fit);
                items.push({
                    sizeId: matched?.id || `${gender === 'Gents' ? 'gs' : 'ls'}_${row.size}_${row.fit.toLowerCase().replace(/\s+/g, '_')}`,
                    sizeLabel: row.size,
                    fit: row.fit as any,
                    category: 'Shirts',
                    quantity: row.quantity,
                });
            }
        }

        const employeeName = onboardingData.personal.firstName || onboardingData.personal.lastName
            ? `${onboardingData.personal.firstName} ${onboardingData.personal.lastName}`.trim()
            : user.name;

        const request: UniformRequest = {
            id: initialData?.id || `new_${Date.now()}`,
            siteId: siteId || site.id,
            siteName: site.shortName,
            gender: gender,
            requestedDate: initialData?.requestedDate || new Date().toISOString(),
            status: initialData?.status || 'Pending',
            items: items,
            source: 'Individual',
            requestedById: user.id,
            requestedByName: user.name,
            employeeDetails: [{
                employeeName: employeeName,
                employeeId: onboardingData.personal.employeeId || 'EMP-ONBOARD',
                items: items.map(i => ({ itemName: i.category, sizeLabel: i.sizeLabel, fit: i.fit, quantity: i.quantity }))
            }]
        };

        onSave(request);
    };

    const currentPantsCatalog = gender === 'Gents' ? masterUniforms.gents.pants : masterUniforms.ladies.pants;
    const currentShirtsCatalog = gender === 'Gents' ? masterUniforms.gents.shirts : masterUniforms.ladies.shirts;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Top Config Card */}
            <div className="bg-card border border-border rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-primary-text">Requisition Scope</h3>
                                {feededGenderLabel && (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                                        Auto-Selected Gender ({gender === 'Gents' ? 'Male' : 'Female'})
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted">Select operational site and gender allocation framework.</p>
                        </div>
                    </div>

                    {/* Gender Segmented Switch with Male / Female Labels */}
                    <div className="inline-flex p-1 rounded-xl bg-page border border-border shadow-2xs self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => handleGenderChange('Gents')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                gender === 'Gents'
                                    ? 'bg-card text-emerald-700 shadow-xs border border-emerald-500/30'
                                    : 'text-muted hover:text-primary-text'
                            }`}
                        >
                            <span>Male</span>
                            <span className="text-[10px] opacity-75 font-normal">(Gents)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleGenderChange('Ladies')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                gender === 'Ladies'
                                    ? 'bg-card text-emerald-700 shadow-xs border border-emerald-500/30'
                                    : 'text-muted hover:text-primary-text'
                            }`}
                        >
                            <span>Female</span>
                            <span className="text-[10px] opacity-75 font-normal">(Ladies)</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-primary-text uppercase tracking-wider">
                                Select Site <span className="text-rose-500">*</span>
                            </label>
                            {siteId && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    Auto-Selected Site
                                </span>
                            )}
                        </div>
                        <select
                            value={siteId}
                            onChange={e => setSiteId(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-border bg-card text-primary-text focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all cursor-pointer"
                        >
                            <option value="">-- Choose Site --</option>
                            {sites.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.shortName} {s.fullName && s.fullName !== s.shortName ? `(${s.fullName})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Summary Counter Pill */}
                    <div className="p-3.5 rounded-xl bg-page/60 border border-border flex items-center justify-around">
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-muted uppercase">Pants</span>
                            <p className="text-sm font-extrabold text-primary-text">{totalPants} pcs</p>
                        </div>
                        <div className="h-6 w-[1px] bg-border" />
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-muted uppercase">Shirts</span>
                            <p className="text-sm font-extrabold text-primary-text">{totalShirts} pcs</p>
                        </div>
                        <div className="h-6 w-[1px] bg-border" />
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Items</span>
                            <p className="text-sm font-black text-emerald-600">{grandTotal} pcs</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dropdown-based Garment Selection Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GarmentCategorySelector
                    category="Pants"
                    title={`${gender}' Pants`}
                    gender={gender}
                    sizes={currentPantsCatalog}
                    rows={pantsRows}
                    onRowsChange={setPantsRows}
                />

                <GarmentCategorySelector
                    category="Shirts"
                    title={`${gender}' Shirts`}
                    gender={gender}
                    sizes={currentShirtsCatalog}
                    rows={shirtsRows}
                    onRowsChange={setShirtsRows}
                />
            </div>

            {/* Sticky Bottom Actions Bar */}
            <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-2 text-xs text-muted">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Allocating <strong>{grandTotal} units</strong> for {gender} personnel</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={onCancel}
                        className="flex-1 sm:flex-initial"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={grandTotal === 0}
                        className="flex-1 sm:flex-initial shadow-sm"
                    >
                        <Save className="mr-2 h-4 w-4" /> 
                        Save Request
                    </Button>
                </div>
            </div>
        </form>
    );
};

const UniformRequests: React.FC = () => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [requests, setRequests] = useState<UniformRequest[]>([]);
    const [sites, setSites] = useState<Organization[]>([]);
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingRequest, setEditingRequest] = useState<UniformRequest | null>(null);
    const [deletingRequest, setDeletingRequest] = useState<UniformRequest | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { updateUniforms } = useOnboardingStore();

    const cameFromOnboarding = searchParams.get('from') === 'onboarding';

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqs, sitesData, gentsData, ladiesData] = await Promise.all([
                api.getUniformRequests(),
                api.getOrganizations(),
                api.getMasterGentsUniforms(),
                api.getMasterLadiesUniforms(),
            ]);
            setRequests(reqs.sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()));
            setSites(sitesData);
            setMasterUniforms({ gents: gentsData, ladies: ladiesData });
        } catch (e) {
            setToast({ message: 'Failed to load uniform data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (cameFromOnboarding) {
            setView('form');
            setEditingRequest(null);
        }
    }, [cameFromOnboarding]);

    const handleNewRequest = () => {
        setEditingRequest(null);
        setView('form');
    };

    const handleEdit = (request: UniformRequest) => {
        setEditingRequest(request);
        setView('form');
    };
    
    const handleSave = async (requestData: UniformRequest) => {
        if (cameFromOnboarding && masterUniforms) {
            const masterSizes = requestData.gender === 'Ladies' 
                ? [...masterUniforms.ladies.pants, ...masterUniforms.ladies.shirts]
                : [...masterUniforms.gents.pants, ...masterUniforms.gents.shirts];
            
            const selections: EmployeeUniformSelection[] = requestData.items.map(item => {
                const sizeInfo = masterSizes.find(s => s.id === item.sizeId);
                const itemName = item.category === 'Pants' ? `${requestData.gender}' Pants` : `${requestData.gender}' Shirts`;
                const itemId = `generic_${requestData.gender.toLowerCase()}_${item.category === 'Pants' ? 'pants' : 'shirts'}`;
                
                return {
                    itemId: itemId,
                    itemName: itemName,
                    sizeId: item.sizeId,
                    sizeLabel: sizeInfo?.size || '',
                    fit: sizeInfo?.fit || '',
                    quantity: item.quantity
                };
            });
    
            updateUniforms(selections);
            await api.submitUniformRequest(requestData);
            navigate(-1);
            return;
        }

        try {
            if (requestData.id.startsWith('new_')) {
                await api.submitUniformRequest(requestData);
                setToast({ message: 'New request submitted successfully.', type: 'success' });
            } else {
                await api.updateUniformRequest(requestData);
                setToast({ message: 'Request updated successfully.', type: 'success' });
            }
            setView('list');
            fetchData();
        } catch (e) {
            setToast({ message: 'Failed to save request.', type: 'error' });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingRequest) return;
        try {
            await api.deleteUniformRequest(deletingRequest.id);
            setToast({ message: 'Request deleted.', type: 'success' });
            setDeletingRequest(null);
            fetchData();
        } catch (e) {
            setToast({ message: 'Failed to delete request.', type: 'error' });
        }
    };
    
    const totalItems = (items: UniformRequestItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch = !searchTerm || 
                req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.requestedByName && req.requestedByName.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [requests, searchTerm, statusFilter]);

    if (isLoading || !masterUniforms) {
        return (
            <div className="flex flex-col justify-center items-center h-96 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-xs text-muted font-medium">Loading uniform catalogue...</p>
            </div>
        );
    }

    if (view === 'form') {
        const handleCancel = () => {
            if (cameFromOnboarding) {
                navigate(-1);
            } else {
                setView('list');
            }
        };

        return (
            <div className="w-full p-2 sm:p-4 lg:p-6 space-y-6 animate-in fade-in duration-200">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

                {/* Header Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card hover:bg-page text-primary-text border border-border font-semibold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                        >
                            <ArrowLeft className="w-4 h-4 text-muted" />
                            <span>Back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-primary-text tracking-tight">
                                    {editingRequest ? 'Edit Uniform Request' : 'New Uniform Request'}
                                </h1>
                                {cameFromOnboarding && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                        Onboarding Linked
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                                Select size and fit from dropdowns • Garment specifications auto-fill automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <UniformRequestForm
                    onSave={handleSave}
                    onCancel={handleCancel}
                    sites={sites}
                    masterUniforms={masterUniforms}
                    initialData={editingRequest}
                />
            </div>
        );
    }

    return (
        <div className="w-full p-2 sm:p-4 lg:p-6 space-y-6 animate-in fade-in duration-200">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <Modal isOpen={!!deletingRequest} onClose={() => setDeletingRequest(null)} onConfirm={handleConfirmDelete} title="Confirm Deletion">
                Are you sure you want to delete this uniform request? This operation cannot be undone.
            </Modal>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/dashboard')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card hover:bg-page text-primary-text border border-border font-semibold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4 text-muted" />
                        <span>Back</span>
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-primary-text tracking-tight">
                            Uniform Requests
                        </h1>
                        <p className="text-xs text-muted mt-0.5">
                            Manage uniform provisioning records across enterprise client sites.
                        </p>
                    </div>
                </div>

                <Button onClick={handleNewRequest} className="shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> 
                    New Uniform Request
                </Button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-card border border-border rounded-2xl shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by site or requester..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-page text-primary-text focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-muted/60"
                    />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    {['All', 'Pending', 'Approved', 'Issued', 'Rejected'].map(status => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === status
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-page text-muted hover:text-primary-text hover:bg-page/80 border border-border'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Requests Grid / Table */}
            {filteredRequests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRequests.map(req => (
                        <div 
                            key={req.id} 
                            className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-primary-text tracking-tight line-clamp-1">{req.siteName}</h3>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted">
                                                <Calendar className="w-3 h-3" />
                                                <span>{format(new Date(req.requestedDate), 'dd MMM yyyy')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <UniformStatusChip status={req.status} />
                                </div>

                                <div className="p-3 rounded-xl bg-page/60 border border-border mb-4 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Type:</span>
                                        <span className="font-bold text-primary-text">{req.gender} Garments</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Total Units:</span>
                                        <span className="font-black text-emerald-600">{totalItems(req.items)} Pieces</span>
                                    </div>
                                    {req.requestedByName && (
                                        <div className="flex justify-between text-xs pt-1 border-t border-border/60">
                                            <span className="text-muted">Requested By:</span>
                                            <span className="text-primary-text font-medium truncate max-w-[150px]">{req.requestedByName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                {req.status === 'Pending' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(req)}
                                            className="p-2 rounded-xl bg-page hover:bg-page/80 border border-border text-primary-text transition-all cursor-pointer active:scale-95 shadow-2xs"
                                            title="Edit Request"
                                        >
                                            <Edit className="h-4 w-4 text-muted" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeletingRequest(req)}
                                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-600 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                            title="Delete Request"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xs">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                        <Package className="h-7 w-7 stroke-[1.5]" />
                    </div>
                    <h3 className="text-base font-bold text-primary-text">No uniform requests found</h3>
                    <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                        {searchTerm || statusFilter !== 'All' 
                            ? 'No uniform records match your search or filter criteria.' 
                            : 'There are currently no active uniform requisitions logged in the system.'}
                    </p>
                    <button
                        type="button"
                        onClick={handleNewRequest}
                        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                        <Plus className="h-4 w-4" /> 
                        Create First Request
                    </button>
                </div>
            )}
        </div>
    );
};

export default UniformRequests;
