import React from 'react';

const DefaultAvatar: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`w-full h-full flex items-center justify-center overflow-hidden ${className || ''}`}
        style={{ background: 'radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, rgba(4,27,15,0.5) 100%)' }}
    >
        <img
            src="/paradigm-correct-logo.png"
            alt="Paradigm"
            className="w-[62%] h-[62%] object-contain select-none"
            style={{ filter: 'brightness(0) invert(60%) sepia(60%) saturate(500%) hue-rotate(110deg) brightness(90%) contrast(110%)' }}
            draggable={false}
        />
    </div>
);

export const Avatars = [DefaultAvatar];
