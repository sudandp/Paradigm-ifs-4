import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LogOut, ShieldCheck, Lock } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

const LogoutPage: React.FC = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuthStore();
    const { isMobile } = useDevice();

    const handleConfirmLogout = async () => {
        await logout();
        navigate('/auth/login', { replace: true });
    };

    const handleCancel = () => {
        navigate(-1);
    };

    const getInitials = () => {
        if (user?.name) {
            return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return '?';
    };

    /* ───────── MOBILE ───────── */
    if (isMobile) {
        return (
            <div className="w-full flex flex-col items-center">
                <style>{`
                    @keyframes lo-orbit{0%{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                    @keyframes lo-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
                    @keyframes lo-particle1{0%,100%{transform:translate(0,0) scale(1);opacity:.55}50%{transform:translate(10px,-14px) scale(1.35);opacity:1}}
                    @keyframes lo-particle2{0%,100%{transform:translate(0,0) scale(1);opacity:.35}50%{transform:translate(-12px,-9px) scale(.75);opacity:.75}}
                    @keyframes lo-particle3{0%,100%{transform:translate(0,0) scale(1);opacity:.45}50%{transform:translate(7px,12px) scale(1.2);opacity:.85}}
                `}</style>

                {/* ── Visual Illustration ── */}
                <div className="relative mb-5 flex items-center justify-center" style={{ width: 96, height: 96 }}>
                    {/* Rotating dashed orbit */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ border: '1.5px dashed rgba(251,191,36,0.2)', animation: 'lo-orbit 22s linear infinite' }}
                    />
                    {/* Particles */}
                    <div className="absolute -top-0.5 right-3 w-[7px] h-[7px] rounded-full bg-emerald-400/50" style={{ animation: 'lo-particle1 4.5s ease-in-out infinite' }} />
                    <div className="absolute bottom-2 -left-1 w-[5px] h-[5px] rounded-full bg-amber-400/40" style={{ animation: 'lo-particle2 5.5s ease-in-out infinite' }} />
                    <div className="absolute top-5 -right-1.5 w-[4px] h-[4px] rounded-full bg-teal-300/35" style={{ animation: 'lo-particle3 3.8s ease-in-out infinite' }} />
                    {/* Center icon */}
                    <div
                        className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.15) 100%)',
                            border: '1px solid rgba(251,191,36,0.2)',
                            boxShadow: '0 8px 28px rgba(245,158,11,0.12)',
                            animation: 'lo-float 4.5s ease-in-out infinite',
                        }}
                    >
                        <LogOut className="h-6 w-6 text-amber-400" />
                    </div>
                </div>

                {/* ── User Identity ── */}
                {user && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3 max-w-full">
                        {/* Avatar */}
                        {user.photoUrl ? (
                            <img src={user.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[9px] font-black text-white shadow-sm">
                                {getInitials()}
                            </div>
                        )}
                        <div className="flex flex-col min-w-0">
                            {user.name && <span className="text-[11px] text-white/70 font-bold truncate leading-tight">{user.name}</span>}
                            <span className="text-[10px] text-white/40 font-medium truncate leading-tight">{user.email}</span>
                        </div>
                        {/* Active dot */}
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] ml-auto flex-shrink-0" />
                    </div>
                )}

                <p className="text-white/30 text-[11px] text-center leading-relaxed mb-5 max-w-[250px]">
                    Your preferences and data will be saved for when you return.
                </p>

                {/* Divider */}
                <div className="w-3/4 h-px mb-5" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

                {/* ── Actions ── */}
                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={handleCancel}
                        className="h-12 text-[13px] font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-xl active:scale-[0.97] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        No, Keep Me Signed In
                    </button>
                    <button
                        onClick={handleConfirmLogout}
                        className="h-11 text-xs font-bold text-red-400/70 bg-transparent border border-red-500/15 hover:border-red-500/30 hover:bg-red-500/[0.06] rounded-xl active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                    </button>
                </div>

                {/* Security footer */}
                <div className="flex items-center gap-1.5 mt-6 opacity-25">
                    <Lock className="w-3 h-3 text-white" />
                    <span className="text-[9px] text-white font-medium tracking-[0.12em] uppercase">Encrypted & Secure</span>
                </div>
            </div>
        );
    }

    /* ───────── DESKTOP ───────── */
    return (
        <div className="w-full flex flex-col items-center">
            <style>{`
                @keyframes lo-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
                .lo-btn-primary{position:relative;overflow:hidden}
                .lo-btn-primary::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 50%,transparent 100%);background-size:200% 100%;animation:lo-shimmer 3.5s ease-in-out infinite}
            `}</style>

            {/* ═══════ USER IDENTITY CARD ═══════ */}
            {user && (
                <div className="flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-gray-50/70 border border-gray-100 mb-5 max-w-full">
                    {/* Avatar */}
                    {user.photoUrl ? (
                        <img src={user.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[11px] font-black text-white shadow-sm shadow-emerald-200">
                            {getInitials()}
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        {user.name && (
                            <span className="text-[13px] text-gray-700 font-bold truncate leading-tight">{user.name}</span>
                        )}
                        <span className="text-[11px] text-gray-400 font-medium truncate leading-tight">{user.email}</span>
                    </div>
                    {/* Active session badge */}
                    <div className="flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 flex-shrink-0">
                        <div className="w-[6px] h-[6px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Active</span>
                    </div>
                </div>
            )}

            {/* ═══════ REASSURING MESSAGE ═══════ */}
            <p className="text-gray-400 text-[13px] text-center leading-relaxed mb-8 max-w-[360px] font-medium">
                Your preferences and data will be safely preserved. You can sign back in anytime to pick up where you left off.
            </p>

            {/* Gradient divider */}
            <div className="w-4/5 h-px mb-7" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)' }} />

            {/* ═══════ PREMIUM BUTTONS ═══════ */}
            <div className="flex flex-col w-full gap-3">
                {/* Primary — Stay Logged In */}
                <button
                    onClick={handleCancel}
                    className="lo-btn-primary group w-full h-[52px] rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-[13px] font-black tracking-wide transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/25 active:scale-[0.97] flex items-center justify-center gap-2.5"
                >
                    <ShieldCheck className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity relative z-10" />
                    <span className="relative z-10">No, Keep Me Signed In</span>
                </button>
                {/* Secondary — Sign Out */}
                <button
                    onClick={handleConfirmLogout}
                    className="group w-full h-[52px] rounded-2xl border-2 border-gray-200 hover:border-red-200 bg-white hover:bg-red-50/40 text-gray-400 hover:text-red-500 text-[13px] font-bold tracking-wide transition-all duration-300 active:scale-[0.97] flex items-center justify-center gap-2.5"
                >
                    <LogOut className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    Sign Out
                </button>
            </div>

            {/* ═══════ SECURITY ASSURANCE ═══════ */}
            <div className="flex items-center gap-2 mt-8">
                <Lock className="w-3.5 h-3.5 text-gray-250" style={{ color: '#c4c9cf' }} />
                <span className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#c4c9cf' }}>Encrypted & Secure Session</span>
            </div>
        </div>
    );
};

export default LogoutPage;
