import React, { useState } from 'react';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Mail, Lock, User as UserIcon, MailCheck, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';
import Input from '../../components/ui/Input';

const validationSchema = yup.object({
    name: yup.string().required('Your name is required'),
    email: yup.string().email('Must be a valid email').required('Email is required'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    confirmPassword: yup.string().oneOf([yup.ref('password')], 'Passwords must match').required('Please confirm your password'),
}).defined();

type SignUpFormInputs = yup.InferType<typeof validationSchema>;

const SignUp: React.FC = () => {
    const { signUp } = useAuthStore();
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { isMobile } = useDevice();

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpFormInputs>({
        resolver: yupResolver(validationSchema) as unknown as Resolver<SignUpFormInputs>,
    });

    const onSubmit: SubmitHandler<SignUpFormInputs> = async (data) => {
        setError('');
        const { error: signUpError } = await signUp(data.name, data.email, data.password);
        if (signUpError) {
            setError(signUpError.message);
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
                <h3 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Check your email</h3>
                <p className={`mt-4 text-sm leading-relaxed ${isMobile ? 'text-gray-400' : 'text-gray-600'}`}>
                    We've sent a verification link to your email address. Please click the link to activate your account.
                </p>
                <div className="mt-8">
                    <Link to="/auth/login" className={`text-sm font-bold transition-colors ${isMobile ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                        &larr; Back to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative group">
                <UserIcon className={`absolute left-4 top-1/2 -translate-y-1/2 ${isMobile ? 'h-4 w-4 text-white/60' : 'h-5 w-5 text-gray-400'} transition-colors pointer-events-none`} />
                <Input id="name" registration={register('name')} error={errors.name?.message} placeholder="Full Name" className={`!pl-11 ${isMobile ? '!bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50 !rounded-xl !py-3.5 text-sm' : '!bg-white !text-gray-900 !border-gray-200 !rounded-2xl !py-5'} transition-all`} />
            </div>
            <div className="relative group">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${isMobile ? 'h-4 w-4 text-white/60' : 'h-5 w-5 text-gray-400'} transition-colors pointer-events-none`} />
                <Input id="email" registration={register('email')} error={errors.email?.message} placeholder="Email Address" className={`!pl-11 ${isMobile ? '!bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50 !rounded-xl !py-3.5 text-sm' : '!bg-white !text-gray-900 !border-gray-200 !rounded-2xl !py-5'} transition-all`} />
            </div>
            <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${isMobile ? 'h-4 w-4 text-white/60' : 'h-5 w-5 text-gray-400'} transition-colors pointer-events-none`} />
                <Input id="password" type="password" registration={register('password')} error={errors.password?.message} placeholder="Create Password" className={`!pl-11 ${isMobile ? '!bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50 !rounded-xl !py-3.5 text-sm' : '!bg-white !text-gray-900 !border-gray-200 !rounded-2xl !py-5'} transition-all`} />
            </div>
            <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${isMobile ? 'h-4 w-4 text-white/60' : 'h-5 w-5 text-gray-400'} transition-colors pointer-events-none`} />
                <Input id="confirmPassword" type="password" registration={register('confirmPassword')} error={errors.confirmPassword?.message} placeholder="Confirm Password" className={`!pl-11 ${isMobile ? '!bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50 !rounded-xl !py-3.5 text-sm' : '!bg-white !text-gray-900 !border-gray-200 !rounded-2xl !py-5'} transition-all`} />
            </div>
            
            {error && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${isMobile ? 'text-xs text-red-400 bg-red-400/10 border-red-400/20' : 'text-sm text-red-600 bg-red-50 border-red-100'}`}>
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="leading-tight font-semibold">{error}</span>
                </div>
            )}

            <Button type="submit" className={`w-full transition-all ${isMobile ? '!font-bold !h-12 !rounded-xl !bg-emerald-500 hover:!bg-emerald-600 !text-white active:scale-[0.98]' : '!font-black !h-14 !rounded-2xl !bg-emerald-600 !text-white hover:!bg-emerald-700 shadow-emerald-200 shadow-2xl'}`} isLoading={isSubmitting} size="lg">
                Create Account
            </Button>

            <div className="text-center pt-4">
                <p className={`font-medium ${isMobile ? 'text-xs text-white/70' : 'text-sm text-gray-500'}`}>
                    Already have an account?{' '}
                    <Link to="/auth/login" className={`font-bold transition-colors ${isMobile ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'} ml-1`}>Sign In</Link>
                </p>
            </div>
        </form>
    );
};

export default SignUp;
