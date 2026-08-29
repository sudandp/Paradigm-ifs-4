import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, RefreshCw } from 'lucide-react';
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
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleOpenViewer = () => {
    const proxyUrl = getProxyUrl(imageUrl);
    const cleanName = getCleanFilename(title || imageUrl);
    const params = new URLSearchParams({
      url: proxyUrl,
      title: cleanName
    });
    onClose();
    navigate(`/document-viewer?${params.toString()}`);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getProxyUrl(imageUrl);
    link.download = `${title || 'document'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/90 backdrop-blur-md p-3 sm:p-6 select-none animate-fade-in" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Toolbar */}
      <div 
        className="w-full max-w-5xl flex items-center justify-between py-2 px-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 text-white z-10 shadow-xl"
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
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-400 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleRotate}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleReset}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Reset Zoom & Rotation"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block"></div>
          <button 
            onClick={handleDownload}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors hidden sm:flex"
            title="Download Image"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button 
            onClick={handleOpenViewer}
            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors hidden sm:flex"
            title="Open in Full Document Viewer"
          >
            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <div className="h-5 w-px bg-white/20 mx-1"></div>
          <button 
            onClick={onClose} 
            className="p-2 bg-rose-600/80 hover:bg-rose-600 rounded-xl text-white transition-colors"
            aria-label="Close image preview"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="flex-1 w-full flex items-center justify-center overflow-hidden my-4" 
        onClick={e => e.stopPropagation()}
      >
        <img 
          src={getProxyUrl(imageUrl)} 
          alt={title || "Document Preview"} 
          className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            cursor: zoom > 1 ? 'grab' : 'default'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (imageUrl && !target.dataset.triedFallback) {
              target.dataset.triedFallback = 'true';
              if (imageUrl.startsWith('/api/view-file/')) {
                const path = imageUrl.replace(/^\/api\/view-file\//, '');
                target.src = `https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/${path}`;
                return;
              } else if (!imageUrl.startsWith('http') && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
                target.src = `https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/onboarding-documents/${imageUrl}`;
                return;
              }
            }
            target.src = 'https://placehold.co/600x400?text=Failed+to+load+document';
          }}
        />
      </div>

      {/* Mobile Footer with Extra Actions */}
      <div 
        className="sm:hidden w-full flex items-center justify-center gap-3 py-2 px-4 bg-slate-900/80 rounded-xl border border-white/10 text-white z-10"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={handleDownload}
          className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button 
          onClick={handleOpenViewer}
          className="px-3 py-1.5 bg-emerald-600/80 rounded-lg text-xs font-bold flex items-center gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Full Page
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
