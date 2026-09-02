import React, { useState } from 'react';
import { 
    Search, 
    ZoomIn, 
    ZoomOut, 
    Maximize2, 
    Minimize2, 
    Info, 
    Network, 
    Users, 
    Sparkles, 
    AlertTriangle 
} from 'lucide-react';
import WorkflowChart2D from './WorkflowChart2D';
import WorkflowManagerGrid from './WorkflowManagerGrid';
import WorkflowPathTrace from './WorkflowPathTrace';
import type { User, Role } from '../../types';

interface OrgWorkflowCardProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles?: Role[];
    finalConfirmationRole?: string;
    onManagerChange?: (userId: string, managerId: string, slot?: 1 | 2 | 3) => void;
    onSave?: () => void;
}

type SubView = 'tree' | 'teams' | 'simulator';

const OrgWorkflowCard: React.FC<OrgWorkflowCardProps> = ({ 
    users, 
    allRoles = [], 
    finalConfirmationRole = 'hr',
    onManagerChange,
    onSave
}) => {
    const [subView, setSubView] = useState<SubView>('tree');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [zoom, setZoom] = useState<number | null>(null);
    const [showLegend, setShowLegend] = useState(true);
    const [selectedTraceUserId, setSelectedTraceUserId] = useState<string | null>(null);

    const handleReset = () => {
        setSearchQuery('');
        setZoom(null);
    };

    const handleZoomIn = () => setZoom(prev => Math.min((prev ?? 85) + 10, 200));
    const handleZoomOut = () => setZoom(prev => Math.max((prev ?? 85) - 10, 35));

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

                    {/* Right Tools (Search, Zoom, Fullscreen) */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Search */}
                        <div className="relative w-full sm:w-52">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>

                        {/* Zoom Controls (Active in Tree view) */}
                        {subView === 'tree' && (
                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-0.5 border border-slate-200">
                                <button
                                    onClick={handleZoomOut}
                                    className="p-1 hover:bg-slate-200/60 rounded text-slate-600 hover:text-slate-900"
                                    title="Zoom Out"
                                >
                                    <ZoomOut className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[11px] font-bold text-slate-700 min-w-[32px] text-center">
                                    {zoom ? `${zoom}%` : 'Auto'}
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    className="p-1 hover:bg-slate-200/60 rounded text-slate-600 hover:text-slate-900"
                                    title="Zoom In"
                                >
                                    <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleReset}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                            title="Reset filters and view"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Fit
                        </button>

                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-1"
                        >
                            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            {isFullscreen ? 'Exit' : 'Full Screen'}
                        </button>
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
                            externalSearchQuery={searchQuery}
                            externalZoom={zoom !== null ? zoom / 100 : undefined}
                            showControls={true}
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
        return (
            <div className="fixed inset-0 z-50 bg-white">
                {chartContent}
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex-1 h-full min-h-0 flex flex-col">
            {chartContent}
        </div>
    );
};

export default OrgWorkflowCard;
