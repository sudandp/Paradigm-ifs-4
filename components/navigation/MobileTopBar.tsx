import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';
import { allNavLinks } from '../layouts/MainLayout';

export interface MobileTopBarProps {
  /**
   * Title badge displayed on the right of the bar (e.g. 'LETTER TEMPLATES')
   */
  title: string;
  /**
   * Destination path when Back is clicked.
   * If not set or explicitly '/mobile-home', MobileTopBar automatically
   * resolves to the relevant MobileHome category sub-menu (e.g. '/mobile-home?category=HRM+Portal').
   */
  parentPath?: string;
  /**
   * Optional custom click handler to override default navigation.
   */
  onBack?: () => void;
  /**
   * Additional custom styling classes.
   */
  className?: string;
}

/**
 * Standardized Mobile Top Navigation Bar for Dark Mode Mobile Pro App.
 * Automatically returns null on web/desktop viewports (no web app impact).
 * Non-floating, fixed-flow layout matching MobileHome category screens.
 */
export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  title,
  parentPath = '/mobile-home',
  onBack,
  className = ''
}) => {
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const location = useLocation();

  // ONLY render for mobile pro app, never on desktop web app
  if (!isMobile) {
    return null;
  }

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    // 1. If an explicit sub-page parent path was passed (and is NOT just root '/mobile-home'), honor it
    if (parentPath && parentPath !== '/mobile-home') {
      navigate(parentPath);
      return;
    }

    // 2. Automatically resolve the relevant MobileHome category sub-menu
    const currentPath = location.pathname;
    const navEntry = allNavLinks.find(link => {
      const linkPath = link.to.split('?')[0];
      return currentPath === linkPath || currentPath.startsWith(linkPath + '/');
    });

    if (navEntry?.category) {
      navigate(`/mobile-home?category=${encodeURIComponent(navEntry.category)}`);
      return;
    }

    // 3. Fallback
    navigate('/mobile-home');
  };

  return (
    <div
      className={`flex items-center gap-3 mb-4 w-full ${className}`}
    >
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer shrink-0"
        aria-label="Go back"
      >
        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Back</span>
      </button>
      <div className="h-[1px] flex-1 bg-[#134426]" />
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426] truncate max-w-[200px] shrink-0">
        {title}
      </span>
    </div>
  );
};

export default MobileTopBar;
