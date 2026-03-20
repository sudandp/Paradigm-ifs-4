import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { ClipboardList, IndianRupee } from 'lucide-react';
import SiteAttendanceTracker from '../billing/SiteAttendanceTracker';
import SiteFinanceTracker from './SiteFinanceTracker';

const FinanceModule: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine active tab based on query param or default
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'attendance';
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    useEffect(() => {
        const tab = queryParams.get('tab') || 'attendance';
        setActiveTab(tab);
    }, [location.search]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        navigate(`/finance?tab=${tab}`, { replace: true });
    };

    return (
        <div className="flex flex-col min-h-full">
            <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex-1">
                <AdminPageHeader title="Tracker" />
                
                <div className="flex bg-[#06251c] md:bg-gray-100 p-1 rounded-xl w-fit -mx-4 md:mx-0 ml-0 border border-white/5 md:border-gray-200">
                    <button 
                        onClick={() => handleTabChange('attendance')} 
                        className={`whitespace-nowrap px-6 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
                            activeTab === 'attendance' 
                                ? 'bg-[#00D27F] md:bg-white text-[#041b0f] md:text-emerald-700 shadow-lg md:shadow-sm shadow-emerald-500/20' 
                                : 'text-emerald-400/60 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'
                        }`}
                    >
                        <ClipboardList className="h-4 w-4" />
                        Attendance Tracker
                    </button>
                    <button 
                        onClick={() => handleTabChange('site')} 
                        className={`whitespace-nowrap px-6 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
                            activeTab === 'site' 
                                ? 'bg-[#00D27F] md:bg-white text-[#041b0f] md:text-emerald-700 shadow-lg md:shadow-sm shadow-emerald-500/20' 
                                : 'text-emerald-400/60 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'
                        }`}
                    >
                        <IndianRupee className="h-4 w-4" />
                        Monthly Invoice Tracker
                    </button>
                </div>

                <div className="mt-4 md:mt-6">
                    {activeTab === 'attendance' ? <SiteAttendanceTracker /> : <SiteFinanceTracker />}
                </div>
            </div>
        </div>
    );
};

export default FinanceModule;
