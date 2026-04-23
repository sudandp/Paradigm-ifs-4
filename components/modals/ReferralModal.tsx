import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { UserPlus, Building2, ArrowRight, X, Sparkles } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

const referralOptions = [
    {
        id: 'employee',
        title: 'Employee Referral',
        description: 'Refer a candidate for our internal team or field operations.',
        icon: UserPlus,
        gradient: 'from-[#006b3f] to-[#005632]',
        glowColor: 'rgba(0, 107, 63, 0.25)',
        badgeLabel: 'Team',
        route: '/referral/employee'
    },
    {
        id: 'business',
        title: 'Business Referral',
        description: 'Refer a company or organization looking for FM services.',
        icon: Building2,
        gradient: 'from-[#0a4a28] to-[#041b0f]',
        glowColor: 'rgba(4, 27, 15, 0.4)',
        badgeLabel: 'FM Services',
        route: '/referral/business'
    }
];

const ReferralModal: React.FC = () => {
    const { isReferralModalOpen, setReferralModalOpen } = useUiSettingsStore();
    const { isMobile } = useDevice();
    const navigate = useNavigate();
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) setReferralModalOpen(false);
    };

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isReferralModalOpen) setReferralModalOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isReferralModalOpen, setReferralModalOpen]);

    // Lock body scroll when open
    useEffect(() => {
        if (isReferralModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isReferralModalOpen]);

    if (!isReferralModalOpen) return null;

    const handleOptionClick = (route: string) => {
        setReferralModalOpen(false);
        navigate(route);
    };

    return (
        <div
            className="fixed inset-0 z-[999] flex items-end md:items-center justify-center referral-backdrop"
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
            aria-label="Referral Program"
        >
            {/* Glassmorphic backdrop */}
            <div className="absolute inset-0 referral-bg-blur" />

            {/* Modal panel */}
            <div
                ref={dialogRef}
                className={`referral-panel relative w-full ${isMobile ? 'referral-panel--mobile' : 'max-w-md mx-4 referral-panel--desktop'}`}
            >
                {/* Decorative top glow */}
                <div className="referral-top-glow" aria-hidden="true" />

                {/* Header */}
                <div className="referral-header">
                    <div className="referral-header-icon" aria-hidden="true">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="referral-eyebrow">Paradigm Services</p>
                        <h2 className="referral-title">Referral Program</h2>
                    </div>
                    <button
                        onClick={() => setReferralModalOpen(false)}
                        className="referral-close-btn"
                        aria-label="Close referral modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Subtitle */}
                <p className="referral-subtitle">
                    Help us grow! Choose a referral type below. Your contribution helps Paradigm reach new heights.
                </p>

                {/* Option cards */}
                <div className="referral-cards">
                    {referralOptions.map((option, index) => (
                        <button
                            key={option.id}
                            id={`referral-option-${option.id}`}
                            onClick={() => handleOptionClick(option.route)}
                            className="referral-card"
                            style={{ animationDelay: `${0.1 + index * 0.08}s` }}
                        >
                            {/* Icon with gradient slab */}
                            <div
                                className={`referral-card-icon bg-gradient-to-br ${option.gradient}`}
                                style={{ boxShadow: `0 8px 24px ${option.glowColor}` }}
                                aria-hidden="true"
                            >
                                <option.icon className="h-5 w-5 text-white" strokeWidth={1.75} />
                            </div>

                            {/* Text block */}
                            <div className="referral-card-body">
                                <div className="referral-card-top-row">
                                    <span className="referral-card-title">{option.title}</span>
                                    <span className="referral-card-badge">{option.badgeLabel}</span>
                                </div>
                                <p className="referral-card-desc">{option.description}</p>
                            </div>

                            {/* Arrow CTA */}
                            <div className="referral-card-arrow" aria-hidden="true">
                                <ArrowRight className="h-4 w-4" />
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="referral-footer">
                    <button
                        onClick={() => setReferralModalOpen(false)}
                        className="referral-cancel-btn"
                    >
                        Cancel &amp; Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReferralModal;
