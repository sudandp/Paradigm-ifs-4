import React, { useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Server, Download, ShieldCheck, Settings, Mail, Image, Phone, Building } from 'lucide-react';
import { api } from '../../services/api';
import Toast from '../../components/ui/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import Checkbox from '../../components/ui/Checkbox';
import PageInterfaceSettingsModal from '../../components/developer/PageInterfaceSettingsModal';
import { useDevice } from '../../hooks/useDevice';
import { useAuthStore } from '../../store/authStore';

const LastUpdated = ({ updatedBy, updatedAt }: { updatedBy?: string, updatedAt?: string }) => {
    if (!updatedBy && !updatedAt) return null;
    return (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
            <span>Updated by: <span className="font-medium text-primary-text">{updatedBy || '-'}</span></span>
            <span>{updatedAt ? new Date(updatedAt).toLocaleString() : '-'}</span>
        </div>
    );
};


const SettingsCard: React.FC<{ title: string; icon: React.ElementType, children: React.ReactNode, className?: string }> = ({ title, icon: Icon, children, className }) => (
    <div className={`border-0 shadow-none lg:bg-card lg:p-6 lg:rounded-xl lg:shadow-card ${className || ''}`}>
        <div className="flex items-center mb-6">
            <div className="p-3 rounded-full bg-accent-light mr-4">
                <Icon className="h-6 w-6 text-accent-dark" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-primary-text">{title}</h3>
            </div>
        </div>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);


export const ApiSettings: React.FC = () => {
    const { isMobile } = useDevice();
    const { user } = useAuthStore();
    const store = useSettingsStore();

    const [isExporting, setIsExporting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isInterfaceModalOpen, setIsInterfaceModalOpen] = useState(false);
    const [backups, setBackups] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('Authentication Settings');

    const TabButton = ({ tabName }: { tabName: string }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tabName)}
            className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all flex items-center gap-2 ${activeTab === tabName ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-primary-text'}`}
        >
            <span>{tabName}</span>
        </button>
    );

    const loadBackups = async () => {
        try {
            const data = await api.getBackups();
            setBackups(data);
        } catch (err) {
            console.error('Failed to load backups:', err);
        }
    };

    React.useEffect(() => {
        loadBackups();
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        setToast(null);
        try {
            const data = await api.exportAllData();
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            link.download = `paradigm_backup_${new Date().toISOString()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setToast({ message: 'Data exported successfully!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to export data.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-8 p-4 md:p-0">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <PageInterfaceSettingsModal isOpen={isInterfaceModalOpen} onClose={() => setIsInterfaceModalOpen(false)} />

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-primary-text">System Settings</h2>
                <div className="flex gap-3">
                    <Button 
                        onClick={async () => {
                            try {
                                setIsExporting(true);
                                await api.saveApiSettings(store.apiSettings);
                                await api.saveGeminiApiSettings(store.geminiApi);
                                await api.saveOfflineOcrSettings(store.offlineOcr);
                                await api.savePerfiosApiSettings(store.perfiosApi);
                                await api.saveKycApiSettings(store.kycApi);
                                await api.saveEsignApiSettings(store.esignApi);
                                await api.saveOtpSettings(store.otp);
                                await api.saveSiteManagementSettings(store.siteManagement);
                                await api.saveAddressSettings(store.address);
                                await api.saveNotificationSettings(store.notifications);
                                
                                setToast({ message: 'Settings saved to database!', type: 'success' });
                            } catch (err) {
                                console.error('Failed to save settings:', err);
                                setToast({ message: 'Failed to save settings to database.', type: 'error' });
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                        isLoading={isExporting}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="border-b border-border overflow-x-auto no-scrollbar mb-8">
                <nav className="-mb-px flex space-x-1 sm:space-x-4 min-w-max pb-1 text-base">
                    <TabButton tabName="Authentication Settings" />
                    <TabButton tabName="Client & Site Management" />
                    <TabButton tabName="Notification Settings" />
                    <TabButton tabName="Page Interface" />
                    <TabButton tabName="System & Data" />
                    <TabButton tabName="Verification APIs" />
                </nav>
            </div>

            <div className="flex-1 py-2 min-h-[60vh]">
                {activeTab === 'Page Interface' && (
                    <SettingsCard title="Page Interface" icon={Image} className="w-full">
                        <p className="text-sm text-muted -mt-2">Customize the application's branding, login screen, and user interaction settings.</p>
                        <div className="pt-4">
                            <Button type="button" onClick={() => setIsInterfaceModalOpen(true)}>Open Interface Settings</Button>
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'Verification APIs' && (
                    <SettingsCard title="Verification APIs" icon={ShieldCheck} className="w-full">
                        <p className="text-sm text-muted -mt-2">Configure third-party services for employee verification.</p>
                        <div className="space-y-6 pt-4">
                            {/* Gemini API */}
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <Checkbox
                                    id="gemini-enabled"
                                    label="Enable Gemini API OCR Verification"
                                    description="Use Google's Gemini API for document data extraction. This is a powerful fallback or primary OCR. API key must be configured on the backend."
                                    checked={store.geminiApi.enabled}
                                    onChange={e => store.updateGeminiApiSettings({ enabled: e.target.checked, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                                />
                                <div className={`mt-4 transition-opacity ${store.geminiApi.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <Input 
                                        label="Gemini API Key" 
                                        type="password"
                                        className="w-full" 
                                        value={store.geminiApi.apiKey || ''} 
                                        onChange={e => store.updateGeminiApiSettings({ apiKey: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} 
                                        autoCapitalizeCustom={false}
                                    />
                                </div>
                                <LastUpdated updatedBy={store.geminiApi.updatedBy} updatedAt={store.geminiApi.updatedAt} />
                            </div>
                            {/* Offline OCR (Tesseract.js) */}
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <Checkbox
                                    id="offline-ocr-enabled"
                                    label="Enable Offline OCR (Tesseract.js)"
                                    description="Use browser-side Tesseract.js for document data extraction. Works offline and requires no API key, but may be less accurate for complex layouts."
                                    checked={store.offlineOcr.enabled}
                                    onChange={e => store.updateOfflineOcrSettings({ enabled: e.target.checked, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                                />
                                <LastUpdated updatedBy={store.offlineOcr.updatedBy} updatedAt={store.offlineOcr.updatedAt} />
                            </div>
                            {/* Perfios API */}
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <Checkbox
                                    id="perfios-enabled"
                                    label="Enable Perfios API Verification"
                                    description="Use Perfios for Bank, Aadhaar, and UAN verification."
                                    checked={store.perfiosApi.enabled}
                                    onChange={e => store.updatePerfiosApiSettings({ enabled: e.target.checked, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                                />
                                <div className={`mt-4 space-y-4 transition-opacity ${store.perfiosApi.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <Input 
                                        label="Perfios Client ID" 
                                        className="w-full" 
                                        value={store.perfiosApi.clientId} 
                                        onChange={e => store.updatePerfiosApiSettings({ clientId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} 
                                        autoCapitalizeCustom={false}
                                    />
                                    <Input 
                                        label="Perfios Client Secret" 
                                        type="password" 
                                        className="w-full"
                                        value={store.perfiosApi.clientSecret} 
                                        onChange={e => store.updatePerfiosApiSettings({ clientSecret: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} 
                                    />
                                </div>
                                <LastUpdated updatedBy={store.perfiosApi.updatedBy} updatedAt={store.perfiosApi.updatedAt} />
                            </div>
                            
                            {/* KYC Gateway */}
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <h4 className="font-semibold text-primary-text mb-2">KYC Gateway Configuration (BLUE-GUARD-2026)</h4>
                                <p className="text-sm text-muted mb-4">Select and configure your primary KYC vendor.</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="kyc-vendor" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>KYC Vendor</label>
                                        <select 
                                            id="kyc-vendor"
                                            className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                            value={store.kycApi.vendor}
                                            onChange={e => store.updateKycApiSettings({ vendor: e.target.value as any })}
                                        >
                                            <option value="hyperverge">HyperVerge</option>
                                            <option value="signzy">Signzy</option>
                                            <option value="decentro">Decentro</option>
                                        </select>
                                    </div>
                                    
                                    {store.kycApi.vendor === 'hyperverge' && (
                                        <>
                                            <Input label="HyperVerge App ID" className="w-full" value={store.kycApi.hypervergeAppId || ''} onChange={e => store.updateKycApiSettings({ hypervergeAppId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="HyperVerge App Key" type="password" className="w-full" value={store.kycApi.hypervergeAppKey || ''} onChange={e => store.updateKycApiSettings({ hypervergeAppKey: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                    {store.kycApi.vendor === 'signzy' && (
                                        <>
                                            <Input label="Signzy API Key" type="password" className="w-full" value={store.kycApi.signzyApiKey || ''} onChange={e => store.updateKycApiSettings({ signzyApiKey: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="Signzy Patient ID" className="w-full" value={store.kycApi.signzyPatientId || ''} onChange={e => store.updateKycApiSettings({ signzyPatientId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                    {store.kycApi.vendor === 'decentro' && (
                                        <>
                                            <Input label="Decentro Client ID" className="w-full" value={store.kycApi.decentroClientId || ''} onChange={e => store.updateKycApiSettings({ decentroClientId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="Decentro Client Secret" type="password" className="w-full" value={store.kycApi.decentroClientSecret || ''} onChange={e => store.updateKycApiSettings({ decentroClientSecret: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="Decentro Module Secret" type="password" className="w-full" value={store.kycApi.decentroModuleSecret || ''} onChange={e => store.updateKycApiSettings({ decentroModuleSecret: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="Decentro Provider Secret" type="password" className="w-full" value={store.kycApi.decentroProviderSecret || ''} onChange={e => store.updateKycApiSettings({ decentroProviderSecret: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                </div>
                                <LastUpdated updatedBy={store.kycApi.updatedBy} updatedAt={store.kycApi.updatedAt} />
                            </div>

                            {/* e-Sign Gateway */}
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <h4 className="font-semibold text-primary-text mb-2">e-Sign Gateway Configuration (BLUE-GUARD-2026)</h4>
                                <p className="text-sm text-muted mb-4">Select and configure your primary e-Sign vendor.</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="esign-vendor" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>e-Sign Vendor</label>
                                        <select 
                                            id="esign-vendor"
                                            className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                            value={store.esignApi.vendor}
                                            onChange={e => store.updateEsignApiSettings({ vendor: e.target.value as any, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                                        >
                                            <option value="digio">Digio</option>
                                            <option value="leegality">Leegality</option>
                                            <option value="signdesk">SignDesk</option>
                                        </select>
                                    </div>
                                    
                                    {store.esignApi.vendor === 'digio' && (
                                        <>
                                            <Input label="Digio Client ID" className="w-full" value={store.esignApi.digioClientId || ''} onChange={e => store.updateEsignApiSettings({ digioClientId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="Digio Client Secret" type="password" className="w-full" value={store.esignApi.digioClientSecret || ''} onChange={e => store.updateEsignApiSettings({ digioClientSecret: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                    {store.esignApi.vendor === 'leegality' && (
                                        <>
                                            <Input label="Leegality Auth Token" type="password" className="w-full" value={store.esignApi.leegalityAuthToken || ''} onChange={e => store.updateEsignApiSettings({ leegalityAuthToken: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                    {store.esignApi.vendor === 'signdesk' && (
                                        <>
                                            <Input label="SignDesk App ID" className="w-full" value={store.esignApi.signdeskAppId || ''} onChange={e => store.updateEsignApiSettings({ signdeskAppId: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                            <Input label="SignDesk API Key" type="password" className="w-full" value={store.esignApi.signdeskApiKey || ''} onChange={e => store.updateEsignApiSettings({ signdeskApiKey: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })} autoCapitalizeCustom={false} />
                                        </>
                                    )}
                                </div>
                                <LastUpdated updatedBy={store.esignApi.updatedBy} updatedAt={store.esignApi.updatedAt} />
                            </div>
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'Authentication Settings' && (
                    <SettingsCard title="Authentication Settings" icon={Phone} className="w-full">
                        <p className="text-sm text-muted -mt-2">Manage how users sign in to the application.</p>
                        <div className="space-y-6 pt-4">
                            <Checkbox
                                id="otp-enabled"
                                label="Enable OTP Phone Sign-In"
                                description="Allow users to sign in using a one-time password sent via SMS."
                                checked={store.otp.enabled}
                                onChange={e => store.updateOtpSettings({ enabled: e.target.checked, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                            />
                        </div>
                        <LastUpdated updatedBy={store.otp.updatedBy} updatedAt={store.otp.updatedAt} />
                    </SettingsCard>
                )}
                
                {activeTab === 'Client & Site Management' && (
                    <SettingsCard title="Client & Site Management" icon={Building} className="w-full">
                        <p className="text-sm text-muted -mt-2">Control workflows for site creation and management.</p>
                        <div className="space-y-6 pt-4">
                            <Checkbox
                                id="enable-provisional-sites"
                                label="Enable Provisional Site Creation"
                                description="Allows HR/Admins to create a site with just a name, providing a 90-day grace period to complete the full configuration for easier onboarding."
                                checked={store.siteManagement.enableProvisionalSites}
                                onChange={e => store.updateSiteManagementSettings({ enableProvisionalSites: e.target.checked, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                            />
                        </div>
                        <LastUpdated updatedBy={store.siteManagement.updatedBy} updatedAt={store.siteManagement.updatedAt} />
                    </SettingsCard>
                )}

                {activeTab === 'System & Data' && (
                    <SettingsCard title="System & Data" icon={Settings} className="w-full">
                        <p className="text-sm text-muted -mt-2">Manage core system settings and data operations.</p>
                        <div className="space-y-6 pt-4">
                            <Checkbox id="pincode-verification" label="Enable Pincode API Verification" description="Auto-fill City/State from pincode during onboarding." checked={store.address.enablePincodeVerification} onChange={e => store.updateAddressSettings({ enablePincodeVerification: e.target.checked })} />
                            
                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <label htmlFor="app-version" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Minimum Required App Version</label>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <Input 
                                        id="app-version"
                                        placeholder="e.g., 7.0.0" 
                                        className="max-w-[150px]"
                                        value={store.apiSettings.appVersion || ''} 
                                        onChange={e => store.updateApiSettings({ appVersion: e.target.value, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                                    />
                                    <p className="text-xs text-muted italic">Users with an app version older than this will be forced to update from app.paradigmfms.com. Set this to the latest released APK version.</p>
                                </div>
                            </div>

                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>
                                <Checkbox 
                                    id="auto-tracking-enabled" 
                                    label="Enable Automated Background Tracking Pings" 
                                    description="Automatically request location updates from active field staff in the background via silent push notifications." 
                                    checked={store.apiSettings.automatedTracking?.enabled || false} 
                                    onChange={e => store.updateApiSettings({ 
                                        automatedTracking: { 
                                            ...(store.apiSettings.automatedTracking || { intervalMinutes: 15 }), 
                                            enabled: e.target.checked 
                                        },
                                        updatedBy: user?.name,
                                        updatedAt: new Date().toISOString()
                                    })} 
                                />
                                
                                {store.apiSettings.automatedTracking?.enabled && (
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <label htmlFor="tracking-interval" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Ping Interval (Minutes)</label>
                                        <Input 
                                            id="tracking-interval"
                                            type="number"
                                            min={1}
                                            className="max-w-[150px]"
                                            value={store.apiSettings.automatedTracking?.intervalMinutes || 15}
                                            onChange={e => store.updateApiSettings({ 
                                                automatedTracking: { 
                                                    ...(store.apiSettings.automatedTracking || { enabled: true }), 
                                                    intervalMinutes: parseInt(e.target.value) || 15
                                                } 
                                            })}
                                        />
                                        <p className="text-xs text-muted italic mt-2">How frequently should the system ping active employees for location updates. (Default: 15 minutes)</p>
                                    </div>
                                )}
                            </div>

                            <div className={`p-4 border rounded-lg ${isMobile ? 'border-[#1f3d2b] bg-[#041b0f]' : 'border-border bg-gray-50'}`}>

                                <Checkbox 
                                    id="auto-backup" 
                                    label="Enable Automated Backups" 
                                    description="Automatically create a restoration point according to the chosen schedule." 
                                    checked={store.apiSettings.autoBackupEnabled || false} 
                                    onChange={e => store.updateApiSettings({ autoBackupEnabled: e.target.checked })} 
                                />
                                
                                {store.apiSettings.autoBackupEnabled && (
                                    <div className={`mt-4 pt-4 border-t ${isMobile ? 'border-white/10' : 'border-border'} grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`}>
                                        <div>
                                            <label htmlFor="backup-frequency" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Frequency</label>
                                            <select 
                                                id="backup-frequency"
                                                name="backup-frequency"
                                                className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                                value={store.apiSettings.backupSchedule?.frequency || 'daily'}
                                                onChange={e => store.updateApiSettings({ 
                                                    backupSchedule: { 
                                                        ...(store.apiSettings.backupSchedule || { startTime: '00:00', interval: 1 }), 
                                                        frequency: e.target.value as any 
                                                    } 
                                                })}
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="yearly">Yearly</option>
                                            </select>
                                        </div>

                                        {/* Frequency Specific Fields */}
                                        {store.apiSettings.backupSchedule?.frequency === 'weekly' && (
                                            <div>
                                                <label htmlFor="backup-day-of-week" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Day of Week</label>
                                                <select 
                                                    id="backup-day-of-week"
                                                    name="backup-day-of-week"
                                                    className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                                    value={store.apiSettings.backupSchedule?.dayOfWeek ?? 0}
                                                    onChange={e => store.updateApiSettings({ 
                                                        backupSchedule: { 
                                                            ...(store.apiSettings.backupSchedule || { frequency: 'weekly', startTime: '00:00' }), 
                                                            dayOfWeek: parseInt(e.target.value) 
                                                        } 
                                                    })}
                                                >
                                                    <option value={0}>Sunday</option>
                                                    <option value={1}>Monday</option>
                                                    <option value={2}>Tuesday</option>
                                                    <option value={3}>Wednesday</option>
                                                    <option value={4}>Thursday</option>
                                                    <option value={5}>Friday</option>
                                                    <option value={6}>Saturday</option>
                                                </select>
                                            </div>
                                        )}

                                        {store.apiSettings.backupSchedule?.frequency === 'monthly' && (
                                            <>
                                                <div>
                                                    <label htmlFor="backup-interval" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Interval</label>
                                                    <select 
                                                        id="backup-interval"
                                                        name="backup-interval"
                                                        className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                                        value={store.apiSettings.backupSchedule?.interval ?? 1}
                                                        onChange={e => store.updateApiSettings({ 
                                                            backupSchedule: { 
                                                                ...(store.apiSettings.backupSchedule || { frequency: 'monthly', startTime: '00:00' }), 
                                                                interval: parseInt(e.target.value) 
                                                            } 
                                                        })}
                                                    >
                                                        <option value={1}>Every Month</option>
                                                        <option value={3}>Every 3 Months</option>
                                                        <option value={6}>Every 6 Months</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="backup-day-of-month" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Day of Month</label>
                                                    <Input 
                                                        id="backup-day-of-month"
                                                        name="backup-day-of-month"
                                                        type="number"
                                                        min={1}
                                                        max={31}
                                                        className="w-full"
                                                        value={store.apiSettings.backupSchedule?.dayOfMonth ?? 1}
                                                        onChange={e => store.updateApiSettings({ 
                                                            backupSchedule: { 
                                                                ...(store.apiSettings.backupSchedule || { frequency: 'monthly', startTime: '00:00' }), 
                                                                dayOfMonth: parseInt(e.target.value) 
                                                            } 
                                                        })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {store.apiSettings.backupSchedule?.frequency === 'yearly' && (
                                            <>
                                                <div>
                                                    <label htmlFor="backup-month-of-year" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Month</label>
                                                    <select 
                                                        id="backup-month-of-year"
                                                        name="backup-month-of-year"
                                                        className={`w-full h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 ${isMobile ? 'border-white/10 bg-[#062b1a] text-white' : 'border-border bg-white text-primary-text'}`}
                                                        value={store.apiSettings.backupSchedule?.monthOfYear ?? 1}
                                                        onChange={e => store.updateApiSettings({ 
                                                            backupSchedule: { 
                                                                ...(store.apiSettings.backupSchedule || { frequency: 'yearly', startTime: '00:00' }), 
                                                                monthOfYear: parseInt(e.target.value) 
                                                            } 
                                                        })}
                                                    >
                                                        <option value={1}>January</option>
                                                        <option value={2}>February</option>
                                                        <option value={3}>March</option>
                                                        <option value={4}>April</option>
                                                        <option value={5}>May</option>
                                                        <option value={6}>June</option>
                                                        <option value={7}>July</option>
                                                        <option value={8}>August</option>
                                                        <option value={9}>September</option>
                                                        <option value={10}>October</option>
                                                        <option value={11}>November</option>
                                                        <option value={12}>December</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="backup-day-of-year" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Day</label>
                                                    <Input 
                                                        id="backup-day-of-year"
                                                        name="backup-day-of-year"
                                                        type="number"
                                                        min={1}
                                                        max={31}
                                                        className="w-full"
                                                        value={store.apiSettings.backupSchedule?.dayOfMonth ?? 1}
                                                        onChange={e => store.updateApiSettings({ 
                                                            backupSchedule: { 
                                                                ...(store.apiSettings.backupSchedule || { frequency: 'yearly', startTime: '00:00' }), 
                                                                dayOfMonth: parseInt(e.target.value) 
                                                            } 
                                                        })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div>
                                            <label htmlFor="backup-start-time" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isMobile ? 'text-white/70' : 'text-muted'}`}>Start Time</label>
                                            <Input 
                                                id="backup-start-time"
                                                name="backup-start-time"
                                                type="time"
                                                className="w-full"
                                                value={store.apiSettings.backupSchedule?.startTime || '00:00'}
                                                onChange={e => store.updateApiSettings({ 
                                                    backupSchedule: { 
                                                        ...(store.apiSettings.backupSchedule || { frequency: 'daily' }), 
                                                        startTime: e.target.value 
                                                    } 
                                                })}
                                            />
                                        </div>
                                        <div className="flex items-end col-span-1 sm:col-span-2 lg:col-span-3">
                                            <div className={`text-xs italic p-2 rounded-lg w-full ${isMobile ? 'text-white/60 bg-white/5' : 'text-muted bg-gray-100'}`}>
                                                Next run: {store.apiSettings.backupSchedule?.nextRun ? new Date(store.apiSettings.backupSchedule.nextRun).toLocaleString() : 'Saving will calculate the next run based on this schedule'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary-text mb-2">Database Backups</h4>
                                <p className="text-sm text-muted mb-4">Manage system restoration points. Backups are stored securely in Supabase.</p>
                                
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={async () => {
                                                const name = prompt("Enter a name for this restoration point:");
                                                if (!name) return;
                                                setIsExporting(true);
                                                try {
                                                    await api.createBackup(name);
                                                    setToast({ message: 'Restoration point created!', type: 'success' });
                                                    // Refresh backups list
                                                    loadBackups();
                                                } catch (err) {
                                                    setToast({ message: 'Failed to create backup.', type: 'error' });
                                                } finally {
                                                    setIsExporting(false);
                                                }
                                            }}
                                            isLoading={isExporting}
                                        >
                                            <Server className="mr-2 h-4 w-4" /> Create Restoration Point
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                                            <Download className="mr-2 h-4 w-4" /> Instant Export (JSON)
                                        </Button>
                                    </div>

                                    <div className="bg-page rounded-lg border border-border overflow-hidden">
                                        <div className="px-4 py-2 bg-muted/30 border-b border-border text-xs font-bold text-muted uppercase tracking-wider">
                                            Recent Restoration Points
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {backups.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-muted">
                                                    No restoration points found.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-border">
                                                    {backups.map((b) => (
                                                        <div key={b.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                                            <div>
                                                                <div className="font-bold text-primary-text">{b.name}</div>
                                                                <div className="text-xs text-muted">
                                                                    {new Date(b.createdAt).toLocaleString()} • {Math.round(b.sizeBytes / 1024)} KB • By {b.createdByName}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    title="Restore from this point"
                                                                    className="p-2 hover:bg-accent/10 rounded-lg text-accent-dark transition-colors"
                                                                    onClick={async () => {
                                                                        if (!confirm(`CAUTION: This will overwrite CURRENT data with the snapshot from ${b.name}. Action cannot be undone. Proceed?`)) return;
                                                                        setIsExporting(true);
                                                                        try {
                                                                            await api.restoreFromBackup(b.id);
                                                                            setToast({ message: 'System restored successfully!', type: 'success' });
                                                                            setTimeout(() => window.location.reload(), 2000);
                                                                        } catch (err: any) {
                                                                            setToast({ message: `Restore failed: ${err.message}`, type: 'error' });
                                                                        } finally {
                                                                            setIsExporting(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Server className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    title="Download snapshot"
                                                                    className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const { data: blob } = await (api as any).supabase.storage
                                                                                .from('backups')
                                                                                .download(b.snapshotPath);
                                                                            const url = window.URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = `backup_${b.name.replace(/\s+/g, '_')}.json`;
                                                                            a.click();
                                                                        } catch (err) {
                                                                            setToast({ message: 'Download failed.', type: 'error' });
                                                                        }
                                                                    }}
                                                                >
                                                                    <Download className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <LastUpdated updatedBy={store.apiSettings.updatedBy} updatedAt={store.apiSettings.updatedAt} />
                    </SettingsCard>
                )}

                {activeTab === 'Notification Settings' && (
                    <SettingsCard title="Notification Settings" icon={Mail} className="w-full">
                        <p className="text-sm text-muted -mt-2">Configure how the system sends notifications.</p>
                        <div className="space-y-6 pt-4">
                            <Checkbox
                                id="email-notif-enabled"
                                label="Enable Email Notifications"
                                description="Send emails for important events like task assignments. SMTP must be configured on the backend."
                                checked={store.notifications.email.enabled}
                                onChange={e => store.updateNotificationSettings({ email: { enabled: e.target.checked }, updatedBy: user?.name, updatedAt: new Date().toISOString() })}
                            />
                        </div>
                        <LastUpdated updatedBy={store.notifications.updatedBy} updatedAt={store.notifications.updatedAt} />
                    </SettingsCard>
                )}
            </div>
        </div>
    );
};