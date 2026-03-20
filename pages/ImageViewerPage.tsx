import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ArrowLeft } from 'lucide-react';

const ImageViewerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const imageUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Image Preview';
  
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title || 'image';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!imageUrl) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-lg">No image to display</p>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        
        <h1 className="text-white text-sm font-medium truncate max-w-[200px] sm:max-w-none">
          {decodeURIComponent(title)}
        </h1>
        
        <button
          onClick={handleBack}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image Container */}
      <div 
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        style={{ touchAction: 'manipulation' }}
      >
        <img
          src={imageUrl}
          alt={decodeURIComponent(title)}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <button
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className="p-3 text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        
        <span className="text-white text-sm font-medium min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        
        <button
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="p-3 text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        
        <div className="w-px h-6 bg-white/20 mx-2" />
        
        <button
          onClick={handleRotate}
          className="p-3 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Rotate"
        >
          <RotateCw className="h-5 w-5" />
        </button>
        
        <button
          onClick={handleDownload}
          className="p-3 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Download"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ImageViewerPage;
