import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, ExternalLink, RefreshCw } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfewG7m6NaFQKN8Cz5qRiM2suvWBEgky_AlFBfHwvGZedf8og/viewform?embedded=true';

const EmployeeReferralForm: React.FC = () => {
    const navigate = useNavigate();
    const { isMobile } = useDevice();
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className={`flex flex-col h-full ${isMobile ? 'min-h-screen bg-[#041b0f]' : ''}`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b ${
                isMobile
                    ? 'border-white/10 bg-[#041b0f]'
                    : 'border-gray-200 bg-white'
            }`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2 rounded-xl transition-colors ${
                        isMobile
                            ? 'hover:bg-white/10 text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>

                <div className={`flex items-center gap-2.5 flex-1 ${
                    isMobile ? 'text-white' : 'text-gray-900'
                }`}>
                    <div className="w-8 h-8 rounded-lg bg-[#006b3f] flex items-center justify-center">
                        <UserPlus className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold leading-tight">Employee Referral</h1>
                        <p className={`text-[10px] font-medium ${
                            isMobile ? 'text-white/50' : 'text-gray-400'
                        }`}>Candidate Referral Form</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setIsLoading(true); const iframe = document.getElementById('employee-referral-iframe') as HTMLIFrameElement; if (iframe) iframe.src = iframe.src; }}
                        className={`p-2 rounded-xl transition-colors ${
                            isMobile
                                ? 'hover:bg-white/10 text-white/60'
                                : 'hover:bg-gray-100 text-gray-400'
                        }`}
                        title="Reload form"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSfewG7m6NaFQKN8Cz5qRiM2suvWBEgky_AlFBfHwvGZedf8og/viewform?vc=0&c=0&w=1&flr=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-2 rounded-xl transition-colors ${
                            isMobile
                                ? 'hover:bg-white/10 text-white/60'
                                : 'hover:bg-gray-100 text-gray-400'
                        }`}
                        title="Open in new tab"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative">
                {isLoading && (
                    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 ${
                        isMobile ? 'bg-[#041b0f]' : 'bg-white'
                    }`}>
                        <div className="w-10 h-10 rounded-full border-3 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                        <p className={`text-xs font-medium ${
                            isMobile ? 'text-white/50' : 'text-gray-400'
                        }`}>Loading referral form...</p>
                    </div>
                )}
                <iframe
                    id="employee-referral-iframe"
                    src={FORM_URL}
                    onLoad={() => setIsLoading(false)}
                    className="w-full h-full border-0"
                    style={{ 
                        minHeight: isMobile ? 'calc(100vh - 60px)' : 'calc(100vh - 120px)',
                        backgroundColor: isMobile ? '#041b0f' : '#ffffff',
                    }}
                    title="Employee Referral Form"
                    allow="autoplay"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                />
            </div>
        </div>
    );
};

export default EmployeeReferralForm;
