import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
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
            const { value: email } = await Preferences.get({ key: 'rememberedEmail' });
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
        <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.487-11.181-8.264l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,35.508,44,30.021,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
        </svg>
    );

    // --- MOBILE VIEW ---
    if (isMobile) {
        return (
            <>
                <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-4">
                    <fieldset disabled={isFormDisabled} className="space-y-5">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                            <Input
                                id="email-mob"
                                type="email"
                                placeholder="Email address"
                                registration={registerEmail('email')}
                                error={emailErrors.email?.message}
                                 className="!pl-10 !text-[11px] !bg-white/[0.06] !text-white !border-white/10 focus:!border-emerald-500/40 focus:!ring-0 !rounded-xl !py-2 transition-all placeholder:!text-white/35"
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                            <Input
                                id="password-mob"
                                type="password"
                                placeholder="Password"
                                registration={registerEmail('password')}
                                error={emailErrors.password?.message}
                                className="!pl-10 !pr-12 !text-[11px] !bg-white/[0.06] !text-white !border-white/10 focus:!border-emerald-500/40 focus:!ring-0 !rounded-xl !py-2 transition-all placeholder:!text-white/35"
                            />
                        </div>
                        <div className="flex items-center justify-between px-0.5">
                            <Checkbox
                                id="rememberMe-mob"
                                label="Remember me"
                                labelClassName="text-white/70 text-[10.5px] font-medium cursor-pointer"
                                {...registerEmail('rememberMe')}
                            />
                            <Link to="/auth/forgot-password" title="Forgot password?" className="text-[10.5px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                                Forgot password?
                            </Link>
                        </div>
                    </fieldset>

                    {error && (
                        <div className="flex items-center gap-2 text-[10.5px] text-red-400 p-3 bg-red-400/10 rounded-xl border border-red-400/20">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span className="leading-tight font-semibold">{error}</span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full !font-bold !h-10 !rounded-xl !text-[12px] transition-all !bg-emerald-500 hover:!bg-emerald-600 !text-white active:scale-[0.98] !shadow-[0_4px_12px_rgba(16,185,129,0.2)] signin-btn"
                        isLoading={loading && !isSuccess}
                        disabled={isFormDisabled && !isSuccess}
                    >
                        {isSuccess ? <Check className="w-5 h-5" /> : "Sign In"}
                    </Button>
                </form>

                <div className="mt-6">
                    <div className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px bg-white/15"></div>
                        <span className="text-[9.5px] text-white/40 font-bold uppercase tracking-[0.2em]">OR</span>
                        <div className="flex-1 h-px bg-white/15"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-[#ffffff] text-[#1f1f1f] border border-[#e5e7eb] font-bold h-11 rounded-2xl hover:bg-[#f8f9fa] transition-all text-[11.5px] shadow-sm active:scale-[0.98] google-btn"
                        disabled={isFormDisabled}
                    >
                        {commonGoogleIcon}
                        Sign in with Google
                    </button>

                    <div className="text-center mt-2">
                        <p className="text-[10.5px] text-white/60 font-medium">
                            Don't have an account? <Link to="/auth/signup" className="text-emerald-400 font-bold hover:text-emerald-300 ml-0.5 transition-colors">Sign Up</Link>
                        </p>
                    </div>
                </div>
            </>
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

                <div className="text-center mt-12">
                    <p className="text-sm text-gray-500 font-medium">
                        Don't have an account?{' '}
                        <Link to="/auth/signup" className="text-emerald-600 hover:text-emerald-700 font-bold ml-1">Sign Up</Link>
                    </p>
                </div>
            </div>
        </>
    );
};

export default Login;
