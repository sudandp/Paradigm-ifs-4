import React from 'react';
import { useLogoStore } from '../../store/logoStore';
import { originalDefaultLogoBase64 } from './logoData';

type LogoVariant = 'white' | 'bottle-green' | 'original';

interface LogoProps {
    className?: string;
    localPath?: string;
    variant?: LogoVariant;
}

const Logo: React.FC<LogoProps> = ({ className = '', localPath, variant = 'white' }) => {
    const logo = useLogoStore((state) => state.currentLogo);
    const baseSrc = localPath || (logo === originalDefaultLogoBase64 ? '/paradigm-logo.png' : logo);
    
    // Add cache buster to handle updates to the same filename
    const src = `${baseSrc}?v=1.0.1`;

    // CSS filters to re-color the logo image dynamically.
    // 'white': turns black then inverts to white.
    // 'bottle-green': turns black then colorizes to a rich dark forest/bottle green matching brand context.
    const getFilterStyle = () => {
        if (variant === 'original') return {};
        if (variant === 'white') return { filter: 'brightness(0) invert(1)' };
        return { filter: 'brightness(0) invert(16%) sepia(91%) saturate(1915%) hue-rotate(135deg) brightness(85%) contrast(105%)' };
    };

    return (
        <img
            src={src}
            alt="Paradigm Logo"
            style={getFilterStyle()}
            className={`w-auto object-contain transition-all duration-500 ${!className.includes('h-') && 'h-10'} ${className}`}
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                // prevent infinite loop if default also fails
                if (target.src !== originalDefaultLogoBase64) {
                     target.src = originalDefaultLogoBase64;
                }
            }}
        />
    );
};

export default Logo;
