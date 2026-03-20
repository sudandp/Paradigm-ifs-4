import React, { useEffect, useRef, useState } from 'react';
import type { User } from '../../types';
import { Mail, Phone, Users, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface WorkflowNode extends User {
    managerName?: string;
    children?: WorkflowNode[];
    x?: number;
    y?: number;
    z?: number;
    level?: number;
    pulsePhase?: number;
}

interface Particle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    color: string;
}

interface WorkflowChart3DProps {
    users: (User & { managerName?: string })[];
}

const WorkflowChart3D: React.FC<WorkflowChart3DProps> = ({ users }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredNode, setHoveredNode] = useState<WorkflowNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [zoom, setZoom] = useState(1.0);
    const animationRef = useRef<number>();
    const rotationRef = useRef({ x: 0.2, y: 0 });
    const targetRotationRef = useRef({ x: 0.2, y: 0 });
    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const autoRotateRef = useRef(true);
    const timeRef = useRef(0);
    const particlesRef = useRef<Particle[]>([]);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Load user images
    useEffect(() => {
        users.forEach(user => {
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

        users.forEach(user => {
            nodeMap.set(user.id, { ...user, children: [], pulsePhase: Math.random() * Math.PI * 2 });
        });

        const roots: WorkflowNode[] = [];
        users.forEach(user => {
            const node = nodeMap.get(user.id)!;
            if (user.reportingManagerId) {
                const parent = nodeMap.get(user.reportingManagerId);
                if (parent) {
                    parent.children!.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    // Assign 3D positions with better spacing
    const assignPositions = (nodes: WorkflowNode[], level = 0, startAngle = 0, angleSpan = 360, parentX = 0, parentZ = 0) => {
        const radius = level === 0 ? 0 : 200 + level * 180;
        const angleStep = nodes.length > 1 ? angleSpan / nodes.length : 0;
        const verticalSpacing = 180;

        nodes.forEach((node, index) => {
            node.level = level;

            if (level === 0) {
                node.x = 0;
                node.y = 0;
                node.z = 0;
            } else {
                const angle = (startAngle + angleStep * index) * Math.PI / 180;
                node.x = parentX + Math.cos(angle) * radius;
                node.y = -level * verticalSpacing;
                node.z = parentZ + Math.sin(angle) * radius;
            }

            if (node.children && node.children.length > 0) {
                const childStartAngle = startAngle + angleStep * index - angleStep * 0.6;
                const childSpan = Math.min(angleStep * 1.2, 120);
                assignPositions(node.children, level + 1, childStartAngle, childSpan, node.x!, node.z!);
            }
        });
    };

    // Create particles for connections
    const createParticle = (fromNode: WorkflowNode, toNode: WorkflowNode) => {
        const t = Math.random();
        const x = fromNode.x! + (toNode.x! - fromNode.x!) * t;
        const y = fromNode.y! + (toNode.y! - fromNode.y!) * t;
        const z = fromNode.z! + (toNode.z! - fromNode.z!) * t;

        particlesRef.current.push({
            x, y, z,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            vz: (Math.random() - 0.5) * 2,
            life: 0,
            maxLife: 100 + Math.random() * 100,
            color: `hsla(${250 + Math.random() * 30}, 80%, ${60 + Math.random() * 20}%, ${0.6 + Math.random() * 0.4})`
        });
    };

    // Update particles
    const updateParticles = () => {
        particlesRef.current = particlesRef.current.filter(p => {
            p.life++;
            p.x += p.vx * 0.5;
            p.y += p.vy * 0.5;
            p.z += p.vz * 0.5;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.vz *= 0.98;
            return p.life < p.maxLife;
        });

        // Add new particles occasionally
        if (Math.random() < 0.05 && particlesRef.current.length < 200) {
            const hierarchy = buildHierarchy();
            const allConnections: [WorkflowNode, WorkflowNode][] = [];

            const collectConnections = (node: WorkflowNode) => {
                if (node.children) {
                    node.children.forEach(child => {
                        allConnections.push([node, child]);
                        collectConnections(child);
                    });
                }
            };

            hierarchy.forEach(collectConnections);

            if (allConnections.length > 0) {
                const [from, to] = allConnections[Math.floor(Math.random() * allConnections.length)];
                createParticle(from, to);
            }
        }
    };

    // Project 3D to 2D with zoom
    const project = (x: number, y: number, z: number, rotX: number, rotY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, scale: 1 };

        // Apply zoom to coordinates
        x *= zoom;
        y *= zoom;
        z *= zoom;

        // Rotate around Y axis
        const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
        const z1 = x * Math.sin(rotY) + z * Math.cos(rotY);

        // Rotate around X axis
        const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        // Perspective projection
        const distance = 1200;
        const scale = distance / (distance + z2);

        return {
            x: canvas.width / 2 + x1 * scale,
            y: canvas.height / 2 + y2 * scale,
            scale: scale,
            z: z2
        };
    };

    // Draw a particle
    const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle, rotX: number, rotY: number) => {
        const pos = project(particle.x, particle.y, particle.z, rotX, rotY);
        if (pos.scale < 0.2) return;

        const alpha = 1 - (particle.life / particle.maxLife);
        const size = 2 * pos.scale * alpha;

        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8 * pos.scale;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    // Draw enhanced node with glow and photo
    const drawNode = (
        ctx: CanvasRenderingContext2D,
        node: WorkflowNode,
        rotX: number,
        rotY: number,
        isHovered: boolean,
        isSelected: boolean,
        time: number
    ) => {
        const pos = project(node.x!, node.y!, node.z!, rotX, rotY);
        if (pos.scale < 0.2) return;

        const baseRadius = 50;
        const pulse = Math.sin(time * 0.002 + (node.pulsePhase || 0)) * 0.1 + 1;
        const nodeRadius = baseRadius * pos.scale * (isSelected ? 1.3 : isHovered ? 1.2 : pulse);

        const isMatch = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Outer glow for selected/hovered/matched
        if (isSelected || isHovered || isMatch) {
            ctx.save();
            const gradient = ctx.createRadialGradient(pos.x, pos.y, nodeRadius * 0.5, pos.x, pos.y, nodeRadius * 2);
            gradient.addColorStop(0, isSelected ? 'rgba(99, 102, 241, 0.4)' : isMatch ? 'rgba(34, 197, 94, 0.4)' : 'rgba(99, 102, 241, 0.2)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeRadius * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Enhanced shadow
        ctx.save();
        ctx.shadowColor = isSelected ? 'rgba(99, 102, 241, 0.6)' : 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = (isSelected ? 40 : 25) * pos.scale;
        ctx.shadowOffsetX = 5 * pos.scale;
        ctx.shadowOffsetY = 8 * pos.scale;

        // Main node circle with enhanced gradient
        const gradient = ctx.createRadialGradient(
            pos.x - nodeRadius * 0.3,
            pos.y - nodeRadius * 0.3,
            0,
            pos.x,
            pos.y,
            nodeRadius
        );

        if (isSelected) {
            gradient.addColorStop(0, '#818CF8');
            gradient.addColorStop(0.5, '#6366F1');
            gradient.addColorStop(1, '#4F46E5');
        } else if (isMatch) {
            gradient.addColorStop(0, '#4ADE80');
            gradient.addColorStop(0.5, '#22C55E');
            gradient.addColorStop(1, '#16A34A');
        } else {
            gradient.addColorStop(0, '#7C3AED');
            gradient.addColorStop(0.5, '#6366F1');
            gradient.addColorStop(1, '#4F46E5');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Inner rim highlight
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3 * pos.scale;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius - 2 * pos.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Border with glow
        ctx.save();
        ctx.strokeStyle = isSelected ? '#FFF' : isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = (isSelected ? 4 : isHovered ? 3 : 2) * pos.scale;
        if (isSelected || isHovered) {
            ctx.shadowColor = '#FFF';
            ctx.shadowBlur = 10 * pos.scale;
        }
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Try to draw photo if available
        const img = imageCache.current.get(node.id);
        if (img && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeRadius - 4 * pos.scale, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
                img,
                pos.x - nodeRadius + 4 * pos.scale,
                pos.y - nodeRadius + 4 * pos.scale,
                (nodeRadius - 4 * pos.scale) * 2,
                (nodeRadius - 4 * pos.scale) * 2
            );
            ctx.restore();
        } else {
            // Draw initials with level-based color
            const levelColors = ['#FFF', '#FDE68A', '#A7F3D0', '#BFDBFE', '#DDD6FE'];
            ctx.fillStyle = levelColors[Math.min(node.level || 0, levelColors.length - 1)];
            ctx.font = `bold ${Math.max(14, 20 * pos.scale)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initials = node.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            ctx.fillText(initials, pos.x, pos.y);
        }

        // Level indicator badge
        if (node.level !== undefined && node.level > 0) {
            const badgeX = pos.x + nodeRadius * 0.7;
            const badgeY = pos.y - nodeRadius * 0.7;
            const badgeRadius = 12 * pos.scale;

            ctx.save();
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
            ctx.shadowBlur = 8 * pos.scale;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.max(8, 10 * pos.scale)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`L${node.level}`, badgeX, badgeY);
            ctx.restore();
        }

        return { ...pos, radius: nodeRadius };
    };

    // Draw enhanced connection line with animation
    const drawConnection = (
        ctx: CanvasRenderingContext2D,
        from: WorkflowNode,
        to: WorkflowNode,
        rotX: number,
        rotY: number,
        time: number
    ) => {
        const fromPos = project(from.x!, from.y!, from.z!, rotX, rotY);
        const toPos = project(to.x!, to.y!, to.z!, rotX, rotY);

        if (fromPos.scale < 0.2 || toPos.scale < 0.2) return;

        const avgScale = (fromPos.scale + toPos.scale) / 2;
        const avgZ = (fromPos.z + toPos.z) / 2;

        // Animated gradient
        const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y);
        const phase = (time * 0.001) % 1;
        gradient.addColorStop(0, `rgba(99, 102, 241, ${0.15 * avgScale})`);
        gradient.addColorStop(phase, `rgba(139, 92, 246, ${0.4 * avgScale})`);
        gradient.addColorStop(1, `rgba(99, 102, 241, ${0.15 * avgScale})`);

        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 * avgScale;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.3)';
        ctx.shadowBlur = 8 * avgScale;

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);

        // Smooth curved line
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2 + 50 * avgScale;
        ctx.quadraticCurveTo(midX, midY, toPos.x, toPos.y);
        ctx.stroke();
        ctx.restore();

        // Draw animated flow dot
        const flowT = (time * 0.0005 + from.id.charCodeAt(0) * 0.1) % 1;
        const flowX = fromPos.x + (toPos.x - fromPos.x) * flowT;
        const flowY = fromPos.y + (toPos.y - fromPos.y) * flowT + 50 * avgScale * Math.sin(flowT * Math.PI);

        ctx.save();
        ctx.fillStyle = '#818CF8';
        ctx.shadowColor = '#818CF8';
        ctx.shadowBlur = 12 * avgScale;
        ctx.beginPath();
        ctx.arc(flowX, flowY, 4 * avgScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    // Recursive draw function
    const drawTree = (
        ctx: CanvasRenderingContext2D,
        nodes: WorkflowNode[],
        rotX: number,
        rotY: number,
        time: number,
        nodePositions: Map<string, any>
    ) => {
        // Collect all nodes with depth for sorting
        const allNodes: { node: WorkflowNode; depth: number }[] = [];
        const allConnections: [WorkflowNode, WorkflowNode, number][] = [];

        const traverse = (node: WorkflowNode) => {
            const pos = project(node.x!, node.y!, node.z!, rotX, rotY);
            allNodes.push({ node, depth: pos.z });

            if (node.children) {
                node.children.forEach(child => {
                    const childPos = project(child.x!, child.y!, child.z!, rotX, rotY);
                    allConnections.push([node, child, (pos.z + childPos.z) / 2]);
                    traverse(child);
                });
            }
        };

        nodes.forEach(traverse);

        // Sort by depth (draw far first)
        allConnections.sort((a, b) => a[2] - b[2]);
        allNodes.sort((a, b) => a.depth - b.depth);

        // Draw connections
        allConnections.forEach(([from, to]) => {
            drawConnection(ctx, from, to, rotX, rotY, time);
        });

        // Draw particles
        particlesRef.current.forEach(particle => {
            drawParticle(ctx, particle, rotX, rotY);
        });

        // Draw nodes
        allNodes.forEach(({ node }) => {
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const pos = drawNode(ctx, node, rotX, rotY, isHovered, isSelected, time);
            if (pos) {
                nodePositions.set(node.id, pos);
            }
        });
    };

    // Handle canvas resize
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Start animation
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let frameId: number;

        const animateFrame = () => {
            timeRef.current += 16;

            // Clear with gradient background
            const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            bgGradient.addColorStop(0, '#FAFAFA');
            bgGradient.addColorStop(1, '#F3F4F6');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Smooth rotation interpolation
            rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.1;
            rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.1;

            // Auto-rotate if not dragging
            if (autoRotateRef.current && !isDraggingRef.current) {
                targetRotationRef.current.y += 0.003;
            }

            // Update particles
            updateParticles();

            // Build and position hierarchy
            const hierarchy = buildHierarchy();
            assignPositions(hierarchy);

            // Draw the tree
            const nodePositions = new Map();
            drawTree(ctx, hierarchy, rotationRef.current.x, rotationRef.current.y, timeRef.current, nodePositions);

            // Check for hover
            let foundHovered = false;
            const sortedPositions = Array.from(nodePositions.entries()).sort((a, b) => b[1].z - a[1].z);

            for (const [nodeId, pos] of sortedPositions) {
                const dx = mousePos.x - pos.x;
                const dy = mousePos.y - pos.y;
                if (Math.sqrt(dx * dx + dy * dy) < pos.radius) {
                    const node = users.find(u => u.id === nodeId);
                    if (node) {
                        setHoveredNode(node as WorkflowNode);
                        foundHovered = true;
                    }
                    break;
                }
            }

            if (!foundHovered && hoveredNode) {
                setHoveredNode(null);
            }

            frameId = requestAnimationFrame(animateFrame);
        };

        frameId = requestAnimationFrame(animateFrame);

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [users, hoveredNode, selectedNode, mousePos, zoom, searchQuery]);

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        autoRotateRef.current = false;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }

        if (isDraggingRef.current) {
            const dx = e.clientX - lastMouseRef.current.x;
            const dy = e.clientY - lastMouseRef.current.y;

            targetRotationRef.current.y += dx * 0.01;
            targetRotationRef.current.x += dy * 0.01;

            // Clamp X rotation
            targetRotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationRef.current.x));

            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        setTimeout(() => {
            autoRotateRef.current = true;
        }, 2000);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (hoveredNode) {
            setSelectedNode(selectedNode?.id === hoveredNode.id ? null : hoveredNode);
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2.5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
    const handleReset = () => {
        setZoom(1.0);
        targetRotationRef.current = { x: 0.2, y: 0 };
        setSelectedNode(null);
        setSearchQuery('');
    };

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100" ref={containerRef}>
            {/* Enhanced Controls */}
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
                            {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length} results
                        </p>
                    )}
                </div>

                {/* Zoom Controls */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-2 flex gap-2">
                    <button
                        onClick={handleZoomOut}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="px-3 py-2 text-sm font-medium text-slate-700 min-w-[60px] text-center">
                        {Math.round(zoom * 100)}%
                    </div>
                    <button
                        onClick={handleZoomIn}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-5 h-5 text-slate-600" />
                    </button>
                    <button
                        onClick={handleReset}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Reset View"
                    >
                        <Maximize2 className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
            </div>

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

            {/* Enhanced Hover Tooltip */}
            {hoveredNode && (
                <div
                    className="absolute pointer-events-none z-10 transform -translate-x-1/2 transition-all duration-200"
                    style={{
                        left: `${mousePos.x}px`,
                        top: `${mousePos.y - 140}px`,
                    }}
                >
                    <div className="bg-white/95 backdrop-blur-xl border border-indigo-200 rounded-2xl shadow-2xl p-5 min-w-[320px] animate-fade-in-scale">
                        <div className="flex items-start gap-4">
                            {/* Enhanced Avatar */}
                            <div className="flex-shrink-0 relative">
                                {hoveredNode.photoUrl ? (
                                    <img
                                        src={hoveredNode.photoUrl}
                                        alt={hoveredNode.name}
                                        className="w-20 h-20 rounded-2xl object-cover border-3 border-indigo-500 shadow-lg"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl border-3 border-white shadow-lg">
                                        {hoveredNode.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {hoveredNode.level !== undefined && hoveredNode.level > 0 && (
                                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                        L{hoveredNode.level}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900 text-xl mb-1 truncate">
                                    {hoveredNode.name}
                                </h3>
                                <p className="text-sm text-indigo-600 font-medium capitalize mb-3 truncate">
                                    {hoveredNode.role.replace(/_/g, ' ')}
                                </p>

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
                                            <span className="truncate">Reports to: <strong>{hoveredNode.managerName}</strong></span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-xs text-slate-500 italic">
                                        Click to {selectedNode?.id === hoveredNode.id ? 'deselect' : 'select and focus'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Instructions */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-xl">
                <p className="text-sm text-slate-700 font-medium flex items-center gap-3">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        Drag to rotate
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Hover for details</span>
                    <span className="text-slate-300">•</span>
                    <span>Click to select</span>
                </p>
            </div>

            {/* Enhanced Legend */}
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-4 max-w-[200px]">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                    Org Hierarchy
                </h4>
                <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-white shadow-md flex-shrink-0"></div>
                        <span>Team Member</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-white shadow-md flex-shrink-0"></div>
                        <span>Search Match</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="w-8 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-500 flex-shrink-0 shadow-sm"></div>
                        <span>Reports To</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                            L2
                        </div>
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

            {/* Performance indicator */}
            <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full font-mono">
                {users.length} nodes • {particlesRef.current.length} particles
            </div>
        </div>
    );
};

export default WorkflowChart3D;
