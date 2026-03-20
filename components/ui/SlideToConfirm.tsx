import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

interface SlideToConfirmProps {
  onConfirm: () => void;
  isActionInProgress: boolean;
  text: string;
  confirmText: string;
  slideDirection: 'left' | 'right';
  className?: string;
  thumbClassName?: string;
}

const SlideToConfirm: React.FC<SlideToConfirmProps> = ({
  onConfirm,
  isActionInProgress,
  text,
  confirmText,
  slideDirection,
  className = '',
  thumbClassName = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  // Calculate the initial position based on slide direction
  const getInitialPosition = useCallback(() => {
    if (!sliderRef.current || !thumbRef.current) return 0;
    if (slideDirection === 'left') {
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const thumbRect = thumbRef.current.getBoundingClientRect();
      return sliderRect.width - thumbRect.width - 8; // 8px for padding
    }
    return 0;
  }, [slideDirection]);

  const snapBack = useCallback(() => {
    const initialPos = getInitialPosition();
    if (thumbRef.current) {
      thumbRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), scale 0.2s ease';
      thumbRef.current.style.transform = `translateX(${initialPos}px) scale(1)`;
    }
    setPosition(initialPos);
    setIsDragging(false);
  }, [getInitialPosition]);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isActionInProgress || isConfirmed) return;
    setIsDragging(true);
    startXRef.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    if (thumbRef.current) {
      thumbRef.current.style.transition = 'none';
      thumbRef.current.style.transform = `translateX(${position}px) scale(1.1)`;
    }
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !sliderRef.current || !thumbRef.current) return;
    const sliderRect = sliderRef.current.getBoundingClientRect();
    const thumbRect = thumbRef.current.getBoundingClientRect();

    const deltaX = clientX - startXRef.current;
    const maxTravel = sliderRect.width - thumbRect.width - 8; // 8px padding
    const initialPos = getInitialPosition();

    let newPosition;
    if (slideDirection === 'right') {
      // Slide from left (0) to right (maxTravel)
      newPosition = Math.max(0, Math.min(deltaX, maxTravel));
    } else { // 'left'
      // Slide from right (initialPos which is maxTravel) to left (0)
      // We need to subtract deltaX from the initial position
      // When dragging left, deltaX is negative, so initialPos + deltaX moves left
      newPosition = Math.max(0, Math.min(initialPos + deltaX, maxTravel));
    }

    setPosition(newPosition);
    thumbRef.current.style.transform = `translateX(${newPosition}px) scale(1.1)`;
  }, [isDragging, slideDirection, getInitialPosition]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || !sliderRef.current || !thumbRef.current) return;
    setIsDragging(false);
    const sliderRect = sliderRef.current.getBoundingClientRect();
    const thumbRect = thumbRef.current.getBoundingClientRect();
    const maxTravel = sliderRect.width - thumbRect.width - 8;
    const threshold = maxTravel * 0.5; // 50% threshold

    let confirmed = false;
    if (slideDirection === 'right') {
      // For right slide: position should be > threshold (moved far enough right)
      confirmed = position > threshold;
    } else { // 'left'
      // For left slide: position should be < (maxTravel - threshold) (moved far enough left from the right)
      confirmed = position < (maxTravel - threshold);
    }

    if (confirmed) {
      setIsConfirmed(true);
      onConfirm();
    } else {
      snapBack();
    }
  }, [isDragging, position, onConfirm, slideDirection, snapBack]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (!isActionInProgress && isConfirmed) {
      setIsConfirmed(false);
      snapBack();
    }
  }, [isActionInProgress, isConfirmed, snapBack]);

  // Set initial position when component mounts or direction changes
  useEffect(() => {
    const initialPos = getInitialPosition();
    setPosition(initialPos);
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translateX(${initialPos}px) scale(1)`;
    }
  }, [slideDirection, getInitialPosition]);

  const showSuccess = isConfirmed && !isActionInProgress;
  const initialPos = getInitialPosition();
  const isAtInitialPosition = Math.abs(position - initialPos) < 5; // Allow 5px tolerance

  return (
    <div
      ref={sliderRef}
      className={`fo-slider ${className} ${showSuccess ? 'success' : ''}`}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      <div
        ref={thumbRef}
        className={`fo-slider-thumb ${thumbClassName} transition-all duration-200 ease-out shadow-md`}
      >
        {isActionInProgress && isConfirmed ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : slideDirection === 'right' ? (
          <ChevronRight className="h-6 w-6" />
        ) : (
          <ChevronLeft className="h-6 w-6" />
        )}
      </div>
      <span className={`fo-slider-text ${!isAtInitialPosition || (isActionInProgress && isConfirmed) ? 'opacity-0' : 'opacity-100'}`}>{text}</span>
      <span className={`fo-slider-text absolute transition-opacity duration-300 ${isActionInProgress && isConfirmed ? 'opacity-100' : 'opacity-0'}`}>{confirmText}</span>
    </div>
  );
};

export default SlideToConfirm;