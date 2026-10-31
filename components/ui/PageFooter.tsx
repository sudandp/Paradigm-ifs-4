import React, { useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';

interface PageFooterProps {
  className?: string;
  compact?: boolean;
}

/**
 * Calculates tenure (time elapsed) since joining or account creation.
 * Returns formatted string like "9 months", "1 year 2 months", etc.
 */
function calculateTenure(joiningDateStr?: string | null, createdAtStr?: string | null): string {
  const dateStr = joiningDateStr || createdAtStr;
  if (!dateStr) return '9 months';

  try {
    const start = new Date(dateStr);
    if (isNaN(start.getTime())) return '9 months';

    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    
    // If joined in the current month, show days
    if (months <= 0) {
      const diffMs = now.getTime() - start.getTime();
      const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
    }

    if (months < 12) {
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    }

    const years = Math.floor(months / 12);
    const remMonths = months % 12;

    if (remMonths === 0) {
      return `${years} ${years === 1 ? 'year' : 'years'}`;
    }

    return `${years} ${years === 1 ? 'yr' : 'yrs'} ${remMonths} ${remMonths === 1 ? 'month' : 'months'}`;
  } catch {
    return '9 months';
  }
}

/**
 * Global Page Footer Component
 * Displays user tenure ("Part of Paradigm since"), ISO 27001 & DPDP Ready certifications,
 * city skyline architectural watermark, and enterprise legal compliance bar.
 */
export const PageFooter: React.FC<PageFooterProps> = ({ 
  className = '',
  compact = false 
}) => {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();

  const tenure = useMemo(() => {
    return calculateTenure(user?.joiningDate, user?.createdAt);
  }, [user?.joiningDate, user?.createdAt]);

  return (
    <footer 
      className={`w-full relative mt-auto flex-shrink-0 border-t border-gray-200/90 dark:border-gray-800/80 bg-white/95 dark:bg-[#071d13]/95 backdrop-blur-md transition-colors overflow-hidden ${className}`}
      role="contentinfo"
      aria-label="Compliance and Security Footer"
    >
      {/* City Skyline Watermark Silhouette - Buildings Outline Only (Shadow Removed) */}
      <div 
        className="absolute inset-x-0 bottom-0 h-20 sm:h-24 pointer-events-none select-none overflow-hidden flex items-end justify-center opacity-15 dark:opacity-10 transition-opacity z-0"
        aria-hidden="true"
      >
        <img 
          src="/city-skyline-buildings-only.png" 
          alt="Architectural Skyline Outline" 
          className="w-full h-full object-fill object-bottom dark:invert pointer-events-none select-none"
        />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          
          {/* LEFT: Part of Paradigm since & Tenure + Copyright */}
          <div className="flex flex-col items-start gap-1 select-none">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className="text-rose-500 text-sm leading-none animate-pulse">❤️</span>
              <span className="tracking-tight">Part of Paradigm since</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {tenure}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
              <span>© {currentYear} Paradigm IFS. All rights reserved.</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                Enterprise Shield
              </span>
            </div>
          </div>

          {/* RIGHT: Compliance & Certification Marks (ISO 27001 + DPDP Ready) + Legal Links */}
          <div className="flex flex-col items-start md:items-end gap-2 self-start md:self-end">
            
            {/* Badges Row */}
            <div className="flex items-center gap-5 sm:gap-7">
              {/* 1. ISO 27001 Certified Badge */}
              <div 
                className="flex items-center gap-2.5 group select-none transition-transform hover:scale-105" 
                title="ISO/IEC 27001: Information Security Management Certified"
              >
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-11 h-11 text-[#0066b2] fill-none stroke-current" strokeWidth="2.5">
                    <circle cx="50" cy="50" r="46" strokeWidth="3" />
                    <ellipse cx="50" cy="50" rx="46" ry="18" strokeWidth="2" />
                    <ellipse cx="50" cy="50" rx="46" ry="34" strokeWidth="2" />
                    <ellipse cx="50" cy="50" rx="18" ry="46" strokeWidth="2" />
                    <ellipse cx="50" cy="50" rx="34" ry="46" strokeWidth="2" />
                    <line x1="4" y1="50" x2="96" y2="50" strokeWidth="2" />
                    <line x1="50" y1="4" x2="50" y2="96" strokeWidth="2" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[#0066b2] font-black text-xs tracking-tighter leading-none font-sans drop-shadow-[0_1px_1px_rgba(255,255,255,1)]">
                      ISO
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-tight leading-tight">
                    International Standard
                  </span>
                  <span className="text-sm font-black text-[#0066b2] tracking-wider leading-none">
                    27001
                  </span>
                  <span className="text-[8px] font-medium text-gray-400">
                    InfoSec Verified
                  </span>
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="h-10 w-px bg-gray-200 dark:bg-gray-700/80" />

              {/* 2. DPDP Ready Badge (Digital Personal Data Protection Act) */}
              <div 
                className="flex items-center gap-2.5 group select-none transition-transform hover:scale-105" 
                title="Compliant with Digital Personal Data Protection (DPDP) Act, 2023"
              >
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-11 h-11 text-[#0284c7]" fill="none">
                    <path 
                      d="M50 8 C68 16, 88 18, 88 38 C88 66, 68 86, 50 94 C32 86, 12 66, 12 38 C12 18, 32 16, 50 8 Z" 
                      stroke="currentColor" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                    <path 
                      d="M50 18 C64 24, 78 26, 78 40 C78 60, 62 76, 50 83 C38 76, 22 60, 22 40 C22 26, 36 24, 50 18 Z" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeDasharray="8 4" 
                    />
                    <path 
                      d="M50 28 C58 32, 68 34, 68 44 C68 56, 58 68, 50 72 C42 68, 32 56, 32 44 C32 34, 42 32, 50 28 Z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                    />
                    <rect x="40" y="44" width="20" height="16" rx="3" fill="currentColor" />
                    <path d="M44 44 V39 C44 35.5, 56 35.5, 56 39 V44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M46 52 L49 55 L54 48" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight leading-none">
                      DPDP Ready
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                    DIGITAL PERSONAL DATA
                  </span>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 leading-tight">
                    PROTECTION ACT
                  </span>
                </div>
              </div>

            </div>

            {/* Legal & Privacy Links */}
            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 pt-0.5">
              <a 
                href="https://sudhan-ops.github.io/paradigm-privacy-policy/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-emerald-600 transition hover:underline"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a 
                href="https://sudhan-ops.github.io/paradigm-privacy-policy/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-emerald-600 transition hover:underline"
              >
                Terms of Service
              </a>
              <span>•</span>
              <span className="text-gray-400">Data Stored in India 🇮🇳</span>
            </div>

          </div>

        </div>
      </div>
    </footer>
  );
};

export default PageFooter;
