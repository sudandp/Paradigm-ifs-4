import React from 'react';
import { useLogoStore } from '../../store/logoStore';
import { originalDefaultLogoBase64 } from './logoData';

type LogoVariant = 'white' | 'bottle-green';

interface LogoProps {
    className?: string;
    localPath?: string;
    variant?: LogoVariant;
}

const Logo: React.FC<LogoProps> = ({ className = '', localPath, variant = 'white' }) => {
    const logo = useLogoStore((state) => state.currentLogo);
    const src = localPath || logo;
    // CSS filters to re-color the logo image dynamically.
    // 'white': turns black then inverts to white.
    // 'bottle-green': turns black then colorizes to a rich dark forest/bottle green matching brand context.
    const filterStyle = variant === 'white' 
        ? { filter: 'brightness(0) invert(1)' }
        : { filter: 'brightness(0) invert(16%) sepia(91%) saturate(1915%) hue-rotate(135deg) brightness(85%) contrast(105%)' };

    return (
        <img
            src={src}
            alt="Paradigm Logo"
            style={filterStyle}
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
