import { Capacitor } from '@capacitor/core';
import { useMediaQuery } from './useMediaQuery';
import { MOBILE_BREAKPOINT } from '../utils/breakpoints';

export const useDevice = () => {
  const isWidthMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const isWidthTablet = useMediaQuery(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: 1024px)`);
  const isWidthDesktop = useMediaQuery('(min-width: 1025px)');

  // Native mobile platforms (Android/iOS) or mobile userAgents should always qualify for mobile experience
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const isMobileUserAgent = typeof navigator !== 'undefined' && /Android|iPhone|iPod/i.test(navigator.userAgent);
  
  // If native app or mobile phone userAgent, prioritize mobile layout regardless of orientation/screen density
  const isMobile = isNative ? (isWidthMobile || !isWidthDesktop) : isWidthMobile;
  const isTablet = isNative ? isWidthTablet : (!isMobile && isWidthTablet);
  const isDesktop = !isNative && isWidthDesktop;
  const isWeb = !isNative;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWeb,
    isNative,
    breakpoint: MOBILE_BREAKPOINT
  };
};
