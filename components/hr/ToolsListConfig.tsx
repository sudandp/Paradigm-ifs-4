
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import type { Organization, IssuedTool, MasterToolsList, MasterTool } from '../../types';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import UploadDocument from '../UploadDocument';
import Toast from '../ui/Toast';
import { Plus, Trash2, Save, Loader2, ChevronDown, Wrench, Eye, ArrowLeft, Search } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// --- Reusable Tool Form Components ---

const ToolAccordionItem: React.FC<{
    control: any;
    index: number;
    remove: (index: number) => void;
    masterTools: MasterToolsList;
}> = ({ control, index, remove, masterTools }) => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [isOpen, setIsOpen] = useState(true);
    
    const departmentValue = useWatch({ control, name: `tools.${index}.department` });
    const toolNameValue = useWatch({ control, name: `tools.${index}.name` });
    
    const toolOptions: MasterTool[] = departmentValue ? masterTools[departmentValue] || [] : [];
    const accordionTitle = toolNameValue || "New Tool";
    const accordionSubtitle = departmentValue || "Select a department";

    return (
        <div className={isMobile ? "border border-[#134426] rounded-2xl bg-[#092c19] overflow-hidden shadow-sm" : "border border-border rounded-xl bg-card"}>
            <div className="flex items-center p-3.5">
                <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 flex-grow text-left">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isMobile ? 'bg-[#041b0f] text-[#44D62C] border border-[#134426]' : 'text-muted'}`}>
                        <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className={`font-bold text-sm truncate block ${isMobile ? 'text-white' : 'text-primary-text'}`}>{accordionTitle}</span>
                        <p className={`text-xs truncate ${isMobile ? 'text-white/50' : 'text-muted'}`}>{accordionSubtitle}</p>
                    </div>
                </button>
                <div className="flex items-center gap-1">
                    <button 
                        type="button" 
                        onClick={() => remove(index)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        aria-label="Remove tool"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1.5 rounded-lg text-white/60 hover:text-white transition-colors"
                        aria-label="Toggle accordion"
                    >
                        <ChevronDown className={`h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {isOpen && (
                <div className={`p-4 border-t space-y-4 animate-fade-in-down ${isMobile ? 'border-[#134426] bg-[#041b0f]/60' : 'border-border'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Controller name={`tools.${index}.department`} control={control} render={({ field }) => (
                            <Select label="Department" {...field}>
                                <option value="">Select Department</option>
                                {Object.keys(masterTools).map(dept => <option key={dept} value={dept}>{dept}</option>)}
                            </Select>
                        )} />
                        <Controller name={`tools.${index}.name`} control={control} render={({ field }) => (
                            <Select label="Tool Name" {...field} disabled={!departmentValue}>
                                <option value="">Select Tool</option>
                                {toolOptions.map(tool => <option key={tool.id} value={tool.name}>{tool.name}</option>)}
                            </Select>
                        )} />
                        <Controller name={`tools.${index}.quantity`} control={control} render={({ field }) => <Input label="Quantity" type="number" {...field} />} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Controller name={`tools.${index}.picture`} control={control} render={({ field }) => <UploadDocument label="Picture of Tool" file={field.value} onFileChange={field.onChange} />} />
                        <Controller name={`tools.${index}.inwardDcCopy`} control={control} render={({ field }) => <UploadDocument label="Inward DC Copy" file={field.value} onFileChange={field.onChange} />} />
                        <Controller name={`tools.${index}.deliveryCopy`} control={control} render={({ field }) => <UploadDocument label="Delivery Copy" file={field.value} onFileChange={field.onChange} />} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
                        <Controller name={`tools.${index}.invoiceCopy`} control={control} render={({ field }) => <UploadDocument label="Invoice" file={field.value} onFileChange={field.onChange} />} />
                        <Controller name={`tools.${index}.signedReceipt`} control={control} render={({ field }) => <UploadDocument label="Signed Receipt" file={field.value} onFileChange={field.onChange} />} />
                        <Controller name={`tools.${index}.receiverName`} control={control} render={({ field }) => <Input label="Receiver's Name" {...field} />} />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Views ---

const ToolDetailView: React.FC<{
    site: Organization;
    initialTools: IssuedTool[];
    masterTools: MasterToolsList;
    onSave: (siteId: string, tools: IssuedTool[]) => Promise<void>;
    onBack: () => void;
}> = ({ site, initialTools, masterTools, onSave, onBack }) => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [isSaving, setIsSaving] = useState(false);
    const { control, handleSubmit, reset } = useForm<{ tools: IssuedTool[] }>();
    const { fields, append, remove } = useFieldArray({ control, name: "tools" });
    
    useEffect(() => {
        reset({ tools: initialTools });
    }, [initialTools, reset]);

    const handleAddTool = () => {
        append({ id: `new_tool_${Date.now()}`, department: '', name: '', quantity: 1 });
    };

    const handleSaveSubmit = async (data: { tools: IssuedTool[] }) => {
        setIsSaving(true);
        try {
            await onSave(site.id, data.tools);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleSaveSubmit)} className={isMobile ? "space-y-4" : ""}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
                <div>
                    <button 
                        type="button" 
                        onClick={onBack} 
                        className={isMobile 
                            ? "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer mb-3"
                            : "btn btn-outline btn-sm mb-2"
                        }
                    >
                        <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Back to List</span>
                    </button>
                    <h3 className={`font-black tracking-tight ${isMobile ? 'text-lg text-white' : 'text-xl text-primary-text'}`}>
                        Managing Tools for: {site.shortName}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {isMobile ? (
                        <>
                            <button
                                type="button"
                                onClick={handleAddTool}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl border border-[#134426] bg-[#041b0f] text-[#44D62C] hover:bg-[#134426] text-xs font-black active:scale-95 transition-all cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add Tool</span>
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 stroke-[2.5]" />}
                                <span>Save</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <Button type="button" onClick={handleAddTool}><Plus className="mr-2 h-4 w-4" /> Add Tool</Button>
                            <Button type="submit" isLoading={isSaving}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                        </>
                    )}
                </div>
            </div>
            <div className="space-y-3">
                {fields.length > 0 ? (
                    fields.map((field, index) => <ToolAccordionItem key={field.id} control={control} index={index} remove={remove} masterTools={masterTools} />)
                ) : (
                    <div className={`text-center p-8 rounded-2xl ${isMobile ? 'text-white/50 bg-[#092c19] border border-[#134426] text-xs' : 'text-muted bg-page'}`}>
                        No tools found for this site. Click "Add Tool" to begin.
                    </div>
                )}
            </div>
        </form>
    );
};

const ToolListView: React.FC<{
    sites: Organization[];
    allIssuedTools: Record<string, IssuedTool[]>;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onViewDetails: (siteId: string) => void;
}> = ({ sites, allIssuedTools, searchTerm, setSearchTerm, onViewDetails }) => {
    const isMobile = useMediaQuery('(max-width: 767px)');

    const generateToolSummary = (tools: IssuedTool[] = []): string => {
        if (!tools || tools.length === 0) return 'No tools issued.';
        const totalQuantity = tools.reduce((sum, tool) => sum + (tool.quantity || 0), 0);
        const departmentCount = new Set(tools.map(t => t.department)).size;
        return `${totalQuantity} tools issued across ${departmentCount} department${departmentCount > 1 ? 's' : ''}.`;
    };

    return (
        <div className={isMobile ? "space-y-4" : ""}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                <h3 className={`font-black tracking-tight ${isMobile ? 'text-lg text-white' : 'text-xl font-semibold text-primary-text'}`}>
                    Site Tools Overview
                </h3>
                <div className="relative flex-1 md:max-w-xs">
                    <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isMobile ? 'text-[#44D62C]/70' : 'text-muted'}`} />
                    <input 
                        id="site-search" 
                        placeholder="Search sites..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className={isMobile 
                            ? "w-full bg-[#041b0f] border border-[#134426] rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-white/40 focus:outline-none focus:border-[#44D62C] transition-all shadow-sm"
                            : "form-input pl-10 w-full"
                        }
                    />
                </div>
            </div>

            {isMobile ? (
                <div className="space-y-2.5">
                    {sites.map(site => {
                        const hasTools = allIssuedTools[site.id]?.length > 0;
                        return (
                            <div 
                                key={site.id}
                                onClick={() => onViewDetails(site.id)}
                                className="p-3.5 rounded-2xl bg-[#092c19] border border-[#134426] flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:border-[#44D62C]/40"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-white truncate mb-1">
                                        {site.shortName}
                                    </h4>
                                    <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                        hasTools 
                                            ? 'bg-[#44D62C]/10 text-[#44D62C] border-[#44D62C]/30' 
                                            : 'bg-[#041b0f] text-white/45 border-[#134426]'
                                    }`}>
                                        {generateToolSummary(allIssuedTools[site.id])}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onViewDetails(site.id); }}
                                    className="w-9 h-9 rounded-xl bg-[#041b0f] border border-[#134426] text-[#44D62C] flex items-center justify-center hover:bg-[#134426] active:scale-90 transition-all flex-shrink-0 shadow-sm cursor-pointer"
                                    aria-label="View Details"
                                    title="View Details"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                    {sites.length === 0 && (
                        <div className="text-center p-8 rounded-2xl bg-[#092c19] border border-[#134426] text-white/50 text-xs">
                            No sites match your search.
                        </div>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-page">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted">Site Name</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Tools Summary</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sites.map(site => (
                                <tr key={site.id}>
                                    <td className="px-4 py-3 font-medium">{site.shortName}</td>
                                    <td className="px-4 py-3 text-muted">{generateToolSummary(allIssuedTools[site.id])}</td>
                                    <td className="px-4 py-3">
                                        <Button variant="icon" size="sm" onClick={() => onViewDetails(site.id)} title="View Details">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sites.length === 0 && <p className="text-center p-8 text-muted">No sites match your search.</p>}
                </div>
            )}
        </div>
    );
};

const ToolsListConfig: React.FC = () => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [viewingSiteId, setViewingSiteId] = useState<string | null>(null);
    const [allSites, setAllSites] = useState<Organization[]>([]);
    const [allIssuedTools, setAllIssuedTools] = useState<Record<string, IssuedTool[]>>({});
    const [masterTools, setMasterTools] = useState<MasterToolsList>({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        setIsLoading(true);
        Promise.all([api.getOrganizations(), api.getAllSiteIssuedTools(), api.getToolsList()])
            .then(([sitesData, issuedToolsData, masterToolsData]) => {
                setAllSites(sitesData.sort((a,b) => a.shortName.localeCompare(b.shortName)));
                setAllIssuedTools(issuedToolsData);
                setMasterTools(masterToolsData);
            })
            .catch(() => setToast({ message: 'Failed to load initial configuration.', type: 'error' }))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async (siteId: string, tools: IssuedTool[]) => {
        try {
            await api.updateSiteIssuedTools(siteId, tools);
            setAllIssuedTools(prev => ({ ...prev, [siteId]: tools }));
            setToast({ message: 'Tools list saved successfully.', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to save tools list.', type: 'error' });
            throw error;
        }
    };
    
    const filteredSites = useMemo(() => {
        if (!searchTerm) return allSites;
        return allSites.filter(site => site.shortName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allSites, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#44D62C]" />
            </div>
        );
    }
    
    return (
        <div className={isMobile ? "text-white" : ""}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {viewingSiteId ? (
                <ToolDetailView 
                    site={allSites.find(s => s.id === viewingSiteId)!}
                    initialTools={allIssuedTools[viewingSiteId] || []}
                    masterTools={masterTools}
                    onSave={handleSave}
                    onBack={() => setViewingSiteId(null)}
                />
            ) : (
                <ToolListView
                    sites={filteredSites}
                    allIssuedTools={allIssuedTools}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    onViewDetails={setViewingSiteId}
                />
            )}
        </div>
    );
};

export default ToolsListConfig;
