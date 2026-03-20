import { useMediaQuery } from './useMediaQuery';
import { MOBILE_BREAKPOINT } from '../utils/breakpoints';

export const useDevice = () => {
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const isTablet = useMediaQuery(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: 1024px)`);
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isWeb = useMediaQuery(`(min-width: ${MOBILE_BREAKPOINT}px)`);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWeb,
    breakpoint: MOBILE_BREAKPOINT
  };
};
