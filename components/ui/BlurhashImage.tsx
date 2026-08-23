import React, { useState, useEffect, useRef, useMemo } from 'react';
import { renderBlurhashToCanvas, generateDeterministicBlurhash, isValidBlurhash } from '../../utils/blurhash';
import { getProxyUrl } from '../../utils/fileUrl';

export interface BlurhashImageProps {
  src?: string | null;
  alt?: string;
  blurhash?: string | null;
  seed?: string;
  className?: string;
  imgClassName?: string;
  fallbackSrc?: string;
  fallbackIcon?: React.ReactNode;
  aspectRatio?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onLoad?: () => void;
  onError?: () => void;
}

export const BlurhashImage: React.FC<BlurhashImageProps> = ({
  src,
  alt = '',
  blurhash,
  seed,
  className = '',
  imgClassName = '',
  fallbackSrc,
  fallbackIcon,
  aspectRatio,
  onClick,
  onLoad,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Compute the effective blurhash: use provided blurhash, or fallback to deterministic hash from seed/src
  const effectiveBlurhash = useMemo(() => {
    if (isValidBlurhash(blurhash)) return blurhash!;
    if (seed) return generateDeterministicBlurhash(seed);
    if (src) return generateDeterministicBlurhash(src);
    return generateDeterministicBlurhash('placeholder');
  }, [blurhash, seed, src]);

  // Render the blurhash onto the canvas whenever effectiveBlurhash changes
  useEffect(() => {
    if (canvasRef.current && effectiveBlurhash) {
      renderBlurhashToCanvas(effectiveBlurhash, canvasRef.current, 32, 32);
    }
  }, [effectiveBlurhash]);

  // Resolve proxy URL if applicable
  const resolvedSrc = useMemo(() => {
    if (!src) return null;
    if (
      src.startsWith('http') ||
      src.startsWith('https') ||
      src.startsWith('data:') ||
      src.startsWith('/api/') ||
      src.startsWith('./') ||
      src.startsWith('blob:')
    ) {
      return getProxyUrl(src);
    }
    return src;
  }, [src]);

  // Reset loading state when resolvedSrc changes
  useEffect(() => {
    if (!resolvedSrc) {
      setIsLoaded(false);
      setHasError(false);
      return;
    }

    setIsLoaded(false);
    setHasError(false);

    const img = new Image();
    img.src = resolvedSrc;
    img.onload = () => {
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
    };
    img.onerror = () => {
      setIsLoaded(false);
      setHasError(true);
      onError?.();
    };
  }, [resolvedSrc, onLoad, onError]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* 1. BlurHash Canvas Placeholder (Instant Zero-Latency Render) */}
      <canvas
        ref={canvasRef}
        width={32}
        height={32}
        className={`absolute inset-0 w-full h-full object-cover transform scale-110 blur-[6px] transition-opacity duration-500 ease-out pointer-events-none ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden="true"
      />

      {/* 2. High-Resolution Image with Cross-Fade Transition */}
      {resolvedSrc && !hasError && (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ease-in ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
          loading="lazy"
        />
      )}

      {/* 3. Fallback state on error or missing image */}
      {hasError && fallbackSrc && (
        <img
          src={fallbackSrc}
          alt={alt}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      )}

      {hasError && !fallbackSrc && fallbackIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 text-muted">
          {fallbackIcon}
        </div>
      )}
    </div>
  );
};

export default BlurhashImage;
