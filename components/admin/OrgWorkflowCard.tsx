import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Search, 
    Minimize2, 
    Info, 
    Network, 
    Users, 
    Sparkles, 
    AlertTriangle,
    X
} from 'lucide-react';
import WorkflowChart2D from './WorkflowChart2D';
import WorkflowManagerGrid from './WorkflowManagerGrid';
import WorkflowPathTrace from './WorkflowPathTrace';
import type { User, Role, Organization } from '../../types';

interface OrgWorkflowCardProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles?: Role[];
    organizations?: Organization[];
    finalConfirmationRole?: string;
    onManagerChange?: (userId: string, managerId: string, slot?: 1 | 2 | 3) => void;
    onSave?: () => void;
    onRefresh?: () => void;
}

type SubView = 'tree' | 'teams' | 'simulator';

const OrgWorkflowCard: React.FC<OrgWorkflowCardProps> = ({ 
    users, 
    allRoles = [], 
    organizations = [],
    finalConfirmationRole = 'hr',
    onManagerChange,
    onSave,
    onRefresh
}) => {
    const [subView, setSubView] = useState<SubView>('tree');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [selectedTraceUserId, setSelectedTraceUserId] = useState<string | null>(null);
    const wasNativeFullscreenRef = useRef(false);

    const handleToggleFullscreen = () => {
        if (!isFullscreen) {
            setIsFullscreen(true);
            try {
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen()
                        .then(() => { wasNativeFullscreenRef.current = true; })
                        .catch(() => { wasNativeFullscreenRef.current = false; });
                }
            } catch {
                wasNativeFullscreenRef.current = false;
            }
        } else {
            setIsFullscreen(false);
            try {
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {
                        // Native exit rejection ignored
                    });
                }
            } catch {
                // Native exit failure ignored
            }
            wasNativeFullscreenRef.current = false;
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {
                        // Escape exit rejection ignored
                    });
                }
                wasNativeFullscreenRef.current = false;
            }
        };
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && isFullscreen && wasNativeFullscreenRef.current) {
                setIsFullscreen(false);
                wasNativeFullscreenRef.current = false;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [isFullscreen]);

    const unassignedCount = users.filter(u => !u.reportingManagerId).length;

    const handleSelectForTrace = (userId: string) => {
        setSelectedTraceUserId(userId);
        setSubView('simulator');
    };

    const chartContent = (
        <div className={`flex flex-col flex-1 h-full min-h-0 w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
            {/* COMPACT SINGLE-ROW SUBVIEW TOOLBAR */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3.5 py-2">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                    {/* View Modes & Unassigned Pill */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => setSubView('tree')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                    subView === 'tree'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Network className="w-3.5 h-3.5 text-emerald-600" />
                                Org Tree
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubView('teams')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                    subView === 'teams'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5 text-amber-600" />
                                Manager Teams
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubView('simulator')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                    subView === 'simulator'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                Approval Simulator
                            </button>
                        </div>

                        {/* Unassigned Quick Jump Pill */}
                        {unassignedCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setSubView('teams')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                                title="Click to view and assign unassigned employees"
                            >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>{unassignedCount} Needs Mgr</span>
                            </button>
                        )}
                    </div>

                    {/* Right Tools (Search across views) */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="relative w-full sm:w-60">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Full Available Height */}
            <div className="flex-1 min-h-0 bg-slate-50 relative overflow-hidden flex flex-col">
                {subView === 'tree' && (
                    <div className="w-full h-full flex-1 min-h-0 relative flex flex-col">
                        <WorkflowChart2D
                            users={users}
                            allRoles={allRoles}
                            organizations={organizations}
                            externalSearchQuery={searchQuery}
                            showControls={true}
                            isFullscreen={isFullscreen}
                            onToggleFullscreen={handleToggleFullscreen}
                            onSelectEmployeeForTrace={handleSelectForTrace}
                            onManagerChange={onManagerChange}
                            onRefresh={onRefresh}
                        />

                        {/* Floating Visual Legend */}
                        <div className={`absolute bottom-3 left-3 z-20 ${showLegend ? 'block' : 'hidden'} md:block`}>
                            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-md px-3 py-2 min-w-[200px]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                        Role Legend
                                    </h5>
                                    <button
                                        onClick={() => setShowLegend(false)}
                                        className="md:hidden text-slate-400 hover:text-slate-600"
                                    >
                                        <Info className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-600" />
                                        <span>Executive</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <span>Site Manager</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                                        <span>HR & People</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-teal-600" />
                                        <span>Technical</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-sky-500" />
                                        <span>Field Staff</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                                        <span className="font-semibold text-amber-700">Needs Mgr</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {subView === 'teams' && (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 h-full min-h-0">
                        <WorkflowManagerGrid
                            users={users}
                            allRoles={allRoles}
                            onManagerChange={onManagerChange}
                            onSave={onSave}
                        />
                    </div>
                )}

                {subView === 'simulator' && (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 h-full min-h-0">
                        <WorkflowPathTrace
                            users={users}
                            allRoles={allRoles}
                            finalConfirmationRole={finalConfirmationRole}
                            initialSelectedUserId={selectedTraceUserId || undefined}
                            onManagerChange={onManagerChange}
                            onSave={onSave}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    if (isFullscreen) {
        return createPortal(
            <div className="fixed inset-0 z-[999999] w-screen h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
                {/* DEDICATED FULL DISPLAY TOP BAR */}
                <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 shadow-xs">
                    {/* Left: Exit Full Display button + Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                            title="Exit Full Display (Esc)"
                        >
                            <Minimize2 className="w-4 h-4 text-emerald-400" />
                            <span>Exit Full Display</span>
                            <kbd className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">Esc</kbd>
                        </button>

                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                                <Network className="w-4 h-4 text-emerald-600" />
                                2D Workflow Chart
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hidden md:inline-flex items-center gap-1">
                                Full Display Only View
                            </span>
                        </div>
                    </div>

                    {/* Search inside Full Screen */}
                    <div className="relative w-52 sm:w-72">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employees in tree..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Right: Close button */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 hidden lg:inline">
                            {users.length} Total Staff
                        </span>
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Close Full Display (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* FULL DISPLAY TREE WORKSPACE */}
                <div className="w-full h-full flex-1 min-h-0 relative flex flex-col">
                    <WorkflowChart2D
                        users={users}
                        allRoles={allRoles}
                        organizations={organizations}
                        externalSearchQuery={searchQuery}
                        showControls={true}
                        isFullscreen={true}
                        onToggleFullscreen={handleToggleFullscreen}
                        onSelectEmployeeForTrace={handleSelectForTrace}
                        onManagerChange={onManagerChange}
                    />

                    {/* Floating Visual Legend */}
                    <div className={`absolute bottom-3 left-3 z-20 ${showLegend ? 'block' : 'hidden'} md:block`}>
                        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-md px-3 py-2 min-w-[200px]">
                            <div className="flex items-center justify-between mb-1.5">
                                <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                    Role Legend
                                </h5>
                                <button
                                    onClick={() => setShowLegend(false)}
                                    className="md:hidden text-slate-400 hover:text-slate-600"
                                >
                                    <Info className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                                    <span>Executive</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span>Site Manager</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                                    <span>HR & People</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                                    <span>Technical</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-sky-500" />
                                    <span>Field Staff</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="font-semibold text-amber-700">Needs Mgr</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Shortcut Hint */}
                    <div className="absolute bottom-3 right-3 z-20 hidden lg:block bg-white/90 backdrop-blur-sm border border-slate-200 text-[10px] text-slate-600 px-3 py-1.5 rounded-xl shadow-xs pointer-events-none">
                        💡 Drag canvas to pan • Scroll to zoom • Click manager to focus team • Press ESC to exit
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex-1 h-full min-h-0 flex flex-col">
            {chartContent}
        </div>
    );
};

export default OrgWorkflowCard;
