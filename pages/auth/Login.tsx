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
import { useDeviceFingerprint } from '../../hooks/useDeviceFingerprint';
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
                    <fieldset disabled={isFormDisabled} className="space-y-6">
                        <Input
                            id="email-mob"
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            icon={<Mail className="h-5 w-5 text-white/50" />}
                            registration={registerEmail('email')}
                            error={emailErrors.email?.message}
                            className="!text-[16px] !bg-white/[0.06] !text-white !border-white/10 focus:!border-emerald-500/40 focus:!ring-0 !rounded-2xl !py-4 transition-all placeholder:!text-white/35"
                        />

                        <Input
                            id="password-mob"
                            type="password"
                            placeholder="Password/PIN"
                            autoComplete="current-password"
                            icon={<Lock className="h-5 w-5 text-white/50" />}
                            registration={registerEmail('password')}
                            error={emailErrors.password?.message}
                            className="!text-[16px] !bg-white/[0.06] !text-white !border-white/10 focus:!border-emerald-500/40 focus:!ring-0 !rounded-2xl !py-4 transition-all placeholder:!text-white/35"
                        />

                        <div className="flex items-center justify-between px-1 mt-2">
                            <label className="flex items-center gap-3 cursor-pointer group select-none">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        {...registerEmail('rememberMe')}
                                    />
                                    <div className="h-5 w-5 rounded-md border border-white/20 bg-white/5 transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500 group-hover:border-emerald-500/50"></div>
                                    <Check className="absolute inset-0 h-5 w-5 text-white scale-0 transition-transform peer-checked:scale-100 p-0.5" />
                                </div>
                                <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">Remember me</span>
                            </label>
                            <Link
                                to="/auth/forgot-password"
                                className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
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
                        className="w-full !font-black !h-14 !rounded-2xl !text-[16px] transition-all !bg-emerald-600 hover:!bg-emerald-500 !text-white active:scale-[0.98] !shadow-[0_12px_24px_rgba(5,150,105,0.3)] signin-btn mt-4"
                        isLoading={loading && !isSuccess}
                        disabled={isFormDisabled && !isSuccess}
                    >
                        {isSuccess ? <Check className="w-6 h-6" /> : "Sign In to Account"}
                    </Button>
                </form>

                <div className="mt-6">
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/20"></div>
                        </div>
                        <div className="relative flex justify-center text-[12px] uppercase tracking-widest">
                            <span className="bg-[#041b0f] px-4 text-white/50 font-bold">Secure Access</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleGoogleLogin()}
                            className="w-full !h-14 !rounded-2xl !border-white/10 !bg-white/5 !text-white hover:!bg-white/10 transition-all !text-base font-bold flex items-center justify-center gap-3 google-btn"
                        >
                            <div className="bg-white p-1.5 rounded-lg">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            </div>
                            <span>Sign in with Google</span>
                        </Button>
                    </div>

                    <div className="mt-8 text-center space-y-4">
                        <p className="text-[13px] text-white/50">
                            Don't have an account?{' '}
                            <Link to="/auth/signup" className="font-bold text-emerald-400 hover:underline decoration-emerald-400/30 underline-offset-4 transition-all">
                                Create Account
                            </Link>
                        </p>
                        <div className="pt-4 border-t border-white/10">
                            <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-wider">
                                © Paradigm FMS Services. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- WEB VIEW (100% Match Target UI) ---
    return (
        <>
            <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-6">
                <fieldset disabled={isFormDisabled} className="space-y-6">
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors pointer-events-none" />
                        <Input
                            id="email-web"
                            type="email"
                            placeholder="admin@paradigmfms.com"
                            registration={registerEmail('email')}
                            error={emailErrors.email?.message}
                            className="!pl-12 text-base !bg-white !text-gray-900 !border-gray-200 focus:!border-emerald-600 focus:!ring-1 focus:!ring-emerald-600/20 !rounded-2xl !py-4 transition-all"
                        />
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors pointer-events-none" />
                        <Input
                            id="password-web"
                            type="password"
                            placeholder="••••••••"
                            registration={registerEmail('password')}
                            error={emailErrors.password?.message}
                            className="!pl-12 text-base !bg-white !text-gray-900 !border-gray-200 focus:!border-emerald-600 focus:!ring-1 focus:!ring-emerald-600/20 !rounded-2xl !py-4 transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <Checkbox
                            id="rememberMe-web"
                            label="Remember me"
                            labelClassName="text-gray-600 text-sm font-medium"
                            {...registerEmail('rememberMe')}
                            inputClassName="text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                        <Link
                            to="/auth/forgot-password"
                            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                            Forgot your password?
                        </Link>
                    </div>
                </fieldset>

                {error && (
                    <div className="flex items-center gap-3 text-sm text-red-600 p-4 bg-red-50 rounded-2xl border border-red-100">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <Button
                    type="submit"
                    className={`w-full !font-bold !py-5 !rounded-2xl shadow-xl shadow-emerald-600/10 transition-all transform hover:scale-[1.01] active:scale-[0.99] ${isSuccess
                        ? '!bg-emerald-500 !text-white'
                        : '!bg-emerald-600 !text-white hover:!bg-emerald-700'
                        }`}
                    isLoading={loading && !isSuccess}
                    disabled={isFormDisabled && !isSuccess}
                >
                    {isSuccess ? <Check className="w-8 h-8" /> : "Sign In"}
                </Button>
            </form>

            <div className="mt-12">
                <div className="flex items-center my-10">
                    <div className="flex-1 border-t border-gray-100"></div>
                    <span className="px-4 text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">OR</span>
                    <div className="flex-1 border-t border-gray-100"></div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-bold py-4 rounded-2xl transition-all shadow-sm"
                    disabled={isFormDisabled}
                >
                    {commonGoogleIcon}
                    Sign in with Google
                </button>

                <div className="text-center mt-12 space-y-6">
                    <p className="text-sm text-gray-500 font-medium">
                        Don't have an account?{' '}
                        <Link to="/auth/signup" className="text-emerald-600 hover:text-emerald-700 font-bold ml-1">Sign Up</Link>
                    </p>
                    <div className="pt-6 border-t border-gray-100">
                        <p className="text-[11px] text-gray-400 leading-relaxed uppercase tracking-widest font-medium">
                            © Paradigm FMS Services. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
