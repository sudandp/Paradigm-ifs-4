
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import type { OnboardingData } from '../../types';
import { api } from '../../services/api';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useLogoStore } from '../../store/logoStore';
import { pdf } from '@react-pdf/renderer';
import { EmployeeOnboardingDocument } from '../attendance/PDFReports';
import LoadingScreen from '../../components/ui/LoadingScreen';


const InsurancePdfOutput: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [employeeData, setEmployeeData] = useState<OnboardingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepted, setIsAccepted] = useState(false);
    const { data: storeData, setFormsGenerated } = useOnboardingStore();
    const logo = useLogoStore((state) => state.currentLogo);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (id && !id.startsWith('draft_')) {
                setIsLoading(true);
                const data = await api.getOnboardingDataById(id);
                setEmployeeData(data || null);
                setIsLoading(false);
            } else {
                // Use data from the store for drafts
                setEmployeeData(storeData);
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, storeData]);

    const handleExport = async () => {
        if (!employeeData) return;
        setIsGenerating(true);
        try {
            const doc = <EmployeeOnboardingDocument data={employeeData} logoUrl={logo} />;
            const blob = await pdf(doc).toBlob();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Insurance_Enrollment_${employeeData.personal.employeeId}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = () => {
        setFormsGenerated(true);
        navigate(`/onboarding/add/review?id=${id}`);
    };

    if (isLoading || isGenerating) return <div className="text-center p-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    if (!employeeData) return <div className="text-center p-10 text-red-500">Could not find employee data.</div>;

    const d = employeeData;
    const fullName = `${d.personal.firstName} ${d.personal.middleName || ''} ${d.personal.lastName}`.replace(/\s+/g, ' ').trim();
    const fatherName = d.family.find(f => f.relation === 'Father')?.name || '';
    const spouseName = d.family.find(f => f.relation === 'Spouse')?.name || '';
    const motherName = d.family.find(f => f.relation === 'Mother')?.name || '';

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="bg-page">
            <div className="max-w-4xl p-4 sm:p-6 lg:p-8">
                <div className="bg-card p-4 rounded-xl shadow-card no-print mb-8 sticky top-4 z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <Button onClick={() => navigate(-1)} variant="secondary"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
                        <div className="text-center">
                            <h2 className="font-bold text-lg">Review Official Forms</h2>
                            <p className="text-sm text-muted">Please confirm these details before submitting.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={handleExport} variant="outline" disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                {isGenerating ? 'Generating...' : 'Download'}
                            </Button>
                            <Button onClick={handleConfirm}>Confirm & Continue</Button>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-lg p-12 text-center">
                    <p className="text-gray-500 italic">The insurance enrollment forms are ready for download or confirmation.</p>
                </div>
            </div>
        </div>
    );
};

export default InsurancePdfOutput;
