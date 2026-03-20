import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, MoveLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { dispatchNotificationFromRules } from '../../services/notificationService';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';


const RequestUnlockPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [unlockReason, setUnlockReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const dailyUnlockRequestCount = useAuthStore(s => s.dailyUnlockRequestCount);
    const isOTRequest = dailyUnlockRequestCount >= 1;

    const handleUnlockRequest = async () => {
        if (!unlockReason.trim()) {
            setToast({ message: 'Please enter a reason for the request.', type: 'error' });
            return;
        }

        
        setIsSubmitting(true);
        try {
            await api.requestAttendanceUnlock(unlockReason);
            
            // Dispatch notification to manager
            if (user) {
                await dispatchNotificationFromRules('punch_unlock_request', {
                    actorName: user.name,
                    actionText: isOTRequest 
                        ? 'has requested an overtime (OT) punch unlock'
                        : 'has requested an emergency punch unlock',
                    locString: '',
                    title: isOTRequest ? 'OT Punch Request' : 'Emergency Punch Request',
                    link: '/my-team',
                    actor: {
                        id: user.id,
                        name: user.name,
                        reportingManagerId: user.reportingManagerId,
                        role: user.role
                    }
                });
            }

            setToast({ message: isOTRequest 
                ? 'OT punch request submitted. Awaiting manager approval.' 
                : 'Unlock request submitted successfully.', type: 'success' });
            
            // Redirect back to profile after a short delay
            setTimeout(() => {
                navigate('/profile', { replace: true });
            }, 1500);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Failed to submit request.', type: 'error' });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="md:pt-8 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="w-full">
                {/* Header with Back Button - Adjusted for Web */}
                <div className="flex items-center gap-4 mb-6 md:mb-8 md:bg-white md:p-4 md:rounded-2xl md:shadow-sm">
                    <button 
                        onClick={() => navigate('/profile')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-transparent text-emerald-500 hover:bg-emerald-50 active:scale-95 transition-all"
                    >
                        <MoveLeft className="h-8 w-8" />
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-white md:text-gray-900">
                        {isOTRequest ? 'Overtime Punch Request' : 'Emergency Punch'}
                    </h1>
                </div>

                {/* Main Content Card - Desktop Optimized */}
                <div className="md:bg-white md:p-8 md:rounded-[2rem] md:shadow-xl md:border md:border-gray-100">
                    <div className="space-y-6 md:space-y-8">
                        {/* Policy Box - Better contrast for both themes */}
                        <div className={`p-6 rounded-2xl border shadow-sm ${
                            isOTRequest 
                                ? 'bg-[#2c1a0d] md:bg-orange-50/50 border-orange-500/20 md:border-orange-100' 
                                : 'bg-[#0d2c18] md:bg-emerald-50/50 border-amber-500/20 md:border-emerald-100'
                        }`}>
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className={`h-6 w-6 ${isOTRequest ? 'text-orange-500 md:text-orange-600' : 'text-amber-500 md:text-emerald-600'}`} />
                                <h2 className={`font-bold text-lg mb-0 ${isOTRequest ? 'text-orange-500 md:text-orange-900' : 'text-amber-500 md:text-emerald-900'}`}>
                                    {isOTRequest ? 'Overtime Policy' : 'Usage Policy'}
                                </h2>
                            </div>
                            <p className={`text-sm md:text-base leading-relaxed font-medium ${
                                isOTRequest 
                                    ? 'text-white/80 md:text-orange-800/90' 
                                    : 'text-white/80 md:text-emerald-800/90'
                            }`}>
                                {isOTRequest 
                                    ? 'This is your 2nd punch request today and will be recorded as overtime (OT). The extra hours worked will appear in your OT calendar. Manager approval is required.'
                                    : 'Emergency punches should only be used in exceptional circumstances. Your manager must approve this request before you can punch in again.'}
                            </p>
                        </div>
                        
                        {/* Reason Field */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-white/80 md:text-gray-600 ml-1 uppercase tracking-wider">
                                {isOTRequest ? 'Reason for Overtime Punch' : 'Reason for Emergency Punch'}
                            </label>
                            <textarea 
                                value={unlockReason}
                                onChange={(e) => setUnlockReason(e.target.value)}
                                placeholder={isOTRequest 
                                    ? 'e.g., Extended shift for urgent project delivery...'
                                    : 'e.g., Forgot to punch in earlier, Network issues...'}
                                className="w-full rounded-2xl bg-[#0d2c18] md:bg-gray-50 border border-emerald-500/20 md:border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 min-h-[180px] p-5 text-white md:text-gray-900 placeholder:text-white/30 md:placeholder:text-gray-400 transition-all resize-none shadow-inner"
                            />
                        </div>

                        {/* Footer Actions - Responsive Layout */}
                        <div className="flex flex-col md:flex-row gap-4 pt-4">
                            <Button 
                                variant="primary" 
                                onClick={handleUnlockRequest}
                                isLoading={isSubmitting}
                                disabled={!unlockReason.trim()}
                                className={`w-full md:flex-1 !py-4 !rounded-2xl !text-lg shadow-lg transition-all active:scale-[0.98] ${
                                    isOTRequest 
                                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                                }`}
                            >
                                <Clock className="mr-2 h-5 w-5" />
                                {isOTRequest ? 'Submit OT Request' : 'Submit Request'}
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/profile')}
                                disabled={isSubmitting}
                                className="w-full md:w-48 !py-4 !rounded-2xl border-2 border-emerald-500/30 md:border-gray-200 bg-transparent md:bg-gray-50 text-emerald-500 md:text-gray-600 hover:bg-emerald-500/10 md:hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestUnlockPage;
