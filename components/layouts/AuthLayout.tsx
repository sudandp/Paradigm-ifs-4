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
            <div className="min-h-screen font-sans flex items-center justify-center p-6 relative overflow-hidden bg-page">
                {/* Background for Mobile */}
                <div className="fixed inset-0 w-full h-full">
                    <img src="/assets/auth/office-background.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl"></div>
                </div>

                {/* Mobile Dark Glassmorphic Card */}
                <div className="relative z-10 w-full max-w-sm bg-black/70 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.8)] auth-card-container">
                    <div className="flex justify-center mb-12">
                        <Logo className="h-10 opacity-100" />
                    </div>
                    
                    <div className="text-center mb-10 px-2 leading-relaxed">
                        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">{pageInfo.title}</h2>
                        <p className="text-white/80 text-sm font-medium">{pageInfo.subtitle}</p>
                    </div>

                    <div className="auth-form-outlet leading-normal">
                        <Outlet />
                    </div>

                    <p className="mt-12 text-center text-white/30 text-[10px] font-bold tracking-[0.3em] uppercase">
                        Paradigm Evolution 2026
                    </p>
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