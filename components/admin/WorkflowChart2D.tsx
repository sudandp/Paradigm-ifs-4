import React, { useEffect, useRef, useState } from 'react';
import type { User } from '../../types';
import { Mail, Phone, Users, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface WorkflowNode extends User {
    managerName?: string;
    children?: WorkflowNode[];
    x?: number;
    y?: number;
    level?: number;
}

interface WorkflowChart2DProps {
    users: (User & { managerName?: string, manager2Name?: string, manager3Name?: string })[];
    externalSearchQuery?: string;
    externalZoom?: number;
    showControls?: boolean; // default true for backward compatibility
}

const WorkflowChart2D: React.FC<WorkflowChart2DProps> = ({
    users,
    externalSearchQuery,
    externalZoom,
    showControls = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredNode, setHoveredNode] = useState<WorkflowNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const [internalZoom, setInternalZoom] = useState(1.0); // Increased for better vertical layout visibility
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Use external controls if provided, otherwise use internal state
    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
    const zoom = externalZoom !== undefined ? externalZoom : internalZoom;
    const setSearchQuery = setInternalSearchQuery;
    const setZoom = setInternalZoom;
    const animationRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const timeRef = useRef(0);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
    const dprRef = useRef<number>(window.devicePixelRatio || 1);

    // Load user images
    useEffect(() => {
        users.forEach((user) => {
            if (user.photoUrl && !imageCache.current.has(user.id)) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = user.photoUrl;
                img.onload = () => {
                    imageCache.current.set(user.id, img);
                };
            }
        });
    }, [users]);

    // Build hierarchy tree
    const buildHierarchy = (): WorkflowNode[] => {
        const nodeMap = new Map<string, WorkflowNode>();
        users.forEach((user) => {
            nodeMap.set(user.id, { ...user, children: [] });
        });

        const roots: WorkflowNode[] = [];
        const hasParent = new Set<string>();
        users.forEach((user) => {
            const node = nodeMap.get(user.id)!;
            // Primary manager
            if (user.reportingManagerId) {
                const parent = nodeMap.get(user.reportingManagerId);
                if (parent) {
                    parent.children!.push(node);
                    hasParent.add(user.id);
                }
            }
            // Manager 2 – add a reference clone
            if ((user as any).reportingManager2Id) {
                const parent2 = nodeMap.get((user as any).reportingManager2Id);
                if (parent2) {
                    parent2.children!.push({ ...node, id: user.id + '-m2', children: [] });
                    hasParent.add(user.id);
                }
            }
            // Manager 3 – add a reference clone
            if ((user as any).reportingManager3Id) {
                const parent3 = nodeMap.get((user as any).reportingManager3Id);
                if (parent3) {
                    parent3.children!.push({ ...node, id: user.id + '-m3', children: [] });
                    hasParent.add(user.id);
                }
            }
        });

        // Roots are users not under any manager
        users.forEach((user) => {
            if (!hasParent.has(user.id)) {
                roots.push(nodeMap.get(user.id)!);
            }
        });

        return roots;
    };

    // Calculate tree layout (Top-to-Bottom vertical hierarchical)
    const calculateLayout = (
        nodes: WorkflowNode[],
        startX = 50,
        startY = 50,
        level = 0
    ): {
        width: number;
        nodes: WorkflowNode[];
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
    } => {
        const HORIZONTAL_SPACING = 20; // Reduced from 40 for more compact layout
        const VERTICAL_SPACING = 120;  // Reduced from 150 for better fit
        const NODE_HEIGHT = 120;
        const NODE_WIDTH = 180;

        let currentX = startX;
        const allNodes: WorkflowNode[] = [];
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;

        nodes.forEach((node) => {
            node.level = level;

            if (node.children && node.children.length > 0) {
                // Calculate children layout first
                const childLayout = calculateLayout(node.children, currentX, startY + NODE_HEIGHT + VERTICAL_SPACING, level + 1);

                // Center parent horizontally relative to children
                const childrenWidth = childLayout.width;
                const parentX = currentX + childrenWidth / 2 - NODE_WIDTH / 2;

                node.x = parentX;
                node.y = startY;

                allNodes.push(node);
                allNodes.push(...childLayout.nodes);

                // Update bounds
                minX = Math.min(minX, parentX, childLayout.bounds.minX);
                maxX = Math.max(maxX, parentX + NODE_WIDTH, childLayout.bounds.maxX);
                minY = Math.min(minY, startY, childLayout.bounds.minY);
                maxY = Math.max(maxY, startY + NODE_HEIGHT, childLayout.bounds.maxY);

                currentX += childrenWidth + HORIZONTAL_SPACING;
            } else {
                // Leaf node
                node.x = currentX;
                node.y = startY;
                allNodes.push(node);

                // Update bounds
                minX = Math.min(minX, currentX);
                maxX = Math.max(maxX, currentX + NODE_WIDTH);
                minY = Math.min(minY, startY);
                maxY = Math.max(maxY, startY + NODE_HEIGHT);

                currentX += NODE_WIDTH + HORIZONTAL_SPACING;
            }
        });

        const totalWidth = Math.max(0, currentX - startX - HORIZONTAL_SPACING);
        return {
            width: Math.max(totalWidth, NODE_WIDTH),
            nodes: allNodes,
            bounds: { minX: isFinite(minX) ? minX : 0, maxX: isFinite(maxX) ? maxX : NODE_WIDTH, minY: isFinite(minY) ? minY : 0, maxY: isFinite(maxY) ? maxY : 300 },
        };
    };

    // Draw connection line between nodes (vertical: top to bottom)
    const drawConnection = (ctx: CanvasRenderingContext2D, from: WorkflowNode, to: WorkflowNode, time: number) => {
        if (from.x === undefined || from.y === undefined || to.x === undefined || to.y === undefined) return;

        const fromX = (from.x + 90) * zoom + offset.x;  // Center X of parent
        const fromY = (from.y + 120) * zoom + offset.y; // Bottom of parent
        const toX = (to.x + 90) * zoom + offset.x;      // Center X of child  
        const toY = (to.y) * zoom + offset.y;           // Top of child

        // Animated gradient
        const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
        const phase = (time * 0.0005) % 1;
        gradient.addColorStop(0, '#E0E7FF');
        gradient.addColorStop(phase, '#818CF8');
        gradient.addColorStop(1, '#E0E7FF');

        ctx.save();
        ctx.strokeStyle = gradient as any;
        ctx.lineWidth = 2 * zoom;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(99, 102, 241, 0.2)';
        ctx.shadowBlur = 4;

        // Draw smooth curved connection (vertical)
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        const midY = (fromY + toY) / 2;
        ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
        ctx.stroke();
        ctx.restore();

        // Draw animated flow dot
        const flowT = (time * 0.0005 + from.id.charCodeAt(0) * 0.1) % 1;
        const t = flowT;

        const p0 = { x: fromX, y: fromY };
        const p1 = { x: fromX, y: (fromY + toY) / 2 };
        const p2 = { x: toX, y: (fromY + toY) / 2 };
        const p3 = { x: toX, y: toY };

        // Cubic bezier interpolation
        const cx = 3 * (p1.x - p0.x);
        const bx = 3 * (p2.x - p1.x) - cx;
        const ax = p3.x - p0.x - cx - bx;

        const cy = 3 * (p1.y - p0.y);
        const by = 3 * (p2.y - p1.y) - cy;
        const ay = p3.y - p0.y - cy - by;

        const flowX = ax * t * t * t + bx * t * t + cx * t + p0.x;
        const flowY = ay * t * t * t + by * t * t + cy * t + p0.y;

        ctx.save();
        ctx.fillStyle = '#6366F1';
        ctx.shadowColor = '#6366F1';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(flowX, flowY, 3 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    // Draw enhanced node with premium UI
    const drawNode = (
        ctx: CanvasRenderingContext2D,
        node: WorkflowNode,
        isHovered: boolean,
        isSelected: boolean,
        time: number
    ): { x: number; y: number; width: number; height: number } | null => {
        if (node.x === undefined || node.y === undefined) return null;

        const x = node.x * zoom + offset.x;
        const y = node.y * zoom + offset.y;
        const width = 180 * zoom;
        const height = 120 * zoom;
        const avatarSize = 48 * zoom;

        const isMatch = !!searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Card Shadow & background
        ctx.save();
        ctx.shadowColor = isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = (isSelected ? 24 : 12) * zoom;
        ctx.shadowOffsetY = (isSelected ? 8 : 4) * zoom;

        const cardGradient = ctx.createLinearGradient(x, y, x, y + height);
        cardGradient.addColorStop(0, '#FFFFFF');
        cardGradient.addColorStop(1, '#FAFAFA');
        ctx.fillStyle = cardGradient;

        const radius = 16 * zoom;
        ctx.beginPath();
        if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x, y, width, height, radius);
        } else {
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
        }
        ctx.fill();

        ctx.lineWidth = (isSelected ? 2 : 1) * zoom;
        ctx.strokeStyle = isSelected ? '#6366F1' : isHovered ? '#A5B4FC' : isMatch ? '#22C55E' : '#E5E7EB';
        ctx.stroke();
        ctx.restore();

        // Selection/Match Overlay
        if (isSelected || isMatch) {
            ctx.save();
            ctx.globalAlpha = 0.05;
            ctx.fillStyle = isSelected ? '#6366F1' : '#22C55E';
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, width, height, radius);
            ctx.fill();
            ctx.restore();
        }

        // Avatar
        const avatarX = x + (width - avatarSize) / 2;
        const avatarY = y + 16 * zoom;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();

        const img = imageCache.current.get(node.id);
        if (img && img.complete) {
            ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        } else {
            const avatarGradient = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
            avatarGradient.addColorStop(0, '#818CF8');
            avatarGradient.addColorStop(1, '#4F46E5');
            ctx.fillStyle = avatarGradient;
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

            ctx.fillStyle = '#FFF';
            ctx.font = `600 ${Math.max(12, 16 * zoom)}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initials = node.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
            ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1 * zoom);
        }
        ctx.restore();

        // Avatar Ring
        ctx.save();
        ctx.strokeStyle = isSelected ? '#6366F1' : '#FFF';
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Level Badge
        if (node.level !== undefined && node.level > 0) {
            const badgeSize = 18 * zoom;
            const badgeX = avatarX + avatarSize - badgeSize / 2;
            const badgeY = avatarY + avatarSize - badgeSize / 2;

            ctx.save();
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
            ctx.shadowBlur = 4 * zoom;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFF';
            ctx.font = `700 ${Math.max(8, 9 * zoom)}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`L${node.level}`, badgeX, badgeY + 1 * zoom);
            ctx.restore();
        }

        // Name and Role
        ctx.save();
        ctx.fillStyle = '#111827';
        ctx.font = `600 ${Math.max(11, 13 * zoom)}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const nameY = avatarY + avatarSize + 12 * zoom;

        let displayName = node.name;
        const maxTextWidth = width - 24 * zoom;
        if (ctx.measureText(displayName).width > maxTextWidth) {
            while (ctx.measureText(displayName + '...').width > maxTextWidth && displayName.length > 0) {
                displayName = displayName.substring(0, displayName.length - 1);
            }
            displayName += '...';
        }
        ctx.fillText(displayName, x + width / 2, nameY);

        ctx.fillStyle = '#6B7280';
        ctx.font = `500 ${Math.max(9, 11 * zoom)}px "Inter", sans-serif`;
        const roleY = nameY + 18 * zoom;
        let displayRole = (node.role || '').replace(/_/g, ' ');
        displayRole = displayRole ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1).toLowerCase() : '';
        if (ctx.measureText(displayRole).width > maxTextWidth) {
            while (ctx.measureText(displayRole + '...').width > maxTextWidth && displayRole.length > 0) {
                displayRole = displayRole.substring(0, displayRole.length - 1);
            }
            displayRole += '...';
        }
        ctx.fillText(displayRole, x + width / 2, roleY);
        ctx.restore();

        return { x, y, width, height };
    };

    // Draw the entire tree
    const drawTree = (ctx: CanvasRenderingContext2D, time: number) => {
        const hierarchy = buildHierarchy();
        const layout = calculateLayout(hierarchy);
        const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();

        // Draw connections first (behind nodes)
        layout.nodes.forEach((node) => {
            if (node.children) {
                node.children.forEach((child) => {
                    drawConnection(ctx, node, child, time);
                });
            }
        });

        // Draw nodes on top
        layout.nodes.forEach((node) => {
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const pos = drawNode(ctx, node, isHovered, isSelected, time);
            if (pos) nodePositions.set(node.id, pos);
        });

        return { nodePositions, layout };
    };

    // Auto-center and fit content on load and reset
    const autoFit = (useCanvas?: HTMLCanvasElement | null) => {
        const canvas = useCanvas ?? canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const hierarchy = buildHierarchy();
        const layout = calculateLayout(hierarchy);
        const bounds = layout.bounds;

        // Add padding to content dimensions
        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 120;
        const contentWidth = Math.max(1, bounds.maxX - bounds.minX + NODE_WIDTH);
        const contentHeight = Math.max(1, bounds.maxY - bounds.minY + NODE_HEIGHT);

        // Calculate true center of content including node dimensions
        const contentCenterX = bounds.minX + contentWidth / 2;
        const contentCenterY = bounds.minY + contentHeight / 2;

        // Use CSS pixels (rect.width/height)
        const paddingFactor = 0.98; // Maximize viewport usage - use 98% of available space
        const zoomX = (rect.width * paddingFactor) / contentWidth;
        const zoomY = (rect.height * paddingFactor) / contentHeight;
        let newZoom = Math.min(zoomX, zoomY);

        // Clamp zoom to reasonable range
        newZoom = Math.max(0.3, Math.min(newZoom, 1.5));

        // If using external zoom, use that but still center properly
        const actualZoom = externalZoom !== undefined ? externalZoom : newZoom;

        // Center the content in the viewport
        const newOffsetX = rect.width / 2 - contentCenterX * actualZoom;
        const newOffsetY = rect.height / 2 - contentCenterY * actualZoom;

        if (externalZoom === undefined) {
            setZoom(newZoom);
        }
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    // Trigger auto-fit when component mounts or users change
    useEffect(() => {
        if (users.length > 0) {
            // Small delay to ensure canvas is ready
            const timer = setTimeout(() => autoFit(), 100);
            return () => clearTimeout(timer);
        }
    }, [users.length]);

    // Recalculate offset when external zoom changes to keep chart centered
    useEffect(() => {
        if (externalZoom !== undefined && users.length > 0) {
            autoFit();
        }
    }, [externalZoom]);


    // Handle canvas resize with High DPI support
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

            const dpr = window.devicePixelRatio || 1;
            dprRef.current = dpr;
            const rect = container.getBoundingClientRect();
            const cssWidth = Math.max(1, rect.width);
            const cssHeight = Math.max(1, rect.height);

            // set device pixels
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);

            // visible size
            canvas.style.width = `${cssWidth}px`;
            canvas.style.height = `${cssHeight}px`;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Use setTransform to set dpi scaling explicitly (avoids accumulation)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // After resizing, re-fit content so it stays centered
            autoFit(canvas);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users]);

    // Start animation
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const dpr = dprRef.current;

        let frameId = 0;
        const animateFrame = () => {
            timeRef.current += 16;

            // Clear using CSS pixel dimensions (transform is already applied)
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            // Fill background using CSS pixel coords
            const cssW = canvas.width / dpr;
            const cssH = canvas.height / dpr;
            const bgGradient = ctx.createLinearGradient(0, 0, cssW, cssH);
            bgGradient.addColorStop(0, '#FAFAFA');
            bgGradient.addColorStop(1, '#F3F4F6');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, cssW, cssH);

            // Draw the tree (positions and sizes are in CSS pixels)
            const { nodePositions } = drawTree(ctx, timeRef.current);

            // Hover detection (mousePos is CSS pixels)
            let foundHovered = false;
            for (const [nodeId, pos] of nodePositions.entries()) {
                if (mousePos.x >= pos.x && mousePos.x <= pos.x + pos.width && mousePos.y >= pos.y && mousePos.y <= pos.y + pos.height) {
                    const node = users.find((u) => u.id === nodeId);
                    if (node) {
                        setHoveredNode(node as WorkflowNode);
                        foundHovered = true;
                        break;
                    }
                }
            }
            if (!foundHovered && hoveredNode) {
                setHoveredNode(null);
            }

            frameId = requestAnimationFrame(animateFrame);
            animationRef.current = frameId;
        };

        animationRef.current = requestAnimationFrame(animateFrame);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [users, hoveredNode, selectedNode, mousePos, zoom, offset, searchQuery]);

    // Mouse handlers - Allow dragging from anywhere
    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        const x = e.nativeEvent.offsetX;
        const y = e.nativeEvent.offsetY;
        lastMouseRef.current = { x, y };
        dragStartRef.current = { x, y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // offsetX/offsetY are CSS pixels here
        const x = e.nativeEvent.offsetX;
        const y = e.nativeEvent.offsetY;
        setMousePos({ x, y });

        if (isDraggingRef.current) {
            const dx = (x - lastMouseRef.current.x) * 1.3; // 30% increase in drag sensitivity
            const dy = (y - lastMouseRef.current.y) * 1.3;

            // Check if movement exceeds threshold (5 pixels)
            const distanceFromStart = Math.sqrt(
                Math.pow(x - dragStartRef.current.x, 2) +
                Math.pow(y - dragStartRef.current.y, 2)
            );

            if (distanceFromStart > 5) {
                hasDraggedRef.current = true;
            }

            setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMouseRef.current = { x, y };
        }
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleClick = () => {
        // Only trigger node selection if user didn't drag
        if (hoveredNode && !hasDraggedRef.current) {
            setSelectedNode(selectedNode?.id === hoveredNode.id ? null : hoveredNode);
        }
        hasDraggedRef.current = false;
    };

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2.5));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.4));
    const handleReset = () => {
        autoFit();
        setSelectedNode(null);
        setSearchQuery('');
    };

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100" ref={containerRef}>
            {/* Controls - only show if showControls is true */}
            {showControls && (
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
                    {/* Search */}
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-3 min-w-[280px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        {searchQuery && (
                            <p className="mt-2 text-xs text-slate-500">
                                {users.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length} results
                            </p>
                        )}
                    </div>

                    {/* Zoom Controls */}
                    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg p-3 flex flex-col gap-3 min-w-[240px]">
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={handleZoomOut}
                                className="p-2 hover:bg-slate-100/80 rounded-xl transition-all duration-200 text-slate-600 hover:text-slate-900 active:scale-95"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <div className="flex-1 px-2">
                                <input
                                    type="range"
                                    min="40"
                                    max="250"
                                    value={Math.round(zoom * 100)}
                                    onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-indigo-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
                                    title="Zoom Slider"
                                />
                            </div>
                            <button
                                onClick={handleZoomIn}
                                className="p-2 hover:bg-slate-100/80 rounded-xl transition-all duration-200 text-slate-600 hover:text-slate-900 active:scale-95"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="px-2 min-w-[60px] text-center font-semibold text-slate-700 text-sm tabular-nums bg-slate-100 rounded-lg py-1">{Math.round(zoom * 100)}%</div>
                            <div className="w-px h-6 bg-slate-200" />
                            <button
                                onClick={handleReset}
                                className="p-2 hover:bg-slate-100/80 rounded-xl transition-all duration-200 text-slate-600 hover:text-slate-900 active:scale-95"
                                title="Reset View"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
            />

            {/* Hover Tooltip */}
            {hoveredNode && hoveredNode.x !== undefined && hoveredNode.y !== undefined && (
                <div
                    className="absolute pointer-events-none z-10 transform -translate-x-1/2 transition-all duration-200"
                    style={{
                        left: `${hoveredNode.x * zoom + offset.x + (90 * zoom)}px`, // Center X of node
                        top: `${Math.max(10, hoveredNode.y * zoom + offset.y - 10)}px`, // Above node with min margin
                    }}
                >
                    <div className="bg-white/95 backdrop-blur-xl border border-indigo-200 rounded-2xl shadow-2xl p-5 min-w-[320px] animate-fade-in-scale">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="flex-shrink-0 relative">
                                {hoveredNode.photoUrl ? (
                                    <img src={hoveredNode.photoUrl} alt={hoveredNode.name} className="w-20 h-20 rounded-2xl object-cover border-3 border-indigo-500 shadow-lg" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl border-3 border-white shadow-lg">
                                        {hoveredNode.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {hoveredNode.level !== undefined && hoveredNode.level > 0 && (
                                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">L{hoveredNode.level}</div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900 text-xl mb-1 truncate">{hoveredNode.name}</h3>
                                <p className="text-sm text-indigo-600 font-medium capitalize mb-3 truncate">{hoveredNode.role.replace(/_/g, ' ')}</p>

                                <div className="space-y-2">
                                    {hoveredNode.email && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Mail className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                            <span className="truncate">{hoveredNode.email}</span>
                                        </div>
                                    )}

                                    {hoveredNode.phone && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Phone className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                            <span>{hoveredNode.phone}</span>
                                        </div>
                                    )}

                                    {hoveredNode.managerName && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Users className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                            <span className="truncate">
                                                Reports to: <strong>{hoveredNode.managerName}</strong>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-xs text-slate-500 italic">Click to {selectedNode?.id === hoveredNode.id ? 'deselect' : 'select and focus'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Instructions */}
            {showControls && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-xl">
                    <p className="text-sm text-slate-700 font-medium flex items-center gap-3">
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                            Drag to pan
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>Hover for details</span>
                        <span className="text-slate-300">•</span>
                        <span>Click to select</span>
                    </p>
                </div>
            )}

            {/* Legend */}
            {showControls && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-4 max-w-[200px]">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                        Org Hierarchy
                    </h4>
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-white shadow-md flex-shrink-0"></div>
                            <span>Team Member</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-white shadow-md flex-shrink-0"></div>
                            <span>Search Match</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <div className="w-8 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-500 flex-shrink-0 shadow-sm"></div>
                            <span>Reports To</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">L2</div>
                            <span>Level Badge</span>
                        </div>
                    </div>

                    {selectedNode && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs font-semibold text-indigo-600 mb-1">Selected:</p>
                            <p className="text-xs text-slate-700 font-medium truncate">{selectedNode.name}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full font-mono">{users.length} employees</div>
        </div>
    );
};

export default WorkflowChart2D;
