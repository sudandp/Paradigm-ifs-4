import React, { useEffect, useState, useRef } from 'react';

export interface AuthFlipCardProps {
    isFlipped: boolean;
    front: React.ReactNode;
    back: React.ReactNode;
    className?: string;
    variant?: 'dark' | 'light';
}

export const AuthFlipCard: React.FC<AuthFlipCardProps> = ({
    isFlipped,
    front,
    back,
    className = '',
    variant = 'dark',
}) => {
    const isDark = variant === 'dark';
    const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);
    const frontRef = useRef<HTMLDivElement>(null);
    const backRef = useRef<HTMLDivElement>(null);

    // Dynamic height measurement so neither card face is clipped
    useEffect(() => {
        const updateHeight = () => {
            const frontHeight = frontRef.current?.offsetHeight || 0;
            const backHeight = backRef.current?.offsetHeight || 0;
            const targetHeight = isFlipped ? backHeight : frontHeight;
            if (targetHeight > 0) {
                setCardHeight(targetHeight);
            }
        };

        updateHeight();
        const timer = setTimeout(updateHeight, 100);
        window.addEventListener('resize', updateHeight);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateHeight);
        };
    }, [isFlipped, front, back]);

    return (
        <div className={`perspective-1200 w-full relative select-none ${className}`}>
            <div
                className={`auth-card-flipper relative w-full transition-all duration-700 ${
                    isFlipped ? 'rotate-y-180' : ''
                }`}
                style={{
                    height: cardHeight ? `${cardHeight}px` : 'auto',
                    transition: 'transform 0.75s cubic-bezier(0.68, -0.55, 0.265, 1.55), height 0.3s ease',
                }}

            >
                {/* FRONT FACE: Sign In */}
                <div
                    ref={frontRef}
                    className={`w-full backface-hidden absolute inset-x-0 top-0 transition-opacity duration-300 ${
                        isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                >
                    {front}
                </div>

                {/* BACK FACE: Create Account */}
                <div
                    ref={backRef}
                    className={`w-full backface-hidden rotate-y-180 absolute inset-x-0 top-0 transition-opacity duration-300 ${
                        !isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                >
                    {back}
                </div>
            </div>
        </div>
    );
};

export default AuthFlipCard;
