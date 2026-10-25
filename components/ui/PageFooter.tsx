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
      {/* City Skyline Watermark Silhouette (Matching Image 1 Background) */}
      <div 
        className="absolute inset-x-0 bottom-8 h-20 opacity-[0.07] dark:opacity-[0.04] pointer-events-none select-none overflow-hidden flex items-end justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 1440 120" className="w-full h-full text-gray-900 dark:text-white fill-current shrink-0" preserveAspectRatio="none">
          {/* Repeating architectural cityscape: towers, high-rises, gables, and trees */}
          <path d="M0,120 L0,90 L25,90 L25,60 L50,60 L50,90 L65,90 L65,45 L95,45 L95,90 L115,90 L115,30 L135,15 L155,30 L155,90 L180,90 L180,70 L210,70 L210,90 L235,90 L235,50 L270,50 L270,90 L290,90 L290,35 L330,35 L330,90 L360,90 L360,75 L395,75 L395,90 L420,90 L420,20 L445,10 L470,20 L470,90 L500,90 L500,65 L530,65 L530,90 L555,90 L555,40 L595,40 L595,90 L625,90 L625,55 L660,55 L660,90 L685,90 L685,25 L710,12 L735,25 L735,90 L765,90 L765,70 L800,70 L800,90 L825,90 L825,48 L865,48 L865,90 L895,90 L895,30 L935,30 L935,90 L965,90 L965,60 L1005,60 L1005,90 L1030,90 L1030,22 L1055,10 L1080,22 L1080,90 L1110,90 L1110,68 L1145,68 L1145,90 L1175,90 L1175,42 L1215,42 L1215,90 L1245,90 L1245,55 L1280,55 L1280,90 L1305,90 L1305,28 L1330,15 L1355,28 L1355,90 L1385,90 L1385,70 L1415,70 L1415,90 L1440,90 L1440,120 Z" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Main Row: Left (Tenure Counter) & Right (ISO 27001 + DPDP Badges) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-4 border-b border-gray-100 dark:border-gray-800/60">
          
          {/* LEFT: Part of Paradigm since & Tenure (Image 1 reference) */}
          <div className="flex flex-col items-start select-none">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className="text-rose-500 text-sm leading-none animate-pulse">❤️</span>
              <span className="tracking-tight">Part of Paradigm since</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">
              {tenure}
            </div>
          </div>

          {/* RIGHT: Compliance & Certification Marks (ISO 27001 + DPDP Ready) */}
          <div className="flex items-center gap-5 sm:gap-7 self-end sm:self-center">
            
            {/* 1. ISO 27001 Certified Badge */}
            <div 
              className="flex items-center gap-2.5 group select-none transition-transform hover:scale-105" 
              title="ISO/IEC 27001: Information Security Management Certified"
            >
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                {/* ISO Globe / Grid SVG Icon */}
                <svg viewBox="0 0 100 100" className="w-11 h-11 text-[#0066b2] fill-none stroke-current" strokeWidth="2.5">
                  <circle cx="50" cy="50" r="46" strokeWidth="3" />
                  <ellipse cx="50" cy="50" rx="46" ry="18" strokeWidth="2" />
                  <ellipse cx="50" cy="50" rx="46" ry="34" strokeWidth="2" />
                  <ellipse cx="50" cy="50" rx="18" ry="46" strokeWidth="2" />
                  <ellipse cx="50" cy="50" rx="34" ry="46" strokeWidth="2" />
                  <line x1="4" y1="50" x2="96" y2="50" strokeWidth="2" />
                  <line x1="50" y1="4" x2="50" y2="96" strokeWidth="2" />
                </svg>
                {/* Center ISO Text Plaque */}
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
              {/* Biometric Shield with Lock & Concentric Ridges */}
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

        </div>

        {/* Sub-bar: Copyright, Security Notice & Legal Links */}
        <div className="pt-3 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>© {currentYear} Paradigm IFS. All rights reserved.</span>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
              Enterprise Shield
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
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
    </footer>
  );
};

export default PageFooter;
