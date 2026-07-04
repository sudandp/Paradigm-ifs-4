import React, { useState } from 'react';
import { ShieldCheck, CheckSquare, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';

const VendorConfig: React.FC = () => {
    const [kycVendor, setKycVendor] = useState<'hyperverge' | 'signzy' | 'decentro'>(
        (import.meta.env.VITE_KYC_VENDOR as any) || 'hyperverge'
    );
    const [esignVendor, setEsignVendor] = useState<'digio' | 'leegality' | 'signdesk'>(
        (import.meta.env.VITE_ESIGN_VENDOR as any) || 'digio'
    );
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleSave = () => {
        // In a real application, this would save to a backend or settings store
        // since import.meta.env is static at build time in Vite.
        // We simulate a successful save here.
        console.log('Saved Vendors:', { kycVendor, esignVendor });
        setToast({ message: 'Vendor configuration saved successfully.', type: 'success' });
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Vendor Configuration</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">KYC Gateway</h2>
                <p className="text-sm text-gray-600 mb-4">Select the active vendor for PAN, Aadhaar, and Bank verification.</p>
                <div className="flex flex-col gap-3">
                    {['hyperverge', 'signzy', 'decentro'].map(vendor => (
                        <label key={vendor} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${kycVendor === vendor ? 'bg-emerald-50 border-emerald-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                            <input 
                                type="radio" 
                                name="kycVendor" 
                                value={vendor} 
                                checked={kycVendor === vendor}
                                onChange={(e) => setKycVendor(e.target.value as any)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                            />
                            <span className="capitalize font-medium text-gray-900">{vendor}</span>
                            {kycVendor === vendor && <CheckSquare className="h-5 w-5 text-emerald-600 ml-auto" />}
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">e-Sign Gateway</h2>
                <p className="text-sm text-gray-600 mb-4">Select the active vendor for digital signatures.</p>
                <div className="flex flex-col gap-3">
                    {['digio', 'leegality', 'signdesk'].map(vendor => (
                        <label key={vendor} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${esignVendor === vendor ? 'bg-emerald-50 border-emerald-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                            <input 
                                type="radio" 
                                name="esignVendor" 
                                value={vendor} 
                                checked={esignVendor === vendor}
                                onChange={(e) => setEsignVendor(e.target.value as any)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                            />
                            <span className="capitalize font-medium text-gray-900">{vendor}</span>
                            {esignVendor === vendor && <CheckSquare className="h-5 w-5 text-emerald-600 ml-auto" />}
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="px-8 flex items-center gap-2">
                    <Save className="h-4 w-4" /> Save Configuration
                </Button>
            </div>
        </div>
    );
};

export default VendorConfig;
