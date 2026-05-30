import React, { useMemo } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { useDevice } from '../../hooks/useDevice';
import Logo from '../ui/Logo';
import ReferralModal from '../modals/ReferralModal';
import FireworksBackground from '../ui/FireworksBackground';

const AuthLayout: React.FC = () => {
    const { isMobile } = useDevice();
    const { setReferralModalOpen } = useUiSettingsStore(); // still used by mobile view
    const location = useLocation();

    const pageInfo = useMemo(() => {
        const path = location.pathname;
        if (path.includes('signup')) return { title: 'Create Account', subtitle: 'Join the Paradigm family today.' };
        if (path.includes('forgot-password')) return { title: 'Reset Password', subtitle: 'Enter your email to receive instructions.' };
        if (path.includes('update-password')) return { title: 'New Password', subtitle: 'Create a secure new password for your account.' };
        if (path.includes('logout')) return { title: 'Log Out', subtitle: 'We\'ll keep everything ready for your return.' };
        return { title: 'Sign In', subtitle: 'Enter your credentials to access your account.' };
    }, [location.pathname]);

    if (isMobile) {
        return (
            <div className="min-h-screen min-h-[100dvh] font-sans flex flex-col justify-between pt-10 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 px-[calc(1rem+env(safe-area-inset-left))] px-[calc(1rem+env(safe-area-inset-right))] relative overflow-y-auto bg-white">
                {/* Background for Mobile - clean gradient screen with a subtle green glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" style={{ zIndex: 0 }}></div>

                {/* Animated Festive Fireworks Backdrop */}
                <FireworksBackground />

                {/* Stable Header Brand Logo at the top on all pages */}
                <div className="relative z-10 w-full flex justify-center pt-2 pb-4">
                    <Logo className="w-[70%] max-w-[280px] h-auto object-contain" variant="original" />
                </div>

                {/* Center Container: Card only */}
                <div className="relative z-10 w-full max-w-[min(95vw,420px)] flex-grow flex flex-col items-center justify-center mx-auto pb-6">
                    {/* Mobile Dark Card */}
                    <div className="w-full bg-[#111a16] rounded-3xl p-6 shadow-2xl border border-[#202f29] text-left">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-tight">{pageInfo.title}</h2>
                            <p className="text-white/60 text-sm font-medium leading-relaxed">{pageInfo.subtitle}</p>
                        </div>

                        <div className="auth-form-outlet leading-normal">
                            <Outlet />
                        </div>
                    </div>
                </div>

                {/* Footer Links and Copyright outside the card - sitting at the absolute bottom */}
                <div className="text-center space-y-2 mt-8 w-full relative z-20 pb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-bold">
                        © Paradigm FMS Services. All rights reserved.
                    </p>
                    <div className="flex justify-center gap-4 text-[11px] text-gray-600 font-extrabold">
                        <a href="https://sudhan-ops.github.io/paradigm-privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Privacy Policy</a>
                        <span className="text-gray-300">|</span>
                        <a href="https://sudhan-ops.github.io/paradigm-privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Terms of Service</a>
                    </div>
                </div>

                <ReferralModal />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen font-sans flex relative" style={{ background: '#ffffff' }}>
            <style>{`
                @keyframes subtle-zoom {
                    0% { transform: scale(1) translate(0px, 0px); }
                    50% { transform: scale(1.08) translate(15px, -10px); }
                    100% { transform: scale(1.03) translate(-10px, 5px); }
                }
                @keyframes float-glow-1 {
                    0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.8; }
                    50% { transform: translate(20px, -20px) scale(1.1); opacity: 0.95; }
                }
                @keyframes float-glow-2 {
                    0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.6; }
                    50% { transform: translate(-30px, 20px) scale(0.9); opacity: 0.8; }
                }
                @keyframes float-glow-3 {
                    0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.7; }
                    50% { transform: translate(15px, 30px) scale(1.15); opacity: 0.9; }
                }
                .animate-subtle-zoom {
                    animation: subtle-zoom 15s ease-in-out infinite alternate;
                }
                .animate-float-glow-1 {
                    animation: float-glow-1 7s ease-in-out infinite alternate;
                }
                .animate-float-glow-2 {
                    animation: float-glow-2 9s ease-in-out infinite alternate;
                }
                .animate-float-glow-3 {
                    animation: float-glow-3 8s ease-in-out infinite alternate;
                }
            `}</style>

            {/* === LEFT PANEL: White Form Area === */}
            <div className="relative z-20 flex flex-col items-start justify-start h-full overflow-y-auto pt-[6vh] pb-28 hide-scrollbar" style={{ width: '50%', paddingLeft: '8%' }}>
                <div className="w-full max-w-[520px] px-4">
                    {/* Floating Logo (No background card, full container width) */}
                    <div className="mb-6 flex justify-start">
                        <Logo className="!w-full !h-auto max-w-[280px] object-contain transition-all duration-300 hover:scale-[1.01]" variant="original" />
                    </div>

                    {/* Title */}
                    <h2 className="font-poppins font-black text-gray-900 text-[32px] tracking-tight leading-tight mb-2">{pageInfo.title}</h2>
                    {pageInfo.subtitle ? (
                        <p className="font-poppins text-gray-400 text-[13px] font-medium mb-6">{pageInfo.subtitle}</p>
                    ) : (
                        <div className="h-4" />
                    )}

                    {/* Form outlet */}
                    <div className="auth-form-outlet mt-[4vh]">
                        <Outlet />
                    </div>
                </div>
            </div>

            {/* === RIGHT PANEL: Diagonal Emerald Polygon === */}
            <div
                className="absolute inset-y-0 right-0 w-full h-full z-10 transition-all duration-500 overflow-hidden"
                style={{
                    clipPath: 'polygon(35% 0%, 100% 0%, 100% 100%, 90% 100%)',
                }}
            >
                {/* Subtle zooming background image */}
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-subtle-zoom"
                    style={{
                        backgroundImage: 'url(/assets/auth/green_polygon_bg.png)',
                    }}
                />

                {/* Geometric overlay glow for depth */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-10 right-10 w-80 h-80 bg-emerald-300/10 rounded-full blur-[100px] animate-float-glow-1" />
                    <div className="absolute bottom-16 left-1/2 w-64 h-64 bg-teal-200/5 rounded-full blur-[80px] animate-float-glow-2" />
                    <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] rounded-full blur-[100px] animate-float-glow-3" style={{ background: 'radial-gradient(circle, rgba(0,210,180,0.15) 0%, transparent 70%)' }} />
                </div>

                {/* Welcome Back Content */}
                <div className="absolute inset-y-0 right-0 h-full flex flex-col justify-start items-end z-20 text-white text-right pt-[14vh] bg-gradient-to-l from-black/25 via-transparent to-transparent" style={{ width: '35%', paddingRight: '8%' }}>
                    {/* Main Heading */}
                    <h1
                        className="font-poppins font-black text-white leading-[0.9] tracking-tight mb-6"
                        style={{ fontSize: 'clamp(44px, 5vw, 68px)', textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
                    >
                        Welcome<br />Back.
                    </h1>

                    {/* Description */}
                    <p className="font-poppins font-light text-white/80 text-[15px] leading-relaxed max-w-[320px] drop-shadow-md">
                        Streamlining the journey for every new member of the Paradigm family.
                    </p>
                </div>
            </div>

            {/* === UNIFIED FOOTER BAR === */}
            <div className="absolute bottom-6 left-[8%] right-[18%] z-30 hidden md:flex items-center justify-between font-poppins border-t border-gray-100 pt-4">
                {/* Left: Don't have an account */}
                <div className="w-[200px]">
                    {(location.pathname === '/auth/login' || location.pathname === '/auth') ? (
                        <div className="flex flex-col items-start space-y-0.5 text-left">
                            <span className="text-[10px] text-gray-400 font-semibold">Don't have an account?</span>
                            <Link to="/auth/signup" className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors hover:underline underline-offset-2 text-[10px]">
                                Create your account
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col items-start space-y-0.5 text-left">
                            <span className="text-[10px] text-gray-400 font-semibold">Already have an account?</span>
                            <Link to="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors hover:underline underline-offset-2 text-[10px]">
                                Sign in here
                            </Link>
                        </div>
                    )}
                </div>

                {/* Center: Copyright & Legal */}
                <div className="flex flex-col items-center space-y-0.5 text-center">
                    <p className="text-[10px] text-gray-400 font-semibold">
                        © {new Date().getFullYear()} Paradigm FMS. All rights reserved.
                    </p>
                    <div className="flex justify-center gap-3 text-[10px] font-bold">
                        <a href="https://sudhan-ops.github.io/paradigm-privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 transition-colors hover:underline">Privacy Policy</a>
                        <span className="text-gray-300">|</span>
                        <a href="https://sudhan-ops.github.io/paradigm-privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 transition-colors hover:underline">Terms of Service</a>
                    </div>
                </div>

                {/* Right: Social Media Links (Monochrome gray on load, hover turns to official brand logo colors, active click scale animation) */}
                <div className="flex gap-4 items-center justify-end w-[200px]">
                    {/* Facebook */}
                    <a
                        href="https://www.facebook.com/Paradigmfms/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b5998] hover:opacity-85 transition-all duration-200 hover:scale-110 active:scale-95"
                        title="Facebook"
                    >
                        <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
                        </svg>
                    </a>
                    
                    {/* Twitter/X */}
                    <a
                        href="https://x.com/paradigm_fms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black hover:opacity-85 transition-all duration-200 hover:scale-110 active:scale-95"
                        title="Twitter"
                    >
                        <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </a>

                    {/* Instagram */}
                    <a
                        href="https://www.instagram.com/paradigmfms/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#e1306c] hover:opacity-85 transition-all duration-200 hover:scale-110 active:scale-95"
                        title="Instagram"
                    >
                        <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                    </a>

                    {/* Pinterest */}
                    <a
                        href="https://in.pinterest.com/paradigmfms/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#bd081c] hover:opacity-85 transition-all duration-200 hover:scale-110 active:scale-95"
                        title="Pinterest"
                    >
                        <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                            <path d="M12.017 0c-6.627 0-12 5.373-12 12 0 5.077 3.146 9.426 7.613 11.17-.105-.945-.199-2.399.041-3.431.218-.937 1.408-5.965 1.408-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.204 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.162 0 7.398 2.966 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
                        </svg>
                    </a>

                    {/* LinkedIn */}
                    <a
                        href="https://www.linkedin.com/company/paradigmfms/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0077b5] hover:opacity-85 transition-all duration-200 hover:scale-110 active:scale-95"
                        title="LinkedIn"
                    >
                        <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                    </a>
                </div>
            </div>

            <ReferralModal />
        </div>
    );
};

export default AuthLayout;