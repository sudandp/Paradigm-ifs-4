import React, { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { authService } from '../../services/authService';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';

const validationSchema = yup.object({
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: yup.string().oneOf([yup.ref('password')], 'Passwords must match').required('Please confirm your password'),
}).defined();

interface UpdatePasswordForm {
  password: string;
  confirmPassword: string;
}

const UpdatePassword = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isMobile } = useDevice();

  useEffect(() => {
    if (!user) setError('Invalid or expired reset session. Please request a new link.');
  }, [user]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UpdatePasswordForm>({
    resolver: yupResolver(validationSchema) as unknown as Resolver<UpdatePasswordForm>,
  });

  const onSubmit: SubmitHandler<UpdatePasswordForm> = async (data) => {
    setError('');
    const { error: updateError } = await authService.updateUserPassword(data.password);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      await logout();
      setTimeout(() => navigate('/auth/login', { replace: true }), 2000);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className={`${isMobile ? 'bg-emerald-500/10' : 'bg-emerald-50'} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}>
          <CheckCircle className={`h-10 w-10 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
        </div>
        <h3 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Updated!</h3>
        <p className={`mt-4 text-sm leading-relaxed ${isMobile ? 'text-gray-400' : 'text-gray-600'}`}>
          Password changed successfully. Redirecting...
        </p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="text-center py-8">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isMobile ? 'bg-red-500/10' : 'bg-red-50'}`}>
          <AlertTriangle className={`h-10 w-10 ${isMobile ? 'text-red-400' : 'text-red-600'}`} />
        </div>
        <h3 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Link Expired</h3>
        <p className={`mt-4 text-sm leading-relaxed ${isMobile ? 'text-gray-400' : 'text-gray-600'}`}>
          This link is no longer valid.
        </p>
        <div className="mt-8 space-y-4">
          <Link to="/auth/forgot-password" className={`inline-block w-full text-center py-4 font-bold rounded-xl shadow-lg transition-all ${isMobile ? 'border border-emerald-500 !text-emerald-400' : 'bg-emerald-600 text-white'}`}>
            Request New Link
          </Link>
          <button onClick={() => navigate('/auth/login')} className={`w-full py-4 text-sm font-bold transition-colors ${isMobile ? 'text-white/40' : 'text-gray-500'}`}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={isMobile ? "space-y-4" : "space-y-6"}>
      {!isMobile && (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Account</p>
          <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={isMobile ? "space-y-4" : "space-y-6"}>
        <Input id="password-new" type="password" placeholder="New Password" registration={register('password')} error={errors.password?.message} className={`!pl-4 transition-all ${isMobile ? '!rounded-xl !py-3.5 text-sm !bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50' : '!rounded-2xl !py-5 !bg-white !text-gray-900 !border-gray-200'}`} />
        <Input id="confirm-password-new" type="password" placeholder="Confirm New Password" registration={register('confirmPassword')} error={errors.confirmPassword?.message} className={`!pl-4 transition-all ${isMobile ? '!rounded-xl !py-3.5 text-sm !bg-white/10 !text-white !border-white/20 focus:!border-emerald-500/50 focus:!ring-emerald-500/20 placeholder:text-white/50' : '!rounded-2xl !py-5 !bg-white !text-gray-900 !border-gray-200'}`} />

        {error && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${isMobile ? 'text-xs text-red-400 bg-red-400/10 border-red-400/20' : 'text-sm text-red-600 bg-red-50 border-red-100'}`}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="leading-tight font-semibold">{error}</span>
            </div>
        )}

        <Button type="submit" className={`w-full transition-all ${isMobile ? '!font-bold !h-12 !rounded-xl !bg-emerald-500 hover:!bg-emerald-600 !text-white active:scale-[0.98]' : '!font-black !h-14 !rounded-2xl !bg-emerald-600 !text-white hover:!bg-emerald-700 shadow-emerald-200 shadow-2xl'}`} isLoading={isSubmitting} size="lg" disabled={!user}>
            Update Password
        </Button>
      </form>
    </div>
  );
};

export default UpdatePassword;