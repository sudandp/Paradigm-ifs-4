import React, { useState } from 'react';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Mail, Lock, User as UserIcon, MailCheck, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';
import WaveFloatingInput from '../../components/ui/WaveFloatingInput';

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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
            <WaveFloatingInput 
                id="name" 
                label="Full Name"
                registration={register('name')} 
                error={errors.name?.message} 
                icon={<UserIcon className="h-3.5 w-3.5" />}
                variant={isMobile ? 'dark' : 'light'}
            />
            <WaveFloatingInput 
                id="signup-email" 
                type="email"
                label="Email Address"
                autoComplete="email"
                registration={register('email')} 
                error={errors.email?.message} 
                icon={<Mail className="h-3.5 w-3.5" />}
                variant={isMobile ? 'dark' : 'light'}
            />
            <WaveFloatingInput 
                id="signup-password" 
                type="password" 
                label="Create Password"
                autoComplete="new-password"
                registration={register('password')} 
                error={errors.password?.message} 
                icon={<Lock className="h-3.5 w-3.5" />}
                variant={isMobile ? 'dark' : 'light'}
            />
            <WaveFloatingInput 
                id="signup-confirm-password" 
                type="password" 
                label="Confirm Password"
                autoComplete="new-password"
                registration={register('confirmPassword')} 
                error={errors.confirmPassword?.message} 
                icon={<Lock className="h-3.5 w-3.5" />}
                variant={isMobile ? 'dark' : 'light'}
            />
            
            {error && (
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border animate-fadeIn ${isMobile ? 'text-[13px] text-red-400 bg-red-400/10 border-red-400/20' : 'text-xs text-red-600 bg-red-50 border-red-100'}`}>
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="leading-tight font-semibold">{error}</span>
                </div>
            )}

            <div className="pt-2">
                <Button 
                    type="submit" 
                    className={isMobile 
                        ? "w-full !font-black !h-14 !rounded-2xl !text-[16px] transition-all !bg-[#3eff99] hover:!bg-[#2ae080] !text-[#05110c] active:scale-[0.97] !shadow-[0_12px_24px_rgba(62,255,153,0.2)] hover:!shadow-[0_16px_32px_rgba(62,255,153,0.3)] cursor-pointer"
                        : "w-full !font-black !h-10.5 !rounded-xl !text-[12px] !tracking-[0.15em] !uppercase transition-all active:scale-[0.97] shadow-sm !bg-emerald-600 !text-white hover:!bg-emerald-700 shadow-emerald-600/25 cursor-pointer"
                    } 
                    isLoading={isSubmitting} 
                    size="lg"
                >
                    Create Account
                </Button>
            </div>


            <div className="text-center mt-3 space-y-3">
                <p className={isMobile ? "text-[13px] text-white/60 font-medium" : "text-sm text-gray-500 font-medium pt-2"}>
                    Already have an account?{' '}
                    <Link to="/auth/login" className={`font-bold transition-colors ${isMobile ? 'text-[#3eff99] hover:text-[#2ae080]' : 'text-emerald-600 hover:text-emerald-700'} ml-1`}>
                        Sign In
                    </Link>
                </p>
                <div className={`pt-4 border-t ${isMobile ? 'border-white/10' : 'border-gray-100'}`}>
                    <p className={`text-[10px] uppercase tracking-widest font-medium leading-relaxed ${isMobile ? 'text-white/30' : 'text-gray-400'}`}>
                        © Paradigm FMS Services. All rights reserved.
                    </p>
                </div>
            </div>
        </form>
    );
};

export default SignUp;

