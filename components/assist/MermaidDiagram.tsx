import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import { 
  Download, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ArrowDown, 
  MoveHorizontal, 
  MoveVertical, 
  Scan, 
  Shrink, 
  Maximize,
  Layers,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { IndustrialProcessSchematic } from './IndustrialProcessSchematic';

interface MermaidDiagramProps {
  code: string;
  className?: string;
  title?: string;
}

function initMermaid(isDark: boolean) {
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: isDark
        ? {
            primaryColor: '#059669',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#10b981',
            lineColor: '#34d399',
            secondaryColor: '#0f172a',
            tertiaryColor: '#1e293b',
            background: '#020617',
            mainBkg: '#0f172a',
            nodeBorder: '#10b981',
            clusterBkg: '#1e293b'
          }
        : {
            primaryColor: '#ecfdf5',
            primaryTextColor: '#064e3b',
            primaryBorderColor: '#059669',
            lineColor: '#059669',
            secondaryColor: '#f0fdf4',
            tertiaryColor: '#f8fafc',
            background: '#ffffff',
            mainBkg: '#ecfdf5',
            nodeBorder: '#059669',
            clusterBkg: '#f1f5f9'
          },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  } catch (e) {
    console.error('[Mermaid] Initialization error:', e);
  }
}

/**
 * Robustly sanitizes Mermaid code to fix common LLM syntax bugs:
 * 1. Wraps unquoted node labels in double quotes: A[Raw & (Intake)] -> A["Raw and (Intake)"]
 * 2. Replaces bare ampersands (&) with 'and' inside labels
 * 3. Normalizes ASCII arrow sequences into standard Mermaid graph
 * 4. Supports dynamic orientation override (LR vs TD)
 */
export function sanitizeMermaidCode(raw: string, orientationOverride?: 'LR' | 'TD'): string {
  let cleaned = raw.trim();

  // Strip ```mermaid or ``` fences
  cleaned = cleaned.replace(/^```(?:mermaid|flowchart)?\s*/i, '').replace(/```\s*$/, '').trim();

  // 1. Wrap unquoted square brackets [...] in ["..."] and clean & and inner quotes
  cleaned = cleaned.replace(/\[([^"\]\r\n]+)\]/g, (match, label) => {
    if (label.startsWith('"') && label.endsWith('"')) {
      const inner = label.slice(1, -1).replace(/"/g, "'").replace(/&/g, 'and');
      return `["${inner}"]`;
    }
    const cleanLabel = label.replace(/"/g, "'").replace(/&/g, 'and');
    return `["${cleanLabel}"]`;
  });

  // 2. Wrap unquoted round brackets (...) in ("...")
  cleaned = cleaned.replace(/([A-Za-z0-9_]+)\(([^"\)\r\n]+)\)/g, (match, id, label) => {
    if (label.startsWith('"') && label.endsWith('"')) return match;
    const cleanLabel = label.replace(/"/g, "'").replace(/&/g, 'and');
    return `${id}("${cleanLabel}")`;
  });

  // 3. Wrap unquoted curly brackets {...} in {"..."}
  cleaned = cleaned.replace(/([A-Za-z0-9_]+)\{([^"\}\r\n]+)\}/g, (match, id, label) => {
    if (label.startsWith('"') && label.endsWith('"')) return match;
    const cleanLabel = label.replace(/"/g, "'").replace(/&/g, 'and');
    return `${id}{"${cleanLabel}"}`;
  });

  // Check if diagram header is declared
  const hasHeader = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph)\b/i.test(
    cleaned
  );

  const defaultOrientation = orientationOverride || 'LR';

  if (!hasHeader) {
    return `graph ${defaultOrientation}\n${cleaned.replace(/->/g, '-->')}`;
  }

  // If orientationOverride is provided, swap direction in graph / flowchart headers
  if (orientationOverride) {
    cleaned = cleaned.replace(/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)\b/im, `$1 ${orientationOverride}`);
  }

  return cleaned;
}

/**
 * Extracts sequence of steps from diagram code for graceful native fallback rendering
 */
function extractFallbackSteps(rawCode: string): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();

  // Try extracting from node definitions: [Label] or ["Label"]
  const labelMatches = rawCode.matchAll(/\["?(.*?)"?\]/g);
  for (const m of labelMatches) {
    const text = m[1].replace(/&/g, 'and').trim();
    if (text && !seen.has(text.toLowerCase()) && text.length > 1) {
      seen.add(text.toLowerCase());
      steps.push(text);
    }
  }

  // If no brackets found, split lines by arrows
  if (steps.length === 0) {
    const arrowParts = rawCode
      .split(/->|-->|<-|<--/)
      .map(p => p.trim().replace(/^[\\\/]+|[\\\/]+$/g, '').trim())
      .filter(p => p.length > 1 && !/^(graph|flowchart|TD|LR)/i.test(p));

    for (const part of arrowParts) {
      if (!seen.has(part.toLowerCase())) {
        seen.add(part.toLowerCase());
        steps.push(part);
      }
    }
  }

  return steps;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, className = '', title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // New features for frame fitting & sample image matching
  const [fitToFrame, setFitToFrame] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<'LR' | 'TD'>('LR'); // Defaults to horizontal like samples 2, 3, 5

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // Detect if diagram or prompt is related to wastewater / STP / WTP
  const isWastewaterTreatment = useMemo(() => {
    const combined = `${code} ${title || ''}`.toLowerCase();
    return /water|stp|wtp|treatment|sewage|effluent|sedimentation|clarifier|aeration|filtration|sludge|flocculation|disinfection|screening/i.test(
      combined
    );
  }, [code, title]);

  // Tab mode: 'schematic' (P&ID Engineering Flowsheet) vs 'flowchart' (Mermaid) vs 'steps'
  const [activeTab, setActiveTab] = useState<'schematic' | 'flowchart' | 'steps'>(
    isWastewaterTreatment ? 'schematic' : 'flowchart'
  );

  useEffect(() => {
    initMermaid(isDark);
  }, [isDark]);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        setUseFallback(false);
        initMermaid(isDark);

        const cleanCode = sanitizeMermaidCode(code, orientation);
        const uniqueId = `mermaid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const { svg } = await mermaid.render(uniqueId, cleanCode);
        if (isMounted) {
          // Adjust SVG: strip inline max-width that restricts width, ensure viewBox & responsive scaling
          let adjustedSvg = svg;
          adjustedSvg = adjustedSvg.replace(/style="([^"]*?)max-width:\s*[^;"]+;?([^"]*?)"/gi, 'style="$1$2"');
          if (!adjustedSvg.includes('preserveAspectRatio')) {
            adjustedSvg = adjustedSvg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
          }
          // Ensure width="100%"
          adjustedSvg = adjustedSvg.replace(/<svg\b([^>]*?)(\bwidth="[^"]*")?([^>]*?)>/i, (match, before, _w, after) => {
            return `<svg ${before} width="100%" ${after}>`;
          });

          setSvgHtml(adjustedSvg);
        }
      } catch (err: any) {
        console.warn('[Mermaid] Direct render failed, activating Visual Step Diagram:', err?.message || err);
        if (isMounted) {
          setUseFallback(true);
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [code, isDark, orientation]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Export the rendered SVG or native flowchart card as a high-resolution PNG image
   */
  const handleDownloadImage = () => {
    const targetEl = containerRef.current || fallbackRef.current;
    if (!targetEl) return;

    const svgEl = targetEl.querySelector('svg');
    setIsDownloading(true);

    try {
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const blobURL = window.URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
          const bbox = svgEl.getBoundingClientRect();
          const width = Math.max(bbox.width || 1200, 1200) * 2;
          const height = Math.max(bbox.height || 600, 600) * 2;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);

            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.fillStyle = isDark ? '#10b981' : '#059669';
            ctx.fillText(title || 'Paradigm Operational Flowsheet', 30, 45);

            ctx.font = '14px Inter, sans-serif';
            ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
            ctx.fillText('Generated by Paradigm Assist • Zero-Hallucination Operations Manual', 30, height - 25);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `paradigm-schematic-${Date.now()}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
          }

          window.URL.revokeObjectURL(blobURL);
          setIsDownloading(false);
        };

        image.onerror = () => setIsDownloading(false);
        image.src = blobURL;
      } else {
        // Fallback: copy code text if rasterization unsupported
        navigator.clipboard.writeText(code);
        setIsDownloading(false);
      }
    } catch (e) {
      console.error('[Mermaid] Download error:', e);
      setIsDownloading(false);
    }
  };

  const fallbackSteps = extractFallbackSteps(code);

  return (
    <div
      className={`my-4 rounded-2xl overflow-hidden border border-emerald-500/30 dark:border-emerald-500/20 bg-white dark:bg-slate-950 shadow-md ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-slate-900 border-emerald-500 shadow-2xl' : ''
      } ${className}`}
    >
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-emerald-50/80 dark:bg-slate-900/90 border-b border-emerald-100 dark:border-slate-800 text-xs gap-2">
        {/* Left: Title & Tabs */}
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {title || 'Operational Process Flow'}
          </span>

          {/* View Mode Tabs */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-300 dark:border-slate-700 ml-1">
            {isWastewaterTreatment && (
              <button
                onClick={() => setActiveTab('schematic')}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'schematic'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Engineering P&ID Schematic with complete liquid and sludge lines (Samples 2, 3, 4, 5)"
              >
                <Layers className="w-3 h-3" />
                <span>P&ID Flowsheet</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('flowchart')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors flex items-center gap-1 ${
                activeTab === 'flowchart'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Mermaid Vector Flowchart"
            >
              <GitBranch className="w-3 h-3" />
              <span>Diagram</span>
            </button>

            <button
              onClick={() => setActiveTab('steps')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors ${
                activeTab === 'steps'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sequential Step Cards"
            >
              Steps
            </button>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Orientation Toggle (Horizontal LR vs Vertical TD) */}
          {activeTab === 'flowchart' && (
            <button
              onClick={() => setOrientation(o => (o === 'LR' ? 'TD' : 'LR'))}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 font-medium text-[11px] transition-colors"
              title={orientation === 'LR' ? 'Switch to Vertical Flow (TD)' : 'Switch to Horizontal Flow (LR) - Wide Format'}
            >
              {orientation === 'LR' ? (
                <>
                  <MoveHorizontal className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Horizontal</span>
                </>
              ) : (
                <>
                  <MoveVertical className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Vertical</span>
                </>
              )}
            </button>
          )}

          {/* Fit to Frame Toggle */}
          {activeTab === 'flowchart' && (
            <button
              onClick={() => setFitToFrame(f => !f)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border font-medium text-[11px] transition-colors ${
                fitToFrame
                  ? 'bg-emerald-100/70 dark:bg-emerald-950/70 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title={fitToFrame ? 'Fit to Frame active: Entire diagram scaled to fit without clipping' : 'Scrollable full size'}
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{fitToFrame ? 'Fit Frame' : 'Full Size'}</span>
            </button>
          )}

          {/* Zoom controls (if fullscreen) */}
          {isFullscreen && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-slate-700 mx-1" />
            </>
          )}

          {/* Download Image Button */}
          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-xs text-[11px]"
            title="Download this flowchart as a high-resolution PNG image"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Exporting...' : 'Save as Image (PNG)'}</span>
          </button>

          {/* Copy Diagram Code */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="Copy diagram source"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setZoom(1);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diagram Canvas Body */}
      {activeTab === 'schematic' && isWastewaterTreatment ? (
        <div className="p-3 md:p-4">
          <IndustrialProcessSchematic title={title} onSaveImage={handleDownloadImage} />
        </div>
      ) : activeTab === 'steps' || useFallback ? (
        /* Native Visual Connected Flowchart Cards */
        <div ref={fallbackRef} className="w-full p-4 py-6 space-y-3">
          <div className="flex flex-col items-center gap-2 max-w-xl mx-auto">
            {fallbackSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-emerald-500/40 shadow-xs hover:border-emerald-500 transition-colors">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs md:text-sm">
                    {step}
                  </span>
                </div>
                {idx < fallbackSteps.length - 1 && (
                  <div className="flex items-center justify-center text-emerald-500 py-0.5">
                    <ArrowDown className="w-5 h-5 animate-pulse" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        /* Mermaid Vector Flowchart */
        <div
          ref={containerRef}
          className={`transition-all ${
            isFullscreen
              ? 'flex-1 overflow-auto p-8 flex items-center justify-center'
              : fitToFrame
              ? 'w-full min-h-[160px] max-h-[500px] p-3 md:p-5 flex items-center justify-center overflow-hidden'
              : 'w-full min-h-[160px] max-h-[700px] p-4 md:p-6 overflow-auto flex items-center justify-center'
          }`}
          style={isFullscreen ? { transform: `scale(${zoom})`, transformOrigin: 'center' } : undefined}
        >
          {svgHtml ? (
            <div
              className={`w-full flex justify-center items-center transition-all ${
                fitToFrame
                  ? '[&_svg]:max-w-full [&_svg]:max-h-[460px] [&_svg]:w-auto [&_svg]:h-auto [&_svg]:object-contain mx-auto'
                  : '[&_svg]:max-w-none [&_svg]:w-auto [&_svg]:h-auto mx-auto'
              }`}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-10">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Rendering visual diagram...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
