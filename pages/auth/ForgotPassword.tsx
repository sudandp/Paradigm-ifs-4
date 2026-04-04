import React, { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Mail, MailCheck, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';

const validationSchema = yup.object({
    email: yup.string().email('Must be a valid email').required('Email is required'),
}).defined();

interface ForgotPasswordForm {
    email: string;
}

const ForgotPassword = () => {
    const { sendPasswordReset } = useAuthStore();
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { isMobile } = useDevice();
    const navigate = useNavigate();

    useEffect(() => {
        if (isSubmitted) {
            const timer = setTimeout(() => navigate('/auth/login', { replace: true }), 3000);
            return () => clearTimeout(timer);
        }
    }, [isSubmitted, navigate]);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>({
        resolver: yupResolver(validationSchema) as unknown as Resolver<ForgotPasswordForm>,
    });

    const onSubmit: SubmitHandler<ForgotPasswordForm> = async (data) => {
        setError('');
        const { error: resetError } = await sendPasswordReset(data.email);
        if (resetError && resetError.message.includes('rate limit')) {
            setError('Too many attempts. Please try again later.');
        } else {
            setIsSubmitted(true);
        }
    };

    if (isSubmitted) {
        return (
            <div className="text-center py-8">
                <div className={`${isMobile ? 'bg-emerald-500/10' : 'bg-emerald-50'} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}>
                    <MailCheck className={`h-10 w-10 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h3 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Check email</h3>
                <p className={`mt-4 text-sm leading-relaxed ${isMobile ? 'text-gray-400' : 'text-gray-600'}`}>
                    We've sent password reset instructions if an account exists.
                </p>
                <div className="mt-8">
                    <Link to="/auth/login" className={`text-sm font-bold transition-colors ${isMobile ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                        &larr; Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="text-center px-2">
                <p className={`text-sm ${isMobile ? 'text-white/90 font-medium' : 'text-gray-500'} leading-relaxed`}>
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            </div>

            <div className="relative group">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isMobile ? 'text-white/80' : 'text-gray-400'} transition-colors pointer-events-none z-10`} />
                <Input
                    id="email"
                    type="email"
                    placeholder="Email Address"
                    registration={register('email')}
                    error={errors.email?.message}
                    className={`!pl-12 !rounded-2xl !py-5 transition-all shadow-inner ${isMobile ? '!bg-black/40 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/90' : '!bg-white !text-gray-900 !border-gray-200'}`}
                />
            </div>

            {error && (
                <div className={`flex items-center gap-3 text-sm p-4 rounded-2xl border ${isMobile ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-red-600 bg-red-50 border-red-100'}`}>
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <span className="leading-tight font-bold">{error}</span>
                </div>
            )}

            <div className="pt-2">
                <Button type="submit" className={`w-full !font-black !h-14 !rounded-2xl transition-all shadow-2xl ${isMobile ? '!bg-transparent !border-2 !border-emerald-500 !text-emerald-500 hover:!bg-emerald-500/10 active:scale-[0.98]' : '!bg-emerald-600 !text-white hover:!bg-emerald-700 shadow-emerald-200'}`} isLoading={isSubmitting} size="lg">
                    Send Link
                </Button>
            </div>

            <div className="text-center">
                <Link to="/auth/login" className={`text-sm font-black transition-colors ${isMobile ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                    &larr; Back to Login
                </Link>
            </div>
        </form>
    );
};

export default ForgotPassword;