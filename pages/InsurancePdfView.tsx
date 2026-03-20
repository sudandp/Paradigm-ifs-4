import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import type { OnboardingData, FamilyMember } from '../types';
import { api } from '../services/api';
import { Download, ShieldCheck, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { InsuranceSummaryDocument } from './attendance/PDFReports';


const PdfExportButton: React.FC<{ employeeData: OnboardingData }> = ({ employeeData }) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const doc = <InsuranceSummaryDocument data={employeeData} />;
            const blob = await pdf(doc).toBlob();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Insurance_Card_${employeeData.personal.employeeId}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button onClick={handleExport} className="mt-8 no-print" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Generating...' : 'Download PDF'}
        </Button>
    );
};

const InsurancePdfView: React.FC = () => {
    const { id } = useParams();
    const [employeeData, setEmployeeData] = useState<OnboardingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (id) {
                setIsLoading(true);
                const data = await api.getOnboardingDataById(id);
                if (data) {
                    setEmployeeData(data);
                }
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (isLoading) {
        return <div className="text-center p-10">Loading employee data...</div>;
    }

    if (!employeeData) {
        return <div className="text-center p-10 text-red-500">Could not find employee data.</div>;
    }

    const { personal, family, gmc } = employeeData;
    const dependents = family.filter(f => f.dependent);

    return (
        <div className="max-w-4xl p-4 sm:p-6 lg:p-8">
            <div className="bg-card p-8 rounded-xl border border-border">
                <header className="flex justify-between items-center border-b pb-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-accent-dark">Paradigm Inc.</h1>
                        <p className="text-muted">Group Medical Insurance Plan</p>
                    </div>
                    <ShieldCheck className="h-12 w-12 text-accent" />
                </header>

                <section className="mb-6">
                    <h2 className="text-lg font-semibold text-primary-text border-b pb-2 mb-4">Employee Details</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div><strong>Employee Name:</strong> {personal.firstName} {personal.lastName}</div>
                        <div><strong>Employee ID:</strong> {personal.employeeId}</div>
                        <div><strong>Date of Birth:</strong> {personal.dob}</div>
                        <div><strong>Gender:</strong> {personal.gender}</div>
                    </div>
                </section>

                <section className="mb-6">
                    <h2 className="text-lg font-semibold text-primary-text border-b pb-2 mb-4">Nominee Details</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div><strong>Nominee Name:</strong> {gmc.nomineeName}</div>
                        <div><strong>Relationship:</strong> {gmc.nomineeRelation}</div>
                    </div>
                </section>

                {gmc.isOptedIn && dependents.length > 0 && (
                    <section className="mb-6">
                        <h2 className="text-lg font-semibold text-primary-text border-b pb-2 mb-4">Covered Dependents</h2>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-page">
                                <tr>
                                    <th className="p-2 font-medium">Name</th>
                                    <th className="p-2 font-medium">Relationship</th>
                                    <th className="p-2 font-medium">Date of Birth</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dependents.map((dep: FamilyMember) => (
                                    <tr key={dep.id} className="border-b border-border">
                                        <td className="p-2">{dep.name}</td>
                                        <td className="p-2">{dep.relation}</td>
                                        <td className="p-2">{dep.dob}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                <footer className="mt-10 pt-6 border-t text-center text-xs text-gray-500">
                    <p>This document confirms your enrollment in the Paradigm Inc. Group Medical Insurance plan. Please keep this for your records. This is a system-generated document and does not require a signature.</p>
                    <p className="mt-2 font-semibold">Policy Effective Date: {new Date().toLocaleDateString()}</p>
                </footer>
            </div>
            <div className="text-center">
                <PdfExportButton employeeData={employeeData} />
            </div>
        </div>
    );
};

export default InsurancePdfView;