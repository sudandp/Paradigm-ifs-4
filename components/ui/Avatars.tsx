import React from 'react';

const DefaultAvatar: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`w-full h-full flex items-center justify-center bg-emerald-50/40 border border-emerald-100/30 overflow-hidden ${className || ''}`}>
        <img
            src="/paradigm-correct-logo.png"
            alt="Default Profile"
            className="w-[68%] h-[68%] object-contain"
            style={{ filter: 'brightness(0) invert(26%) sepia(74%) saturate(600%) hue-rotate(110deg) brightness(80%) contrast(105%)' }}
        />
    </div>
);

export const Avatars = [DefaultAvatar];

