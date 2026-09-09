import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PolicyManagement from './PolicyManagement';
import InsuranceManagement from './InsuranceManagement';
import GMCSubmissionsTable from '../../components/hr/GMCSubmissionsTable';
import GMCConfiguration from './GMCConfiguration';
import { ShieldHalf, FileText, ClipboardList, Settings, ArrowLeft } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

type Tab = 'policies' | 'insurance' | 'gmc' | 'config';

const PoliciesAndInsurance: React.FC = () => {
    const navigate = useNavigate();
    const { isMobile } = useDevice();
    const [activeTab, setActiveTab] = useState<Tab>('policies');

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'policies', label: 'Company Policies', icon: FileText },
        { id: 'insurance', label: 'Insurance Plans', icon: ShieldHalf },
        { id: 'gmc', label: 'Forms GMC', icon: ClipboardList },
        { id: 'config', label: 'Configuration', icon: Settings },
    ];

    return (
        <div className={`p-4 space-y-6 ${isMobile ? 'bg-[#041b0f] text-white min-h-screen pb-36' : ''}`}>
            {/* Standardized Mobile Top Navigation Bar */}
            {isMobile && (
                <div className="flex items-center gap-3 pt-1 pb-2 -mx-4 -mt-4 px-4 bg-[#041b0f] border-b border-[#134426]/60 sticky top-0 z-30 mb-2">
                    <button
                        type="button"
                        onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/mobile-home')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Back</span>
                    </button>
                    <div className="h-[1px] flex-1 bg-[#134426]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                        POLICIES & INSURANCE
                    </span>
                </div>
            )}

            {!isMobile && (
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-primary-text">Policies & Insurance</h2>
                </div>
            )}

            {/* Mobile Pill Tabs vs Desktop Border Tabs */}
            {isMobile ? (
                <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                    isActive 
                                        ? 'bg-[#44D62C] text-[#0A1809] shadow-md shadow-[#44D62C]/20' 
                                        : 'bg-[#092c19] text-gray-300 border border-[#134426]'
                                }`}
                            >
                                <Icon className="w-4 h-4 mr-2" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div>
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                        isActive
                                            ? 'border-accent text-accent-dark'
                                            : 'border-transparent text-muted hover:text-primary-text hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            )}

            <div className={`border-0 shadow-none ${isMobile ? 'bg-[#092c19] p-5 rounded-2xl border border-[#134426]' : 'md:bg-card md:p-8 md:rounded-xl md:shadow-card'}`}>
                {activeTab === 'policies' && <PolicyManagement />}
                {activeTab === 'insurance' && <InsuranceManagement />}
                {activeTab === 'gmc' && <GMCSubmissionsTable />}
                {activeTab === 'config' && <GMCConfiguration />}
            </div>
        </div>
    );
};

export default PoliciesAndInsurance;