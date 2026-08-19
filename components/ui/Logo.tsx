import React from 'react';
import { useLogoStore } from '../../store/logoStore';
import { useAuthStore } from '../../store/authStore';
import { originalDefaultLogoBase64 } from './logoData';

type LogoVariant = 'white' | 'bottle-green' | 'original';

export interface LogoProps {
    className?: string;
    localPath?: string;
    variant?: LogoVariant;
    companyName?: string;
}

/**
 * Resolves the appropriate company logo URL based on company / society name.
 * - 'South Wall' / 'Southwall' -> '/South-Wall-Logo.jpg'
 * - 'Paradigm' / Default -> '/paradigm-logo.png'
 */
export const getCompanyLogo = (companyName?: string | null): string => {
    if (!companyName) return '/paradigm-logo.png';
    const lower = companyName.toLowerCase();
    if (lower.includes('south wall') || lower.includes('southwall') || lower.includes('south-wall')) {
        return '/South-Wall-Logo.png';
    }
    return '/paradigm-logo.png';
};

const Logo: React.FC<LogoProps> = ({ className = '', localPath, variant = 'white', companyName }) => {
    const customLogo = useLogoStore((state) => state.currentLogo);
    const user = useAuthStore((state) => state.user);
    const lastCompany = useAuthStore((state) => state.lastCompany);

    // Determine company name from prop or logged in user's assigned company (societyName / organizationName)
    const effectiveCompany = companyName || user?.societyName || user?.organizationName || lastCompany || '';
    const isSouthWall = effectiveCompany.toLowerCase().includes('south wall') || 
                        effectiveCompany.toLowerCase().includes('southwall') || 
                        effectiveCompany.toLowerCase().includes('south-wall');

    const defaultCompanyLogo = getCompanyLogo(effectiveCompany);

    let baseSrc = localPath || defaultCompanyLogo;
    
    // Add cache buster to handle updates to the same filename
    const src = `${baseSrc}?v=1.0.3`;

    // CSS filters to re-color the logo image dynamically.
    // 'white': turns black then inverts to white.
    // 'bottle-green': turns black then colorizes to a rich dark forest/bottle green matching brand context.
    const getFilterStyle = () => {
        if (variant === 'original') return {};
        if (isSouthWall) {
            if (variant === 'white') return { filter: 'brightness(0) invert(1)' };
            return {};
        }
        if (variant === 'white') return { filter: 'brightness(0) invert(1)' };
        return { filter: 'brightness(0) invert(16%) sepia(91%) saturate(1915%) hue-rotate(135deg) brightness(85%) contrast(105%)' };
    };

    return (
        <img
            src={src}
            alt={isSouthWall ? "South Wall Logo" : "Paradigm Logo"}
            style={getFilterStyle()}
            className={`object-contain transition-all duration-500 ${!className.includes('h-') ? 'h-10' : ''} ${!className.includes('w-') ? 'w-auto' : ''} ${className}`}
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== defaultCompanyLogo) {
                     target.src = defaultCompanyLogo;
                }
            }}
        />
    );
};

export default Logo;
