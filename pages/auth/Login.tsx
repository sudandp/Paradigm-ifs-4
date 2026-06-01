import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { secureGet } from '../../utils/secureStorage';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { InferType } from 'yup';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Checkbox from '../../components/ui/Checkbox';
import { useAuthStore } from '../../store/authStore';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { useDeviceFingerprint } from '../../hooks/useDeviceFingerprint';
import SkyShotFireworks from '../../components/ui/SkyShotFireworks';
import type { User } from '../../types';
import { Mail, Lock, AlertTriangle, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useDevice } from '../../hooks/useDevice';

const emailValidationSchema = yup.object({
    email: yup.string().email('Must be a valid email').required('Email is required'),
    password: yup.string()
        .min(4, 'Password/Passcode must be at least 4 characters')
        .required('Required'),
    rememberMe: yup.boolean().optional(),
}).defined();

type EmailFormInputs = InferType<typeof emailValidationSchema>;

const getHomeRoute = (user: User) => {
    if (user.role === 'unverified') return "/pending-approval";
    return "/profile";
};

const Login: React.FC = () => {
    const { user, loginWithPasscode, loginWithGoogle, error, setError, loading, setLoginAnimationPending, isLoginAnimationPending } = useAuthStore();
    const { setReferralModalOpen } = useUiSettingsStore();
    const navigate = useNavigate();
    const location = useLocation();
    const { isMobile } = useDevice();
    const { deviceInfo, isNewDevice, previousDevice } = useDeviceFingerprint();
    const [deviceAlertSent, setDeviceAlertSent] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        setError(null);
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const errorCode = hashParams.get('error_code');
        if (errorCode === 'otp_expired') {
            setError("Email confirmation link has expired. Please try signing up again.");
            navigate('/auth/login', { replace: true });
        }
    }, [setError, location, navigate]);

    useEffect(() => {
        if (user && isNewDevice && previousDevice && !deviceAlertSent) {
            api.sendDeviceChangeAlert(user.id, user.name, previousDevice.deviceName, deviceInfo?.deviceName || 'Unknown Device')
               .catch(err => console.error('Failed to send device change alert:', err));
            setDeviceAlertSent(true);
        }
    }, [user, isNewDevice, previousDevice, deviceAlertSent, deviceInfo]);

    useEffect(() => {
        if (user && !isLoginAnimationPending) {
            navigate(getHomeRoute(user), { replace: true });
        }
    }, [user, navigate, isLoginAnimationPending]);

    const { register: registerEmail, handleSubmit: handleEmailSubmit, setValue, formState: { errors: emailErrors } } = useForm<EmailFormInputs>({
        resolver: yupResolver(emailValidationSchema) as unknown as Resolver<EmailFormInputs>,
    });

    useEffect(() => {
        const checkRememberedEmail = async () => {
            // [SECURITY] Read encrypted email; fall back to legacy plaintext key for backward compatibility.
            const email = (await secureGet('rememberedEmail'))
                ?? (await Preferences.get({ key: 'rememberedEmail' })).value;
            const { value: pass } = await Preferences.get({ key: 'rememberedPassword' });
            if (email) { setValue('email', email); setValue('rememberMe', true); }
            if (pass) { setValue('password', pass); setValue('rememberMe', true); }
        };
        checkRememberedEmail();
        if (isMobile) setValue('rememberMe', true);
    }, [setValue, isMobile]);

    const onEmailSubmit: SubmitHandler<EmailFormInputs> = async (data) => {
        setLoginAnimationPending(true);
        const shouldRemember = isMobile ? true : (data.rememberMe || false);
        const result = await loginWithPasscode(data.email, data.password, shouldRemember);

        if (result.error) {
            setLoginAnimationPending(false);
        } else {
            setIsSuccess(true);
            setTimeout(() => setLoginAnimationPending(false), 1500);
        }
    };

    const handleGoogleLogin = async () => {
        await loginWithGoogle();
    };

    const isFormDisabled = loading || isSuccess;

    const commonGoogleIcon = (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );

    // --- MOBILE VIEW ---
    if (isMobile) {
        return (
            <div className="w-full">
                <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-5">
                    <fieldset disabled={isFormDisabled} className="space-y-5">
                        <Input
                            id="email-mob"
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            icon={<Mail className="h-5 w-5 text-white/40" />}
                            registration={registerEmail('email')}
                            error={emailErrors.email?.message}
                            className="!text-[16px] !bg-[#131d1a] !text-white !border-[#20312a] focus:!border-emerald-500/50 focus:!ring-0 !rounded-2xl !py-4.5 transition-all placeholder:!text-white/30"
                        />

                        <Input
                            id="password-mob"
                            type="password"
                            placeholder="Password/PIN"
                            autoComplete="current-password"
                            icon={<Lock className="h-5 w-5 text-white/40" />}
                            registration={registerEmail('password')}
                            error={emailErrors.password?.message}
                            className="!text-[16px] !bg-[#131d1a] !text-white !border-[#20312a] focus:!border-emerald-500/50 focus:!ring-0 !rounded-2xl !py-4.5 transition-all placeholder:!text-white/30"
                        />

                        <div className="flex items-center justify-between px-1 mt-2">
                            <label className="flex items-center gap-3 cursor-pointer group select-none">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        {...registerEmail('rememberMe')}
                                    />
                                    <div className="h-5 w-5 rounded-md border border-[#20312a] bg-[#131d1a] transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500 group-hover:border-emerald-500/50"></div>
                                    <Check className="absolute inset-0 h-5 w-5 text-white scale-0 transition-transform peer-checked:scale-100 p-0.5" />
                                </div>
                                <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">Remember me</span>
                            </label>
                            <Link
                                to="/auth/forgot-password"
                                className="text-sm font-bold text-[#3eff99] hover:text-[#2ae080] transition-colors"
                            >
                                Forgot Password?
                            </Link>
                        </div>
                    </fieldset>

                    {error && (
                        <div className="flex items-center gap-3 text-[13px] text-red-400 p-4 bg-red-400/10 rounded-2xl border border-red-400/20">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
                            <span className="leading-snug font-medium">{error}</span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full !font-black !h-14 !rounded-2xl !text-[16px] transition-all !bg-[#3eff99] hover:!bg-[#2ae080] !text-[#05110c] active:scale-[0.98] !shadow-[0_12px_24px_rgba(62,255,153,0.15)] signin-btn mt-4"
                        isLoading={loading && !isSuccess}
                        disabled={isFormDisabled && !isSuccess}
                    >
                        {isSuccess ? <Check className="w-6 h-6" /> : "Sign In To Account"}
                    </Button>
                </form>

                <div className="mt-6">
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#20312a]"></div>
                        </div>
                        <div className="relative flex justify-center text-[11px] uppercase tracking-[0.2em] font-bold">
                            <span className="bg-[#111a16] px-4 text-white/40">Secure Access</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleGoogleLogin()}
                            className="w-full !h-14 !rounded-2xl !border-[#20312a] !bg-[#131d1a] !text-white hover:!bg-[#19221f] transition-all !text-base font-bold flex items-center justify-center gap-3 google-btn"
                        >
                            {commonGoogleIcon}
                            <span>Sign in with Google</span>
                        </Button>
                    </div>

                    <div className="mt-8 text-center space-y-4">
                        <p className="text-[13px] text-white/50">
                            Don't have an account?{' '}
                            <Link to="/auth/signup" className="font-bold text-[#3eff99] hover:text-[#2ae080] transition-colors">
                                Create Account
                            </Link>
                        </p>
                        
                        {/* Premium Referral Strip — Mobile */}
                        <div className="relative mt-2 rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-r from-[#0a1610] to-[#060e0a] hover:border-emerald-500/40 transition-all duration-300">
                            <SkyShotFireworks />
                            <button
                                type="button"
                                onClick={() => setReferralModalOpen(true)}
                                className="relative z-10 w-full flex items-center justify-between gap-3 px-4 py-3.5"
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black text-[#3eff99] tracking-wider uppercase font-poppins flex items-center gap-1.5">
                                        <span>🎇</span> Referral Program
                                    </p>
                                    <p className="text-[10px] text-white/40 mt-0.5 font-medium">Earn rewards — refer candidates &amp; leads!</p>
                                </div>
                                <div className="flex items-center shrink-0">
                                    <span className="px-3 py-1 bg-black text-white font-bold uppercase text-[8px] tracking-wider rounded-full border-2 border-white ring-1 ring-black/20 shadow-sm relative z-0">
                                        REFERRAL
                                    </span>
                                    <span className="-ml-2 px-3 py-1 bg-[#ff0000] text-white font-bold uppercase text-[8px] tracking-wider rounded-full border-2 border-white ring-1 ring-black/20 shadow-sm relative z-10">
                                        PROGRAM
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- WEB VIEW — Diagonal Split Panel Form ---
    return (
        <>
            <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-5">
                <fieldset disabled={isFormDisabled} className="space-y-4">
                    {/* Username / Email Field — rounded box style */}
                    <div>
                        <Input
                            id="email-web"
                            type="email"
                            placeholder="Username"
                            icon={<Mail className="h-5 w-5 text-gray-400" />}
                            registration={registerEmail('email')}
                            error={emailErrors.email?.message}
                            className="!text-[15px] !bg-gray-50/50 hover:!bg-gray-50/80 focus:!bg-white !text-gray-800 !border !border-gray-200 focus:!border-emerald-500 focus:!shadow-[0_0_0_4px_rgba(16,185,129,0.15)] hover:border-gray-300 !rounded-[12px] !py-3 transition-all placeholder:!text-gray-400 !shadow-sm focus:!ring-0"
                        />
                    </div>

                    {/* Password Field — rounded box style */}
                    <div>
                        <Input
                            id="password-web"
                            type="password"
                            placeholder="Password"
                            icon={<Lock className="h-5 w-5 text-gray-400" />}
                            registration={registerEmail('password')}
                            error={emailErrors.password?.message}
                            className="!text-[15px] !bg-gray-50/50 hover:!bg-gray-50/80 focus:!bg-white !text-gray-800 !border !border-gray-200 focus:!border-emerald-500 focus:!shadow-[0_0_0_4px_rgba(16,185,129,0.15)] hover:border-gray-300 !rounded-[12px] !py-3 transition-all placeholder:!text-gray-400 !shadow-sm focus:!ring-0"
                        />
                    </div>

                    {/* Remember Me + Forgot Password */}
                    <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-3 cursor-pointer group select-none">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    id="rememberMe-web"
                                    className="peer sr-only"
                                    {...registerEmail('rememberMe')}
                                />
                                <div className="h-5 w-5 rounded-md border border-gray-300 bg-white transition-all peer-checked:bg-emerald-600 peer-checked:border-emerald-600 group-hover:border-emerald-500"></div>
                                <Check className="absolute inset-0 h-5 w-5 text-white scale-0 transition-transform peer-checked:scale-100 p-0.5" />
                            </div>
                            <span className="text-gray-500 text-[14px] font-semibold group-hover:text-gray-700 transition-colors">Remember Me</span>
                        </label>
                        <Link
                            to="/auth/forgot-password"
                            className="text-[14px] font-semibold text-gray-400 hover:text-emerald-600 transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                </fieldset>

                {error && (
                    <div className="flex items-center gap-3 text-sm text-red-600 p-3 bg-red-50 rounded-xl border border-red-100">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-[15px]">{error}</span>
                    </div>
                )}

                {/* Action Buttons — equal width (50% / 50%) */}
                <div className="flex items-center gap-3 pt-4">
                    <Button
                        type="submit"
                        className={`flex-1 !font-black !h-12 !rounded-2xl !text-[13px] !tracking-[0.18em] !uppercase transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-md ${isSuccess
                            ? '!bg-emerald-500 !text-white shadow-emerald-500/30'
                            : '!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-emerald-600/25'
                            }`}
                        isLoading={loading && !isSuccess}
                        disabled={isFormDisabled && !isSuccess}
                    >
                        {isSuccess ? <Check className="w-5 h-5 mx-auto" /> : "LOGIN"}
                    </Button>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isFormDisabled}
                        className="flex-1 h-12 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-2xl transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-sm disabled:opacity-50 font-poppins whitespace-nowrap"
                        title="Sign in with Google"
                    >
                        {commonGoogleIcon}
                        <span className="text-[12px] font-semibold text-gray-700">Sign in with Google</span>
                    </button>
                </div>

                  {/* Premium Referral Strip — White Themed for Web */}
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-transparent bg-emerald-50/20 hover:bg-emerald-50/30 transition-all duration-300 cursor-pointer group/ref">
                    <SkyShotFireworks />
                    <button
                        type="button"
                        onClick={() => setReferralModalOpen(true)}
                        disabled={isFormDisabled}
                        className="relative z-10 w-full flex items-center justify-between gap-4 px-4 py-3"
                        title="Join Referral Program"
                    >
                        {/* Left: label + subtext */}
                        <div className="text-left">
                            <p className="text-[12px] font-black text-emerald-700 tracking-[0.18em] uppercase font-poppins flex items-center gap-1.5">
                                <span className="text-base">🎇</span> REFERRAL PROGRAM
                            </p>
                            <p className="text-[10px] text-emerald-800/60 mt-0.5 font-medium leading-tight">
                                Earn rewards by referring candidates o...
                            </p>
                        </div>

                        {/* Right: REFERRAL | PROGRAM overlapping capsules */}
                        <div className="flex items-center shrink-0 transition-transform group-hover/ref:scale-[1.04]">
                            <span className="px-4 py-1.5 bg-black text-white font-bold uppercase text-[10px] tracking-wider rounded-full border-2 border-white ring-1 ring-black/20 shadow-sm relative z-0">
                                REFERRAL
                            </span>
                            <span className="-ml-3 px-4 py-1.5 bg-[#ff0000] text-white font-bold uppercase text-[10px] tracking-wider rounded-full border-2 border-white ring-1 ring-black/20 shadow-sm relative z-10">
                                PROGRAM
                            </span>
                        </div>
                    </button>
                </div>
            </form>
        </>
    );
};

export default Login;
