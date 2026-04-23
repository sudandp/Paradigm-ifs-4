import React from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import { UserPlus, Building, ArrowRight, ExternalLink } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

const ReferralModal: React.FC = () => {
    const { isReferralModalOpen, setReferralModalOpen } = useUiSettingsStore();
    const { isMobile } = useDevice();
    const navigate = useNavigate();

    const referralOptions = [
        {
            id: 'employee',
            title: 'Employee Referral',
            description: 'Refer a candidate for our internal team or field operations.',
            icon: UserPlus,
            color: 'bg-[#006b3f]',
            route: '/referral/employee'
        },
        {
            id: 'business',
            title: 'Business Referral',
            description: 'Refer a company or organization looking for FM services.',
            icon: Building,
            color: 'bg-[#041b0f]',
            route: '/referral/business'
        }
    ];

    const handleOptionClick = (route: string) => {
        setReferralModalOpen(false);
        navigate(route);
    };

    return (
        <Modal
            isOpen={isReferralModalOpen}
            onClose={() => setReferralModalOpen(false)}
            title="Referral Program"
            hideFooter
            maxWidth="md:max-w-lg"
        >
            <div className="space-y-4 py-2">
                <p className={`text-sm mb-6 ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
                    Help us grow! Choose a referral type below. Your contribution helps Paradigm Services reach new heights.
                </p>

                <div className="grid grid-cols-1 gap-4">
                    {referralOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionClick(option.route)}
                            className={`group relative flex items-center p-4 border rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left w-full ${
                                isMobile 
                                    ? 'bg-white/5 border-white/10 hover:border-emerald-500/40' 
                                    : 'bg-white border-gray-100 hover:border-emerald-500/30 shadow-sm'
                            }`}
                        >
                            <div className={`h-12 w-12 rounded-xl ${option.color} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110`}>
                                <option.icon className="h-6 w-6" />
                            </div>

                            <div className="ml-4 flex-1">
                                <h4 className={`text-base font-bold transition-colors ${
                                    isMobile ? 'text-white' : 'text-gray-900 group-hover:text-emerald-700'
                                }`}>
                                    {option.title}
                                </h4>
                                <p className={`text-xs mt-1 leading-relaxed ${
                                    isMobile ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                    {option.description}
                                </p>
                            </div>

                            <div className={`ml-4 p-2 rounded-full transition-all transform group-hover:translate-x-1 ${
                                isMobile 
                                    ? 'bg-white/5 text-gray-500 group-hover:bg-emerald-500 group-hover:text-white' 
                                    : 'bg-gray-50 text-gray-400 group-hover:bg-emerald-500 group-hover:text-white'
                            }`}>
                                <ArrowRight className="h-4 w-4" />
                            </div>
                        </button>
                    ))}
                </div>

                <div className={`mt-8 pt-6 border-t flex flex-col items-center gap-4 ${
                    isMobile ? 'border-white/10' : 'border-gray-100'
                }`}>
                    <button
                        onClick={() => setReferralModalOpen(false)}
                        className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                            isMobile 
                                ? 'bg-white/5 text-white/60 hover:bg-white/10' 
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        Cancel & Go Back
                    </button>

                    <div className={`flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold ${
                        isMobile ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                        <ExternalLink className="h-3 w-3" />
                        <span>Referral Forms</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ReferralModal;
