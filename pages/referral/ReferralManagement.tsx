import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, ArrowLeft, UserPlus, 
  Phone, Building2, Clock, CheckCircle2,
  Calendar, Briefcase, ExternalLink
} from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';
import { api } from '../../services/api';
import type { CandidateReferral } from '../../types';
import Button from '../../components/ui/Button';

const ReferralManagement: React.FC = () => {
    const navigate = useNavigate();
    const { isMobile } = useDevice();
    const [referrals, setReferrals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchReferrals();
    }, []);

    const fetchReferrals = async () => {
        setLoading(true);
        try {
            const data = await api.getCandidateReferrals();
            setReferrals(data);
        } catch (error) {
            console.error('Failed to fetch referrals:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredReferrals = referrals.filter(ref => {
        const matchesSearch = 
            ref.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ref.referrerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ref.candidateRole?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className={`flex flex-col h-full ${isMobile ? 'bg-[#041b0f]' : 'bg-page'}`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b sticky top-0 z-20 backdrop-blur-md ${
                isMobile ? 'border-white/10 bg-[#041b0f]/80' : 'border-gray-200 bg-white/80'
            }`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className={`p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 ${isMobile ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div className={`flex items-center gap-3.5 ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#006b3f] to-[#004d2d] flex items-center justify-center shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/20">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold tracking-tight leading-tight">Referral Management</h1>
                            <p className={`text-xs font-semibold ${isMobile ? 'text-white/50' : 'text-gray-400'}`}>Employee Candidate Submissions</p>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => fetchReferrals()} className={isMobile ? 'text-white border-white/10' : ''}>
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isMobile ? 'text-white/40' : 'text-gray-400'}`} />
                            <input
                                type="text"
                                placeholder="Search by name or role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                                    isMobile ? 'bg-white/5 border-white/10 text-white placeholder-white/20' : 'bg-white border-gray-200 shadow-sm'
                                }`}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                            <p className={`text-sm font-bold ${isMobile ? 'text-white/40' : 'text-gray-500'}`}>Loading referrals...</p>
                        </div>
                    ) : filteredReferrals.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed ${
                            isMobile ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'
                        }`}>
                            <Users className={`h-16 w-16 mb-4 opacity-10 ${isMobile ? 'text-white' : 'text-gray-900'}`} />
                            <p className={`text-lg font-bold ${isMobile ? 'text-white/40' : 'text-gray-500'}`}>No candidate referrals found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredReferrals.map((referral) => (
                                <div 
                                    key={referral.id}
                                    className={`group rounded-3xl p-6 space-y-5 transition-all duration-300 ${
                                        isMobile ? 'bg-white/5 border border-white/10' : 'bg-white shadow-card hover:shadow-2xl hover:shadow-emerald-900/5'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <h3 className={`text-xl font-black tracking-tight ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                                                {referral.candidateName}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                    isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {referral.candidateRole}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-white/5 text-white/40' : 'bg-gray-50 text-gray-400'}`}>
                                            <UserPlus className="h-6 w-6" />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center gap-3">
                                            <Phone className={`h-4 w-4 ${isMobile ? 'text-white/20' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-bold ${isMobile ? 'text-white/70' : 'text-gray-600'}`}>{referral.candidateMobile}</span>
                                        </div>
                                        {referral.referredPersonRole && (
                                            <div className="flex items-center gap-3">
                                                <Briefcase className={`h-4 w-4 ${isMobile ? 'text-white/20' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-bold ${isMobile ? 'text-white/70' : 'text-gray-600'}`}>{referral.referredPersonRole}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`pt-4 border-t ${isMobile ? 'border-white/5' : 'border-gray-50'} space-y-4`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                    <span className="text-xs font-black text-emerald-500">{referral.referrerName?.charAt(0)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isMobile ? 'text-white/30' : 'text-gray-400'}`}>Referred By</span>
                                                    <span className={`text-xs font-black uppercase ${isMobile ? 'text-white/60' : 'text-gray-900'}`}>{referral.referrerName}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-[10px] font-black uppercase tracking-tighter ${isMobile ? 'text-white/30' : 'text-gray-400'}`}>Date</span>
                                                <span className={`text-xs font-black uppercase ${isMobile ? 'text-white/60' : 'text-gray-900'}`}>
                                                    {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`text-[10px] font-black uppercase py-2 px-3 rounded-xl ${isMobile ? 'bg-white/5 text-white/40' : 'bg-gray-50 text-gray-400'}`}>
                                            Referrer Role: {referral.referrerRole}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReferralManagement;
