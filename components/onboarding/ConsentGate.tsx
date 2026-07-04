import React, { useState } from 'react';
import { Shield, Check, X, AlertTriangle, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';

interface ConsentGateProps {
    onAccept: () => void;
    onDecline: () => void;
}

const ConsentGate: React.FC<ConsentGateProps> = ({ onAccept, onDecline }) => {
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedDataProcessing, setAcceptedDataProcessing] = useState(false);
    const [acceptedAadhaar, setAcceptedAadhaar] = useState(false);
    const [acceptedBackground, setAcceptedBackground] = useState(false);

    const allAccepted = acceptedTerms && acceptedDataProcessing && acceptedAadhaar && acceptedBackground;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">DPDP Data Privacy Consent</h2>
                        <p className="text-sm text-gray-500">MeitY Digital Personal Data Protection (DPDP) Rules</p>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-blue-800 text-sm">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                        <p>
                            To proceed with your onboarding, Paradigm Integrated Facility Management Services requires your consent to collect and process your personal data in compliance with the DPDP Act, 2023.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="flex-shrink-0 mt-1">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                />
                            </div>
                            <div>
                                <span className="text-gray-900 font-medium group-hover:text-blue-700 transition-colors">Terms of Service & Privacy Policy</span>
                                <p className="text-gray-500 text-sm mt-0.5">I have read and agree to the Terms of Service and Privacy Policy outlining data collection practices.</p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="flex-shrink-0 mt-1">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    checked={acceptedDataProcessing}
                                    onChange={(e) => setAcceptedDataProcessing(e.target.checked)}
                                />
                            </div>
                            <div>
                                <span className="text-gray-900 font-medium group-hover:text-blue-700 transition-colors">Data Collection & Processing (Tier 1 & Tier 2)</span>
                                <p className="text-gray-500 text-sm mt-0.5">I consent to the collection of my personal and sensitive data. I understand that my data will be securely vaulted and purged upon "Purpose Served" as per company retention policies.</p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="flex-shrink-0 mt-1">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    checked={acceptedAadhaar}
                                    onChange={(e) => setAcceptedAadhaar(e.target.checked)}
                                />
                            </div>
                            <div>
                                <span className="text-gray-900 font-medium group-hover:text-blue-700 transition-colors">Aadhaar Offline Verification (UIDAI OVSE)</span>
                                <p className="text-gray-500 text-sm mt-0.5">I consent to offline Aadhaar verification. I understand my Aadhaar number will NOT be stored, only a reference token and masked details.</p>
                            </div>
                        </label>
                        
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="flex-shrink-0 mt-1">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    checked={acceptedBackground}
                                    onChange={(e) => setAcceptedBackground(e.target.checked)}
                                />
                            </div>
                            <div>
                                <span className="text-gray-900 font-medium group-hover:text-blue-700 transition-colors">Background Check & PCC Lifecycle</span>
                                <p className="text-gray-500 text-sm mt-0.5">I authorize Paradigm to initiate a Police Clearance Certificate (PCC) and conduct necessary background verifications using the provided documents.</p>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between rounded-b-2xl">
                    <button 
                        type="button" 
                        onClick={onDecline}
                        className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2"
                    >
                        Decline
                    </button>
                    <Button 
                        type="button" 
                        variant="primary" 
                        disabled={!allAccepted}
                        onClick={onAccept}
                        className="min-w-[150px] shadow-sm"
                    >
                        Accept & Continue
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConsentGate;
