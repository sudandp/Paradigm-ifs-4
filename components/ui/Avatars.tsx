import React from 'react';

const DefaultAvatar: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`flex items-center justify-center overflow-hidden ${className || 'w-full h-full'}`}
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(16,185,129,0.2) 0%, rgba(4,27,15,0.6) 100%)' }}
    >
        {/* Inline SVG user silhouette — never breaks, no external dependency */}
        <svg
            viewBox="0 0 24 24"
            className="w-[60%] h-[60%] select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <circle cx="12" cy="8" r="4" fill="rgba(16,185,129,0.75)" />
            <path
                d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
                stroke="rgba(16,185,129,0.75)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    </div>
);

export const Avatars = [DefaultAvatar];
