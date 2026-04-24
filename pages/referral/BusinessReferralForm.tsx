import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, CheckCircle2, AlertCircle, User, Phone, ShieldCheck, Mail, MapPin, Layout, Layers, Hash, Landmark, Wallet } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useForm } from 'react-hook-form';
import type { BusinessReferral } from '../../types';

const SERVICE_OPTIONS = [
    "Complete Integrated Facility Management including Security",
    "Integrated Facility Management without Security",
    "Only Housekeeping or Janitorial or Cleaning Services",
    "Only Landscaping or Gardening or Environmental Services",
    "Only Electromechanical or Technical or MEP Services",
    "Only Security Services",
    "Administration or Facility management or Estate Management Services",
    "Only Sewage Treatment Plant Operations",
    "Only Swimming Pool Operations"
];

const COMMUNITY_NATURE_OPTIONS = [
    "Villa",
    "Villament",
    "Apartment",
    "Row Houses",
    "Gated Community"
];

const BusinessReferralForm: React.FC = () => {
    const navigate = useNavigate();
    const { isMobile } = useDevice();
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isParadigmEmployee, setIsParadigmEmployee] = useState<boolean | null>(user ? true : null);

    const { register, handleSubmit, setValue, formState: { errors } } = useForm<BusinessReferral>({
        defaultValues: {
            referrerName: user?.name || '',
            referrerMobile: user?.phone || '',
            referrerRole: user?.role || '',
            siteAndDesignation: user ? `${user?.societyName || 'N/A'} - ${user?.role || 'N/A'}` : '',
        }
    });

    useEffect(() => {
        if (user) {
            setValue('referrerName', user.name || '');
            setValue('referrerMobile', user.phone || '');
            setValue('referrerRole', user.role || '');
            setValue('siteAndDesignation', `${user.societyName || 'N/A'} - ${user.role || 'N/A'}`);
            setIsParadigmEmployee(true);
        }
    }, [user, setValue]);

    const onSubmit = async (data: BusinessReferral) => {
        setIsSubmitting(true);
        setError(null);
        try {
            await api.saveBusinessReferral({
                ...data,
                createdBy: user?.id,
                isParadigmEmployee: !!isParadigmEmployee,
                status: isParadigmEmployee ? 'yes' : 'pending'
            });
            setIsSuccess(true);
        } catch (err: any) {
            console.error('Business referral submission error:', err);
            setError(err.message || 'Failed to submit referral. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className={`flex flex-col items-center justify-center h-full px-6 text-center ${isMobile ? 'min-h-screen bg-[#041b0f]' : 'bg-page'}`}>
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8 animate-in zoom-in duration-500 shadow-xl shadow-emerald-500/10">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <h2 className={`text-3xl font-bold mb-3 ${isMobile ? 'text-white' : 'text-gray-900'}`}>Business Referral Submitted!</h2>
                <p className={`text-base mb-10 max-w-sm ${isMobile ? 'text-white/60' : 'text-gray-500'}`}>
                    Thank you for referring a business to Paradigm Services. Our business development team will take it forward.
                </p>
                <div className="flex flex-col w-full max-w-xs gap-4">
                    <Button onClick={() => setIsSuccess(false)} variant="primary" className="h-13 text-lg">
                        Refer Another Business
                    </Button>
                    <Button onClick={() => navigate(-1)} variant="outline" className={`h-13 text-lg ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : ''}`}>
                        {user ? 'Back to Dashboard' : 'Back to Home'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full ${isMobile ? 'min-h-screen bg-[#041b0f]' : 'bg-page'}`}>
            {/* Header */}
            <div 
                className={`flex-shrink-0 flex items-center gap-4 px-6 pb-4 border-b sticky top-0 z-20 backdrop-blur-md ${
                    isMobile ? 'border-white/10 bg-[#041b0f]/80' : 'border-gray-200 bg-white/80'
                }`}
                style={{ paddingTop: isMobile ? 'calc(1rem + env(safe-area-inset-top))' : '1rem' }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 ${isMobile ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>

                <div className={`flex items-center gap-3.5 flex-1 ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#041b0f] to-[#020d07] flex items-center justify-center shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/20">
                        <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight leading-tight">Business Referral</h1>
                        <p className={`text-xs font-semibold ${isMobile ? 'text-white/50' : 'text-gray-400'}`}>Strategic Business Growth Portal</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-16 hide-scrollbar">
                <form onSubmit={handleSubmit(onSubmit)} className="max-w-7xl px-6 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {!user && (
                        <div className={`group rounded-3xl p-8 space-y-6 transition-all duration-300 ${
                            isMobile ? 'bg-white/5 border border-white/10' : 'bg-card shadow-card hover:shadow-2xl hover:shadow-emerald-900/5'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                <h2 className={`text-lg font-black tracking-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>Are you an AP Group Employee?</h2>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsParadigmEmployee(true)}
                                    className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
                                        isParadigmEmployee === true
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                            : isMobile ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                    Yes, I am an Employee
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsParadigmEmployee(false)}
                                    className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
                                        isParadigmEmployee === false
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                            : isMobile ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                    No, I am an Outsider
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Referrer Info Section */}
                    {(isParadigmEmployee !== null || user) && (
                        <div className={`group rounded-3xl p-8 space-y-8 transition-all duration-300 ${
                            isMobile ? 'bg-white/5 border border-white/10' : 'bg-card shadow-card hover:shadow-2xl hover:shadow-emerald-900/5'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                    <h2 className={`text-lg font-black tracking-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>Your Details (Referrer)</h2>
                                </div>
                                {user && (
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                                        Auto-Filled
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Input
                                    label="Your Name"
                                    icon={<User className="h-5 w-5" />}
                                    registration={register('referrerName', { required: 'Your name is required' })}
                                    error={errors.referrerName?.message}
                                    placeholder="Enter your full name"
                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/50'}
                                    readOnly={!!user}
                                />
                                <Input
                                    label="Official Contact Number"
                                    icon={<Phone className="h-5 w-5" />}
                                    registration={register('referrerMobile', { 
                                        required: 'Your contact number is required',
                                        pattern: { value: /^[0-9]{10}$/, message: 'Must be 10 digits' }
                                    })}
                                    error={errors.referrerMobile?.message}
                                    placeholder="e.g. 9876543210"
                                    inputMode="numeric"
                                    pattern="9999999999"
                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/50'}
                                    readOnly={!!user}
                                />
                            </div>

                            {isParadigmEmployee ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <Input
                                        label="Employee ID"
                                        icon={<Hash className="h-5 w-5" />}
                                        registration={register('employeeId', { required: isParadigmEmployee ? 'Employee ID is required' : false })}
                                        error={errors.employeeId?.message}
                                        placeholder="e.g. AP1234"
                                        className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/50'}
                                    />
                                    <Input
                                        label="Site / Location"
                                        icon={<MapPin className="h-5 w-5" />}
                                        registration={register('siteLocation', { required: isParadigmEmployee ? 'Site/Location is required' : false })}
                                        error={errors.siteLocation?.message}
                                        placeholder="e.g. Prestige Waterford"
                                        className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/50'}
                                    />
                                    <Input
                                        label="Your Designation"
                                        icon={<ShieldCheck className="h-5 w-5" />}
                                        registration={register('referrerRole', { required: 'Designation is required' })}
                                        error={errors.referrerRole?.message}
                                        placeholder="e.g. Admin, Manager"
                                        className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/50'}
                                        readOnly={!!user}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                                        <Wallet className="h-4 w-4" />
                                        <span>Payment Details (For Referral Reward)</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className={`space-y-6 p-6 rounded-3xl border transition-all duration-300 ${
                                            isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border shadow-sm hover:shadow-md hover:border-emerald-500/20'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                                                    <Landmark className={`h-3.5 w-3.5 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                                    <span>Bank Transfer</span>
                                                </div>
                                                {!isMobile && <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><Landmark className="h-4 w-4 text-emerald-600" /></div>}
                                            </div>
                                            <div className="space-y-4">
                                                <Input
                                                    label="Bank Name"
                                                    registration={register('bankName')}
                                                    placeholder="e.g. HDFC Bank"
                                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/30'}
                                                />
                                                <Input
                                                    label="Account Number"
                                                    registration={register('accountNumber')}
                                                    placeholder="Enter account number"
                                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/30'}
                                                />
                                                <Input
                                                    label="IFSC Code"
                                                    registration={register('ifscCode')}
                                                    placeholder="e.g. HDFC0001234"
                                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/30'}
                                                />
                                            </div>
                                        </div>
                                        <div className={`space-y-6 p-6 rounded-3xl border transition-all duration-300 ${
                                            isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border shadow-sm hover:shadow-md hover:border-emerald-500/20'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                                                    <Phone className={`h-3.5 w-3.5 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                                    <span>UPI Payment</span>
                                                </div>
                                                {!isMobile && <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><Phone className="h-4 w-4 text-emerald-600" /></div>}
                                            </div>
                                            <div className="flex flex-col h-full justify-center">
                                                <Input
                                                    label="UPI ID"
                                                    registration={register('upiId')}
                                                    placeholder="e.g. 9876543210@paytm"
                                                    className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-page/30'}
                                                />
                                                <div className={`mt-6 p-4 rounded-xl border ${
                                                    isMobile ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                                }`}>
                                                    <p className="text-[10px] font-bold leading-relaxed">
                                                        * Please provide either Bank or UPI details to receive your referral reward after successful verification.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Input
                                        label="Your Relation / Company"
                                        icon={<ShieldCheck className="h-5 w-5" />}
                                        registration={register('referrerRole', { required: 'This field is required' })}
                                        error={errors.referrerRole?.message}
                                        placeholder="e.g. Friend, Vendor Name"
                                        className={isMobile ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-border'}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Client Contact Info */}
                    <div className={`group rounded-3xl p-8 space-y-8 transition-all duration-300 ${
                        isMobile ? 'bg-white/5 border border-white/10' : 'bg-card shadow-card hover:shadow-2xl hover:shadow-emerald-900/5'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h2 className={`text-lg font-black tracking-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>Client Contact Details</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <Input
                                label="Full Name of the Client Contact Person"
                                icon={<User className="h-5 w-5" />}
                                requiredIndicator={true}
                                registration={register('contactPersonName', { required: 'Contact person name is required' })}
                                error={errors.contactPersonName?.message}
                                placeholder="Enter full name"
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            />
                            <Input
                                label="Designation of the Contact Person"
                                icon={<ShieldCheck className="h-5 w-5" />}
                                registration={register('contactPersonDesignation', { required: 'Designation is required' })}
                                error={errors.contactPersonDesignation?.message}
                                placeholder="e.g. Secretary, Estate Manager"
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Input
                                label="Email Address of the Client"
                                icon={<Mail className="h-5 w-5" />}
                                registration={register('clientEmail', { 
                                    required: 'Email is required',
                                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                                })}
                                error={errors.clientEmail?.message}
                                placeholder="client@example.com"
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            />
                             <Input
                                label="Phone Number of the Client"
                                icon={<Phone className="h-5 w-5" />}
                                requiredIndicator={true}
                                registration={register('clientPhone', { 
                                    required: 'Phone number is required',
                                    pattern: { value: /^[0-9]{10}$/, message: 'Must be 10 digits' }
                                })}
                                error={errors.clientPhone?.message}
                                placeholder="10 digit mobile number"
                                inputMode="numeric"
                                pattern="9999999999"
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            />
                        </div>
                    </div>

                    {/* Service & Community Info */}
                    <div className={`group rounded-3xl p-8 space-y-8 transition-all duration-300 ${
                        isMobile ? 'bg-white/5 border border-white/10' : 'bg-card shadow-card hover:shadow-2xl hover:shadow-emerald-900/5'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h2 className={`text-lg font-black tracking-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>Service & Community Details</h2>
                        </div>

                        <Select
                            label="Services interested in"
                            icon={<Layers className="h-5 w-5" />}
                            registration={register('serviceInterested', { required: 'Please select a service' })}
                            error={errors.serviceInterested?.message}
                            className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                        >
                            <option value="">Select a service...</option>
                            {SERVICE_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </Select>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Input
                                label="Name of the Residential Community"
                                icon={<Building className="h-5 w-5" />}
                                requiredIndicator={true}
                                registration={register('communityName', { required: 'Community name is required' })}
                                error={errors.communityName?.message}
                                placeholder="Enter community name"
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            />
                            <Select
                                label="Nature of Community"
                                icon={<Layout className="h-5 w-5" />}
                                registration={register('communityNature', { required: 'Please select nature of community' })}
                                error={errors.communityNature?.message}
                                className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                            >
                                <option value="">Select nature...</option>
                                {COMMUNITY_NATURE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Select>
                        </div>

                        <Input
                            label="Total Number of Units"
                            icon={<Hash className="h-5 w-5" />}
                            type="number"
                            registration={register('totalUnits', { required: 'Total units is required', min: { value: 1, message: 'Minimum 1 unit' } })}
                            error={errors.totalUnits?.message}
                            placeholder="e.g. 150"
                            className={isMobile ? 'bg-white/10 border-white/10 text-white' : ''}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="h-6 w-6 flex-shrink-0" />
                            <p className="font-bold">{error}</p>
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        className="w-full h-14 text-lg font-black tracking-widest uppercase shadow-2xl shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-[#041b0f] to-[#020d07]"
                        isLoading={isSubmitting}
                    >
                        Submit Business Referral
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default BusinessReferralForm;

