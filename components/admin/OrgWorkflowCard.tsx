import React, { useState, useEffect } from 'react';
import { Search, ZoomIn, ZoomOut, Maximize2, Minimize2, Info } from 'lucide-react';
import WorkflowChart2D from './WorkflowChart2D';
import type { User } from '../../types';

interface OrgWorkflowCardProps {
    users: (User & { managerName?: string })[];
}

const OrgWorkflowCard: React.FC<OrgWorkflowCardProps> = ({ users }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [zoom, setZoom] = useState<number | null>(null); // null = use auto-fit
    const [showLegend, setShowLegend] = useState(true);

    const handleReset = () => {
        setSearchQuery('');
        setZoom(null); // null triggers auto-fit in chart
        // After a brief moment, read the auto-calculated zoom
        setTimeout(() => {
            // Chart will auto-fit, we'll leave zoom as null so it keeps using internal calculation
        }, 100);
    };

    const handleZoomIn = () => setZoom(prev => Math.min((prev ?? 80) + 10, 250));
    const handleZoomOut = () => setZoom(prev => Math.max((prev ?? 80) - 10, 40));

    const chartContent = (
        <div className={`flex flex-col ${isFullscreen ? 'h-screen' : 'h-[75vh] min-h-[500px]'}`}>
            {/* Toolbar */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-shrink-0 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        <button
                            onClick={handleZoomOut}
                            className="p-1.5 hover:bg-slate-200/60 rounded-md transition-colors text-slate-600 hover:text-slate-900"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>

                        <input
                            type="range"
                            min="40"
                            max="250"
                            value={zoom ?? 80}
                            disabled={zoom === null}
                            onChange={(e) => setZoom(parseInt(e.target.value))}
                            className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                        />

                        <span className="text-xs font-semibold text-slate-700 min-w-[45px] text-center">{zoom ? `${zoom}%` : 'Auto'}</span>

                        <button
                            onClick={handleZoomIn}
                            className="p-1.5 hover:bg-slate-200/60 rounded-md transition-colors text-slate-600 hover:text-slate-900"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Maximize2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Reset</span>
                        </button>

                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full Screen'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="flex-1 bg-slate-50 relative overflow-hidden">
                <WorkflowChart2D
                    users={users}
                    externalSearchQuery={searchQuery}
                    externalZoom={zoom !== null ? zoom / 100 : undefined}
                    showControls={false}
                />

                {/* Legend */}
                <div className={`absolute bottom-4 right-4 z-20 ${showLegend ? 'block' : 'hidden'} md:block`}>
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-4 py-3 min-w-[200px]">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                                Legend
                            </h4>
                            <button
                                onClick={() => setShowLegend(!showLegend)}
                                className="md:hidden text-slate-400 hover:text-slate-600"
                            >
                                <Info className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-500 to-indigo-600 border border-white shadow-sm flex-shrink-0" />
                                <span>Team Member</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-4 h-4 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 border border-white shadow-sm flex-shrink-0" />
                                <span>Search Match</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-6 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-500 flex-shrink-0 shadow-sm" />
                                <span>Reports To</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">L2</div>
                                <span>Level Badge</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Legend Toggle */}
                <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="md:hidden absolute bottom-4 right-4 z-30 bg-white border border-slate-200 rounded-full p-2 shadow-lg"
                >
                    <Info className="w-5 h-5 text-slate-600" />
                </button>
            </div>

            {/* Results Counter */}
            {searchQuery && (
                <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-2">
                    <p className="text-xs text-slate-600">
                        {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length} results found
                    </p>
                </div>
            )}
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {chartContent}
        </div>
    );
};

export default OrgWorkflowCard;
