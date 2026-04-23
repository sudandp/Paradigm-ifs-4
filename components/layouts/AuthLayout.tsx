import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthLayoutStore } from '../../store/authLayoutStore';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { useDevice } from '../../hooks/useDevice';
import Logo from '../ui/Logo';
import { ArrowRight } from 'lucide-react';
import ReferralModal from '../modals/ReferralModal';

const AuthLayout: React.FC = () => {
    const { isMobile } = useDevice();
    const { setReferralModalOpen } = useUiSettingsStore();
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
            <div className="min-h-screen min-h-[100dvh] font-sans flex flex-col items-center justify-center py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] px-4 relative overflow-y-auto" style={{ backgroundColor: '#041b0f' }}>
                {/* Background for Mobile with improved contrast overlay */}
                <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }}>
                    <img src="/assets/auth/office-background.webp" alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/80"></div>
                </div>

                <div className="relative z-10 w-full max-w-[min(95vw,420px)] flex flex-col items-center">
                    {/* Mobile Glassmorphic Card — frosted green glass over visible background */}
                    <div className="w-full bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 text-left mb-8">
                        <div className="flex justify-center mb-8">
                            <Logo className="h-14" variant="original" />
                        </div>

                        <div className="text-left mb-6">
                            <h2 className="text-[clamp(18px,4vw,22px)] font-bold text-white mb-2 tracking-tight">{pageInfo.title}</h2>
                            <p className="text-white/80 text-[clamp(13px,3.5vw,14px)] font-medium leading-relaxed">{pageInfo.subtitle}</p>
                        </div>

                        <div className="auth-form-outlet leading-normal">
                            <Outlet />
                        </div>

                        {/* Mobile Refer & Earn */}
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <button 
                                onClick={() => setReferralModalOpen(true)}
                                className="w-full flex items-center justify-between p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 active:scale-95 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="text-white font-bold text-sm">Refer & Earn Rewards</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-emerald-400" />
                            </button>
                        </div>
                    </div>
                </div>
                <ReferralModal />
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans flex items-center justify-center bg-[#020d07] relative overflow-hidden">
            {/* Premium Animated Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                    <img 
                        src="/assets/auth/office-background.png" 
                        alt="" 
                        className="w-full h-full object-cover opacity-20 mix-blend-overlay"
                    />
                </div>
            </div>

            {/* Desktop Split-Layout Card */}
            <div className="relative w-full max-w-3xl p-6 flex items-center justify-center z-10">
                <div className="w-full grid md:grid-cols-[1fr_1.15fr] rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden bg-white/95 backdrop-blur-md border border-white/10 group/main transition-all duration-700 hover:shadow-[0_50px_100px_-30px_rgba(5,150,105,0.2)]">
                    
                    {/* Left Brand Panel */}
                    <div className="flex flex-col justify-between p-8 bg-[#041b0f] relative overflow-hidden">
                        {/* Decorative Background Orbs for Left Panel */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover/main:bg-emerald-500/20 transition-all duration-1000"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full -ml-32 -mb-32 blur-3xl group-hover/main:bg-emerald-500/15 transition-all duration-1000"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div>
                                <div className="transform transition-all duration-500 hover:scale-105 origin-left">
                                    <Logo className="h-10" variant="original" />
                                </div>
                                <div className="mt-16 space-y-3">
                                    <h1 className="text-3xl font-black text-white leading-[1.1] tracking-tight animate-in fade-in slide-in-from-left-8 duration-700">
                                        Welcome to the <span className="text-emerald-500">Future</span> of Onboarding.
                                    </h1>
                                    <p className="text-emerald-100/60 max-w-xs text-sm font-medium leading-relaxed animate-in fade-in slide-in-from-left-8 duration-700 delay-100">
                                        Streamlining the journey for every new member of the Paradigm family.
                                    </p>
                                </div>
                            </div>

                            {/* Refer and Earn Section - Enhanced Design */}
                            <div className="mt-10 p-5 rounded-[1.5rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group/refer hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover/refer:bg-emerald-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-white font-black text-lg tracking-tight">Refer & Earn</h3>
                                    </div>
                                    <p className="text-emerald-100/40 text-[13px] mt-2 font-medium leading-relaxed">
                                        Help us grow and get rewarded for successful referrals.
                                    </p>
                                    <button 
                                        onClick={() => setReferralModalOpen(true)}
                                        className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-black transition-all shadow-xl shadow-emerald-900/40 active:scale-[0.98] group-hover/refer:translate-y-[-2px]"
                                    >
                                        Start Referring
                                        <ArrowRight className="w-3.5 h-3.5 group-hover/refer:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-auto pt-8 flex items-center gap-4">
                                <div className="h-[1px] flex-1 bg-emerald-500/20"></div>
                                <p className="text-emerald-100/30 text-[8px] uppercase tracking-[0.3em] font-black whitespace-nowrap">
                                    Paradigm Evolution 2026
                                </p>
                                <div className="h-[1px] flex-1 bg-emerald-500/20"></div>
                            </div>
                        </div>
                    </div>

                    {/* Right Interaction Panel */}
                    <div className="p-12 flex flex-col justify-center bg-white relative">
                        <div className="w-full max-w-[320px] mx-auto relative z-10 animate-in fade-in slide-in-from-right-8 duration-700">
                            <h2 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">{pageInfo.title}</h2>
                            <p className="text-gray-500 mb-6 text-sm font-semibold">{pageInfo.subtitle}</p>
                            
                            <div className="auth-form-outlet">
                                <Outlet />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ReferralModal />
        </div>
    );
};

export default AuthLayout;