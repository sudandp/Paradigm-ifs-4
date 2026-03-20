import React from 'react';
import { useLogoStore } from '../../store/logoStore';
import { originalDefaultLogoBase64 } from './logoData';

const Logo: React.FC<{ className?: string; localPath?: string }> = ({ className = '', localPath }) => {
    const logo = useLogoStore((state) => state.currentLogo);
    const src = localPath || logo;
    return (
        <img
            src={src}
            alt="Paradigm Logo"
            className={`w-auto object-contain ${!className.includes('h-') && 'h-10'} ${className}`}
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
