import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, RefreshCw, Loader2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../../utils/fileUrl';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const touchStateRef = useRef<{
    initialDist: number;
    initialZoom: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    isPinching: boolean;
    isPanning: boolean;
  }>({
    initialDist: 0,
    initialZoom: 1,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    isPinching: false,
    isPanning: false,
  });

  const mouseStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  if (!isOpen) return null;

  const resolvedUrl = getProxyUrl(imageUrl);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.35, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.35, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleOpenViewer = () => {
    const cleanName = getCleanFilename(title || imageUrl);
    const params = new URLSearchParams({
      url: resolvedUrl,
      title: cleanName
    });
    onClose();
    navigate(`/document-viewer?${params.toString()}`);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = `${title || 'document'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Touch handlers for pinch & pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStateRef.current.initialDist = dist;
      touchStateRef.current.initialZoom = zoom;
      touchStateRef.current.isPinching = true;
      touchStateRef.current.isPanning = false;
      setIsDragging(true);
    } else if (e.touches.length === 1) {
      touchStateRef.current.startX = e.touches[0].clientX;
      touchStateRef.current.startY = e.touches[0].clientY;
      touchStateRef.current.startPanX = pan.x;
      touchStateRef.current.startPanY = pan.y;
      touchStateRef.current.isPanning = true;
      touchStateRef.current.isPinching = false;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStateRef.current.isPinching && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStateRef.current.initialDist > 0) {
        const factor = dist / touchStateRef.current.initialDist;
        setZoom(Math.min(4, Math.max(0.5, Number((touchStateRef.current.initialZoom * factor).toFixed(2)))));
      }
    } else if (touchStateRef.current.isPanning && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - touchStateRef.current.startX;
      const deltaY = e.touches[0].clientY - touchStateRef.current.startY;
      setPan({
        x: Math.round(touchStateRef.current.startPanX + deltaX),
        y: Math.round(touchStateRef.current.startPanY + deltaY),
      });
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.isPinching = false;
    touchStateRef.current.isPanning = false;
    setIsDragging(false);
  };

  // Mouse handlers for desktop pan
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStateRef.current.isDown = true;
    mouseStateRef.current.startX = e.clientX;
    mouseStateRef.current.startY = e.clientY;
    mouseStateRef.current.startPanX = pan.x;
    mouseStateRef.current.startPanY = pan.y;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStateRef.current.isDown) return;
    const deltaX = e.clientX - mouseStateRef.current.startX;
    const deltaY = e.clientY - mouseStateRef.current.startY;
    setPan({
      x: Math.round(mouseStateRef.current.startPanX + deltaX),
      y: Math.round(mouseStateRef.current.startPanY + deltaY),
    });
  };

  const handleMouseUp = () => {
    mouseStateRef.current.isDown = false;
    setIsDragging(false);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-between bg-black/92 backdrop-blur-md p-3 sm:p-6 select-none animate-in fade-in duration-200" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ touchAction: 'none' }}
    >
      {/* Top Header Toolbar */}
      <div 
        className="w-full max-w-5xl flex items-center justify-between py-2 px-4 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 text-white z-20 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
            {title || 'Document Preview'}
          </span>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={handleZoomOut}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleRotate}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleReset}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Reset Zoom & Rotation"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block"></div>
          <button 
            onClick={handleDownload}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors hidden sm:flex cursor-pointer"
            title="Download Image"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleOpenViewer}
            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors hidden sm:flex cursor-pointer"
            title="Open in Full Document Viewer"
          >
            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <div className="h-5 w-px bg-white/20 mx-1"></div>
          <button 
            onClick={onClose} 
            className="p-2 bg-rose-600/80 hover:bg-rose-600 rounded-xl text-white transition-colors cursor-pointer"
            aria-label="Close image preview"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage with Pinch & Pan Gestures */}
      <div 
        className="flex-1 w-full flex items-center justify-center overflow-hidden my-3 relative cursor-grab active:cursor-grabbing" 
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Loading preview...</span>
          </div>
        )}

        {hasError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-900/60 rounded-2xl border border-white/10 max-w-sm">
            <FileText className="w-12 h-12 text-slate-500 mb-2" />
            <p className="text-sm font-semibold text-slate-200">Document preview unavailable</p>
            <p className="text-xs text-slate-400 mt-1">You can still view it in the full document viewer.</p>
            <button 
              type="button" 
              onClick={handleOpenViewer} 
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg"
            >
              <ExternalLink className="w-4 h-4" /> Open Full Viewer
            </button>
          </div>
        ) : (
          <img 
            src={resolvedUrl} 
            alt={title || "Document Preview"} 
            draggable={false}
            className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none will-change-transform ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.12s ease-out, opacity 0.2s ease-in',
            }}
            onLoad={() => {
              setIsLoading(false);
              setHasError(false);
            }}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}
      </div>

      {/* Mobile Footer with Extra Actions */}
      <div 
        className="sm:hidden w-full flex items-center justify-center gap-3 py-2 px-4 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 text-white z-20"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={handleDownload}
          className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button 
          onClick={handleOpenViewer}
          className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Full Page
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ImagePreviewModal;
