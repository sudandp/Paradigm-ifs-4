
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { useDevice } from '../../hooks/useDevice';

const FormsSelection: React.FC = () => {
    const navigate = useNavigate();
    const { isMobile } = useDevice();

    const forms = [
        {
            id: 'gmc',
            name: 'GMC Form',
            description: 'Group Medical Cover enrollment form for employees and families.',
            path: '/public/forms/gmc'
        }
    ];

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isMobile ? 'bg-[#041b0f]' : 'bg-white'}`}>
            <div className={`w-full flex-grow flex flex-col animate-fade-in ${isMobile ? '!bg-[#041b0f]' : 'bg-white'}`}>
                <header className={`border-b border-border relative flex items-center justify-center min-h-[80px] md:min-h-[100px] ${isMobile ? '!bg-transparent !border-white/10' : 'bg-white'}`}>
                    <div className="absolute left-6 md:left-8">
                        <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => navigate('/auth/login')}
                            className="!rounded-xl"
                        >
                            <ArrowLeft className="h-5 w-5 mr-2" />
                            Back to Login
                        </Button>
                    </div>
                    <Logo className="h-8 md:h-10" />
                </header>

                <div className="flex-grow">
                    <div className="w-full p-6 md:p-8 space-y-6">
                        <div className="space-y-2 text-center md:text-left">
                            <h1 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>Public Forms</h1>
                            <p className={`${isMobile ? 'text-gray-400' : 'text-muted'} text-sm max-w-md`}>
                                Welcome! Please select the form you wish to fill. Enrollment data will be securely processed and saved to our records.
                            </p>
                        </div>

                    <div className="grid grid-cols-1 gap-4">
                        {forms.map((form) => (
                            <button
                                key={form.id}
                                onClick={() => navigate(form.path)}
                                className={`w-full flex items-center justify-between p-5 border rounded-2xl transition-all group hover:shadow-md ${
                                    isMobile 
                                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                                        : 'bg-white border-border hover:bg-page hover:border-accent'
                                }`}
                            >
                                <div className="flex items-center gap-5 text-left">
                                    <div className={`p-3 rounded-2xl transition-colors ${
                                        isMobile 
                                            ? 'bg-accent/20 group-hover:bg-accent/40' 
                                            : 'bg-accent-light group-hover:bg-accent'
                                    }`}>
                                        <FileText className={`h-7 w-7 transition-colors ${
                                            isMobile ? 'text-accent' : 'text-accent group-hover:text-white'
                                        }`} />
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${isMobile ? 'text-white' : 'text-primary-text'}`}>{form.name}</h3>
                                        <p className={`text-sm ${isMobile ? 'text-white/70' : 'text-muted'}`}>{form.description}</p>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-full transition-all transform group-hover:translate-x-1 ${
                                    isMobile 
                                        ? 'bg-white/5 text-gray-400 group-hover:bg-accent group-hover:text-white' 
                                        : 'bg-page text-muted group-hover:bg-accent group-hover:text-white'
                                }`}>
                                    <ChevronRight className="h-5 w-5" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

                <footer className={`border-t flex flex-col md:flex-row items-center justify-between text-xs font-bold ${
                    isMobile 
                        ? 'border-white/10 bg-black/20 text-gray-500 -translate-y-16' 
                        : 'border-border bg-gray-50/50 text-muted'
                }`}>
                    <div className="w-full p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p>&copy; {new Date().getFullYear()} Paradigm Services. All rights reserved.</p>
                        <div className="flex gap-6 uppercase tracking-widest text-[10px]">
                            <span className="hover:text-accent cursor-pointer transition-colors">Privacy Policy</span>
                            <span className="hover:text-accent cursor-pointer transition-colors">Terms of Service</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default FormsSelection;
