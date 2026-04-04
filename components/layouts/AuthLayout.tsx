import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Logo from '../ui/Logo';
import { useAuthLayoutStore } from '../../store/authLayoutStore';
import { useDevice } from '../../hooks/useDevice';

const AuthLayout: React.FC = () => {
    const { isMobile } = useDevice();
    const location = useLocation();

    const pageInfo = useMemo(() => {
        const path = location.pathname;
        if (path.includes('signup')) return { title: 'Create Account', subtitle: 'Join the Paradigm family today.' };
        if (path.includes('forgot-password')) return { title: 'Reset Password', subtitle: 'Enter your email to receive instructions.' };
        if (path.includes('update-password')) return { title: 'New Password', subtitle: 'Create a secure new password for your account.' };
        if (path.includes('logout')) return { title: 'Log Out', subtitle: 'Are you sure you want to sign out?' };
        return { title: 'Sign In', subtitle: 'Enter your credentials to access your account.' };
    }, [location.pathname]);

    if (isMobile) {
        return (
            <div className="min-h-screen font-sans flex items-center justify-center py-6 px-2 relative overflow-auto bg-page">
                {/* Background for Mobile */}
                <div className="fixed inset-0 w-full h-full">
                    <img src="/assets/auth/office-background.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-sm auth-bg-overlay"></div>
                </div>

                {/* Mobile Dark Glassmorphic Card (Shrunk Mode) — Centered Logo + Left Header */}
                <div className="relative z-10 w-full max-w-[310px] bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 pt-5 pb-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)] auth-card-container text-left">
                    <div className="flex justify-center mb-3">
                        <Logo className="h-[30px] opacity-100" />
                    </div>
                    
                    <div className="text-left mb-3.5">
                        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">{pageInfo.title}</h2>
                        <p className="text-white/70 text-[11px] font-medium leading-relaxed">{pageInfo.subtitle}</p>
                    </div>

                    <div className="auth-form-outlet leading-normal">
                        <Outlet />
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans flex items-center justify-center bg-gray-100 relative overflow-hidden">
            {/* Desktop Background */}
            <div className="fixed inset-0 w-full h-full">
                <img src="/assets/auth/office-background.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
            </div>

            {/* Desktop Split-Layout Card */}
            <div className="relative w-full max-w-5xl p-6 flex items-center justify-center">
                <div className="w-full grid md:grid-cols-[1fr_1.15fr] rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden bg-white">
                    {/* Left Brand Panel */}
                    <div className="flex flex-col justify-between p-12 bg-[#041b0f] relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>

                        <div className="relative z-10">
                            <Logo className="h-10 brightness-0 invert" />
                            <div className="mt-24">
                                <h1 className="text-4xl font-bold text-white leading-tight">
                                    Welcome to the Future of Onboarding.
                                </h1>
                                <p className="text-emerald-100/60 mt-6 max-w-xs text-base">
                                    Streamlining the journey for every new member of the Paradigm family.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <p className="text-emerald-100/30 text-xs uppercase tracking-widest font-bold">
                                Paradigm Evolution 2026
                            </p>
                        </div>
                    </div>

                    {/* Right Interaction Panel */}
                    <div className="p-16 flex flex-col justify-center bg-white">
                        <div className="w-full max-w-sm mx-auto">
                            <h2 className="text-4xl font-bold text-gray-900 mb-2">{pageInfo.title}</h2>
                            <p className="text-gray-500 mb-10 text-base font-medium">{pageInfo.subtitle}</p>
                            
                            <div className="auth-form-outlet">
                                <Outlet />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default AuthLayout;