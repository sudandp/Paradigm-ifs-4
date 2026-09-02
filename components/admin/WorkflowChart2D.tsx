import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { User, Role } from '../../types';
import { 
    Maximize2, 
    ChevronDown, 
    ChevronRight, 
    Mail, 
    Phone, 
    Building2, 
    Sparkles, 
    X, 
    Layers 
} from 'lucide-react';

export interface WorkflowNode extends User {
    managerName?: string;
    manager2Name?: string;
    manager3Name?: string;
    children?: WorkflowNode[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    level?: number;
    isLeaf?: boolean;
    totalDescendants?: number;
}

interface WorkflowChart2DProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles?: Role[];
    externalSearchQuery?: string;
    externalZoom?: number;
    showControls?: boolean;
    onSelectEmployeeForTrace?: (userId: string) => void;
    onManagerChange?: (userId: string, managerId: string, slot: 1 | 2 | 3) => void;
}

// Role color scheme (strictly compliant with no-purple rule)
const getRoleTheme = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('management') || r.includes('director') || r.includes('president')) {
        return {
            border: 'border-emerald-300',
            bg: 'bg-emerald-50/50',
            accent: 'bg-emerald-600',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            avatarBg: 'bg-emerald-600 text-white',
            label: 'Executive'
        };
    }
    if (r.includes('site_manager') || r.includes('manager') || r.includes('operation') || r.includes('supervisor')) {
        return {
            border: 'border-amber-300',
            bg: 'bg-amber-50/50',
            accent: 'bg-amber-500',
            badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
            avatarBg: 'bg-amber-600 text-white',
            label: 'Management'
        };
    }
    if (r.includes('hr') || r.includes('recruitment') || r.includes('people')) {
        return {
            border: 'border-blue-300',
            bg: 'bg-blue-50/50',
            accent: 'bg-blue-500',
            badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
            avatarBg: 'bg-blue-600 text-white',
            label: 'HR & People'
        };
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('technician') || r.includes('security') || r.includes('hk') || r.includes('maintenance')) {
        return {
            border: 'border-teal-300',
            bg: 'bg-teal-50/50',
            accent: 'bg-teal-500',
            badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
            avatarBg: 'bg-teal-600 text-white',
            label: 'Technical / Ops'
        };
    }
    if (r.includes('field') || r.includes('staff') || r.includes('assistant')) {
        return {
            border: 'border-sky-300',
            bg: 'bg-sky-50/50',
            accent: 'bg-sky-500',
            badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
            avatarBg: 'bg-sky-600 text-white',
            label: 'Field Staff'
        };
    }
    if (r.includes('finance') || r.includes('account')) {
        return {
            border: 'border-emerald-300',
            bg: 'bg-emerald-50/50',
            accent: 'bg-emerald-500',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            avatarBg: 'bg-emerald-700 text-white',
            label: 'Finance'
        };
    }
    return {
        border: 'border-slate-300',
        bg: 'bg-slate-50/50',
        accent: 'bg-slate-400',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        avatarBg: 'bg-slate-600 text-white',
        label: 'Staff'
    };
};

const CARD_WIDTH = 224;
const CARD_HEIGHT = 80;
const HORIZONTAL_GAP = 28;
const VERTICAL_GAP = 60;
const LEAF_COLS = 2; // Compact 2-3 column layout for leaves

export const WorkflowChart2D: React.FC<WorkflowChart2DProps> = ({
    users,
    allRoles = [],
    externalSearchQuery,
    externalZoom,
    showControls = true,
    onSelectEmployeeForTrace
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartAreaRef = useRef<HTMLDivElement | null>(null);

    const [selectedBranchRoot, setSelectedBranchRoot] = useState<string>('all');
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [zoom, setZoom] = useState<number>(0.9);
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);

    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : '';

    const getRoleDisplayName = useCallback((roleId: string = '') => {
        const found = allRoles.find(r => r.id === roleId || r.id.toLowerCase() === roleId.toLowerCase());
        if (found?.displayName) return found.displayName;
        return roleId ? roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Staff';
    }, [allRoles]);

    // Build hierarchy
    const { roots, topBranches } = useMemo(() => {
        const map = new Map<string, WorkflowNode>();
        users.forEach(user => {
            map.set(user.id, { ...user, children: [] });
        });

        const rootList: WorkflowNode[] = [];
        const hasParent = new Set<string>();

        users.forEach(user => {
            const node = map.get(user.id)!;
            if (user.reportingManagerId && map.has(user.reportingManagerId) && user.reportingManagerId !== user.id) {
                const parent = map.get(user.reportingManagerId)!;
                parent.children!.push(node);
                hasParent.add(user.id);
            }
        });

        users.forEach(user => {
            if (!hasParent.has(user.id)) {
                rootList.push(map.get(user.id)!);
            }
        });

        // Compute total descendants
        const countDescendants = (node: WorkflowNode): number => {
            if (!node.children || node.children.length === 0) {
                node.totalDescendants = 0;
                node.isLeaf = true;
                return 0;
            }
            let total = node.children.length;
            node.children.forEach(child => {
                total += countDescendants(child);
            });
            node.totalDescendants = total;
            node.isLeaf = false;
            return total;
        };

        rootList.forEach(r => countDescendants(r));

        // Identify major top branches (roots with teams)
        const branches = rootList.map(r => ({
            id: r.id,
            name: r.name,
            role: r.role,
            totalMembers: (r.totalDescendants || 0) + 1
        })).sort((a, b) => b.totalMembers - a.totalMembers);

        return { roots: rootList, topBranches: branches };
    }, [users]);

    // Filter roots if a specific branch is selected
    const activeRoots = useMemo(() => {
        if (selectedBranchRoot === 'all') return roots;
        const selected = roots.find(r => r.id === selectedBranchRoot);
        return selected ? [selected] : roots;
    }, [roots, selectedBranchRoot]);

    // Smart Compact Layout Calculation
    const { layoutNodes, layoutConnectors, bounds } = useMemo(() => {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        const nodes: WorkflowNode[] = [];
        const connectors: { id: string; parent: WorkflowNode; child: WorkflowNode }[] = [];

        const layoutSubtree = (node: WorkflowNode, x: number, y: number, level: number): { width: number; height: number } => {
            node.level = level;
            node.width = CARD_WIDTH;
            node.height = CARD_HEIGHT;

            const isCollapsed = collapsedNodes.has(node.id);
            const hasChildren = node.children && node.children.length > 0 && !isCollapsed;

            if (!hasChildren) {
                node.x = x;
                node.y = y;
                nodes.push(node);

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + CARD_WIDTH);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + CARD_HEIGHT);

                return { width: CARD_WIDTH, height: CARD_HEIGHT };
            }

            const children = node.children!;
            const branchChildren = children.filter(c => c.children && c.children.length > 0);
            const leafChildren = children.filter(c => !c.children || c.children.length === 0);

            const branchLayouts: { node: WorkflowNode; width: number; height: number }[] = [];
            let currentBranchX = x;
            let childrenMaxHeight = 0;

            // 1. Layout Branch Children Recursively
            branchChildren.forEach(child => {
                const bLayout = layoutSubtree(child, currentBranchX, y + CARD_HEIGHT + VERTICAL_GAP, level + 1);
                branchLayouts.push({ node: child, width: bLayout.width, height: bLayout.height });
                currentBranchX += bLayout.width + HORIZONTAL_GAP;
                childrenMaxHeight = Math.max(childrenMaxHeight, bLayout.height);

                connectors.push({
                    id: `${node.id}->${child.id}`,
                    parent: node,
                    child: child
                });
            });

            const branchSectionWidth = branchLayouts.length > 0 
                ? branchLayouts.reduce((acc, b) => acc + b.width + HORIZONTAL_GAP, 0) - HORIZONTAL_GAP 
                : 0;

            // 2. Layout Leaf Children in a Compact 2-3 Column Matrix
            let leafSectionWidth = 0;
            let leafSectionHeight = 0;
            if (leafChildren.length > 0) {
                const cols = Math.min(LEAF_COLS, leafChildren.length);
                const rows = Math.ceil(leafChildren.length / cols);
                leafSectionWidth = cols * CARD_WIDTH + (cols - 1) * (HORIZONTAL_GAP / 2);
                leafSectionHeight = rows * CARD_HEIGHT + (rows - 1) * 16;

                const leafStartX = branchSectionWidth > 0 ? currentBranchX : x;
                const leafStartY = y + CARD_HEIGHT + VERTICAL_GAP;

                leafChildren.forEach((leaf, idx) => {
                    const colIdx = idx % cols;
                    const rowIdx = Math.floor(idx / cols);

                    const lx = leafStartX + colIdx * (CARD_WIDTH + HORIZONTAL_GAP / 2);
                    const ly = leafStartY + rowIdx * (CARD_HEIGHT + 16);

                    leaf.x = lx;
                    leaf.y = ly;
                    leaf.level = level + 1;
                    leaf.width = CARD_WIDTH;
                    leaf.height = CARD_HEIGHT;

                    nodes.push(leaf);

                    connectors.push({
                        id: `${node.id}->${leaf.id}`,
                        parent: node,
                        child: leaf
                    });

                    minX = Math.min(minX, lx);
                    maxX = Math.max(maxX, lx + CARD_WIDTH);
                    minY = Math.min(minY, ly);
                    maxY = Math.max(maxY, ly + CARD_HEIGHT);
                });

                childrenMaxHeight = Math.max(childrenMaxHeight, leafSectionHeight);
            }

            const childrenTotalWidth = branchSectionWidth > 0 && leafSectionWidth > 0
                ? branchSectionWidth + HORIZONTAL_GAP + leafSectionWidth
                : Math.max(branchSectionWidth, leafSectionWidth);

            const totalWidth = Math.max(CARD_WIDTH, childrenTotalWidth);
            const parentX = x + (totalWidth / 2) - (CARD_WIDTH / 2);
            node.x = parentX;
            node.y = y;
            nodes.push(node);

            minX = Math.min(minX, parentX);
            maxX = Math.max(maxX, parentX + CARD_WIDTH);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + CARD_HEIGHT);

            return {
                width: totalWidth,
                height: CARD_HEIGHT + VERTICAL_GAP + childrenMaxHeight
            };
        };

        // Multi-Root Layout: Arrange roots in a clean wrapped 2-column layout if viewing all
        const startX = 60;
        const startY = 60;

        if (activeRoots.length > 2 && selectedBranchRoot === 'all') {
            // Group roots in pairs to avoid infinite horizontal spread
            let rowY = startY;
            for (let i = 0; i < activeRoots.length; i += 2) {
                const r1 = activeRoots[i];
                const r2 = activeRoots[i + 1];

                const l1 = layoutSubtree(r1, startX, rowY, 0);
                let maxHeight = l1.height;

                if (r2) {
                    const l2 = layoutSubtree(r2, startX + l1.width + HORIZONTAL_GAP * 2, rowY, 0);
                    maxHeight = Math.max(maxHeight, l2.height);
                }

                rowY += maxHeight + VERTICAL_GAP * 1.5;
            }
        } else {
            let curX = startX;
            activeRoots.forEach(root => {
                const l = layoutSubtree(root, curX, startY, 0);
                curX += l.width + HORIZONTAL_GAP * 2;
            });
        }

        const b = {
            minX: isFinite(minX) ? minX : 0,
            maxX: isFinite(maxX) ? maxX : 1200,
            minY: isFinite(minY) ? minY : 0,
            maxY: isFinite(maxY) ? maxY : 800,
            width: isFinite(maxX - minX) ? Math.max(800, maxX - minX + 160) : 1200,
            height: isFinite(maxY - minY) ? Math.max(600, maxY - minY + 160) : 800
        };

        return { layoutNodes: nodes, layoutConnectors: connectors, bounds: b };
    }, [activeRoots, collapsedNodes, selectedBranchRoot]);

    // Auto-fit function
    const autoFit = useCallback((targetZoom?: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        const contentW = bounds.width;
        const contentH = bounds.height;

        const zoomX = (rect.width - 60) / contentW;
        const zoomY = (rect.height - 60) / contentH;
        let newZoom = Math.min(zoomX, zoomY);
        newZoom = Math.max(0.45, Math.min(newZoom, 1.05));

        const finalZoom = targetZoom !== undefined ? targetZoom : (externalZoom !== undefined ? externalZoom : newZoom);

        const newOffsetX = (rect.width - contentW * finalZoom) / 2;
        const newOffsetY = Math.max(20, (rect.height - contentH * finalZoom) / 2);

        setZoom(finalZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    }, [bounds, externalZoom]);

    // Run auto-fit on load and when branch changes
    useEffect(() => {
        const timer = setTimeout(() => autoFit(), 100);
        return () => clearTimeout(timer);
    }, [selectedBranchRoot, autoFit]);

    // Search and Auto-Focus
    useEffect(() => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.toLowerCase().trim();
        const matched = layoutNodes.find(n => 
            (n.name || '').toLowerCase().includes(q) || 
            (n.role || '').toLowerCase().includes(q)
        );

        if (matched && matched.x !== undefined && matched.y !== undefined && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Center around matched card
            const targetX = rect.width / 2 - (matched.x + CARD_WIDTH / 2) * zoom;
            const targetY = rect.height / 2 - (matched.y + CARD_HEIGHT / 2) * zoom;
            setOffset({ x: targetX, y: targetY });
            setSelectedNode(matched);
        }
    }, [searchQuery, layoutNodes, zoom]);

    // Pan Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.org-card-button') || (e.target as HTMLElement).closest('.org-card')) {
            return;
        }
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        hasDraggedRef.current = true;
        setOffset({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.08 : 0.92;
        const newZoom = Math.max(0.35, Math.min(zoom * factor, 1.8));

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - (mouseX - offset.x) * (newZoom / zoom);
        const newOffsetY = mouseY - (mouseY - offset.y) * (newZoom / zoom);

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const toggleNodeCollapse = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        setCollapsedNodes(new Set());
        setTimeout(() => autoFit(), 100);
    };

    const handleCollapseToManagers = () => {
        const toCollapse = new Set<string>();
        layoutNodes.forEach(n => {
            if (n.children && n.children.length > 0) {
                const hasManagerKids = n.children.some(c => c.children && c.children.length > 0);
                if (!hasManagerKids) {
                    toCollapse.add(n.id);
                }
            }
        });
        setCollapsedNodes(toCollapse);
        setTimeout(() => autoFit(), 100);
    };

    return (
        <div className="relative w-full h-full flex-1 min-h-0 bg-slate-50 select-none overflow-hidden flex flex-col" ref={containerRef}>
            {/* Top Branch Selector & Action Bar */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 z-10 shadow-xs">
                {/* Branch Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[70vw] py-0.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-primary" /> Branch:
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedBranchRoot('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                            selectedBranchRoot === 'all'
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        🌐 All Organization ({users.length})
                    </button>
                    {topBranches.slice(0, 6).map(branch => (
                        <button
                            key={branch.id}
                            type="button"
                            onClick={() => setSelectedBranchRoot(branch.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                                selectedBranchRoot === branch.id
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            <span>{branch.name}</span>
                            <span className="text-[10px] opacity-80 font-bold px-1.5 py-0.2 bg-black/15 rounded-full">
                                {branch.totalMembers}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Quick Toolbar Buttons */}
                {showControls && (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleExpandAll}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                            Expand All
                        </button>
                        <button
                            type="button"
                            onClick={handleCollapseToManagers}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                            Collapse
                        </button>
                        <button
                            type="button"
                            onClick={() => autoFit()}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-primary hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Maximize2 className="w-3.5 h-3.5 text-primary" />
                            Fit
                        </button>
                    </div>
                )}
            </div>

            {/* Interactive Vector & DOM Tree Viewport */}
            <div 
                className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Scalable & Pannable Canvas Board */}
                <div 
                    ref={chartAreaRef}
                    className="absolute top-0 left-0 transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        width: `${bounds.width}px`,
                        height: `${bounds.height}px`
                    }}
                >
                    {/* SVG Connector Paths */}
                    <svg 
                        className="absolute inset-0 pointer-events-none"
                        width={bounds.width} 
                        height={bounds.height}
                    >
                        <defs>
                            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.6" />
                            </linearGradient>
                            <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#059669" stopOpacity="1" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                            </linearGradient>
                        </defs>

                        {layoutConnectors.map(({ id, parent, child }) => {
                            if (parent.x === undefined || parent.y === undefined || child.x === undefined || child.y === undefined) return null;

                            const px = parent.x + CARD_WIDTH / 2;
                            const py = parent.y + CARD_HEIGHT;
                            const cx = child.x + CARD_WIDTH / 2;
                            const cy = child.y;

                            const midY = (py + cy) / 2;
                            const pathData = `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`;

                            const isHighlighted = selectedNode && (selectedNode.id === child.id || selectedNode.id === parent.id);

                            return (
                                <g key={id}>
                                    <path
                                        d={pathData}
                                        fill="none"
                                        stroke={isHighlighted ? 'url(#activeLineGrad)' : 'url(#lineGrad)'}
                                        strokeWidth={isHighlighted ? 2.5 : 1.8}
                                        strokeLinecap="round"
                                    />
                                    {/* Connection joint dots */}
                                    <circle cx={cx} cy={cy} r={2.5} fill={isHighlighted ? '#059669' : '#94a3b8'} />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Rich HTML DOM Org Cards */}
                    {layoutNodes.map(node => {
                        if (node.x === undefined || node.y === undefined) return null;

                        const theme = getRoleTheme(node.role);
                        const isCollapsed = collapsedNodes.has(node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        const isSelected = selectedNode?.id === node.id;
                        const isMatch = !!searchQuery && (
                            (node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (node.role || '').toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        const isUnassigned = !node.reportingManagerId;

                        return (
                            <div
                                key={node.id}
                                onClick={() => setSelectedNode(isSelected ? null : node)}
                                className={`org-card absolute rounded-xl bg-white border cursor-pointer transition-all duration-150 select-none shadow-sm hover:shadow-md ${theme.border} ${
                                    isSelected || isMatch
                                        ? 'ring-3 ring-emerald-500/30 border-emerald-500 shadow-md'
                                        : 'hover:border-slate-400'
                                }`}
                                style={{
                                    left: `${node.x}px`,
                                    top: `${node.y}px`,
                                    width: `${CARD_WIDTH}px`,
                                    height: `${CARD_HEIGHT}px`
                                }}
                            >
                                {/* Left Color Accent Strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${isUnassigned ? 'bg-amber-500' : theme.accent}`} />

                                <div className="p-2.5 pl-3.5 h-full flex flex-col justify-between">
                                    {/* Top Row: Avatar + Name + Level */}
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs ${theme.avatarBg}`}>
                                            {(node.name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs text-slate-900 truncate leading-snug" title={node.name}>
                                                {node.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${theme.badgeBg}`}>
                                                    {getRoleDisplayName(node.role)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Location & Expand/Collapse */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                        <span className="truncate max-w-[90px]">
                                            {node.location ? `📍 ${node.location}` : (isUnassigned ? '⚠️ Needs Mgr' : 'Active')}
                                        </span>

                                        {hasChildren && (
                                            <button
                                                type="button"
                                                onClick={(e) => toggleNodeCollapse(node.id, e)}
                                                className={`org-card-button px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 border transition-colors ${
                                                    isCollapsed
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                                }`}
                                            >
                                                {isCollapsed ? (
                                                    <>
                                                        <ChevronRight className="w-3 h-3 text-amber-700" />
                                                        <span>+{node.children!.length} Reports</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3 text-slate-600" />
                                                        <span>{node.children!.length} Reports</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Node Inspector Drawer */}
            {selectedNode && (
                <div className="absolute top-14 right-4 z-30 w-80 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-5 animate-fade-in-scale">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow-md">
                                {(selectedNode.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm">{selectedNode.name}</h4>
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleTheme(selectedNode.role).badgeBg}`}>
                                    {getRoleDisplayName(selectedNode.role)}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedNode(null)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700">
                        {selectedNode.location && (
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span>Location: <strong>{selectedNode.location}</strong></span>
                            </div>
                        )}
                        {selectedNode.email && (
                            <div className="flex items-center gap-2 truncate">
                                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{selectedNode.email}</span>
                            </div>
                        )}
                        {selectedNode.phone && (
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span>{selectedNode.phone}</span>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 space-y-1">
                            <p className="text-[11px] font-bold text-slate-500 uppercase">Approval Escalation</p>
                            <p className="text-slate-800">
                                L1 Manager: <strong>{selectedNode.managerName || '⚠️ Unassigned'}</strong>
                            </p>
                            {selectedNode.manager2Name && (
                                <p className="text-slate-800">L2 Manager: <strong>{selectedNode.manager2Name}</strong></p>
                            )}
                            {selectedNode.children && selectedNode.children.length > 0 && (
                                <p className="text-emerald-700 font-semibold pt-1">
                                    Direct Reports: {selectedNode.children.length} team members
                                </p>
                            )}
                        </div>

                        {onSelectEmployeeForTrace && (
                            <div className="pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => onSelectEmployeeForTrace(selectedNode.id)}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Trace Approval Chain
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowChart2D;
