import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Send, Loader2, Users, AlertTriangle, Info, AlertCircle, Filter } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import type { User, Role } from '../../types';

const Alerts: React.FC = () => {
    const { user } = useAuthStore();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [alertLevel, setAlertLevel] = useState<'info' | 'warning' | 'critical'>('info');
    const [isSending, setIsSending] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [fetchedRoles, fetchedUsers] = await Promise.all([
                    api.getRoles(),
                    api.getUsers({ fetchAll: true })
                ]);
                setRoles(fetchedRoles);
                setUsers(fetchedUsers);
            } catch (err) {
                console.error("Failed to fetch roles or users", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const filteredUsers = useMemo(() => {
        const filtered = selectedRole === 'all' 
            ? users 
            : users.filter(u => u.roleId === selectedRole);
        return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, selectedRole]);

    const userOptions = useMemo(() => [
        { id: 'all', name: 'All Users' },
        ...filteredUsers.map(u => ({ id: u.id, name: u.name || 'Unknown' }))
    ], [filteredUsers]);

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim() || !message.trim()) {
            setToast({ message: "Please enter both a title and message.", type: "error" });
            return;
        }

        const confirmMessage = selectedUserId && selectedUserId !== 'all'
            ? `Are you sure you want to send this alert to ${users.find(u => u.id === selectedUserId)?.name}?`
            : selectedRole !== 'all'
                ? `Are you sure you want to broadcast this alert to all users with the role "${selectedRole}"?`
                : "Are you sure you want to broadcast this message to ALL users? This action cannot be undone.";

        setConfirmConfig({
            title: 'Confirm Alert Broadcast',
            message: confirmMessage,
            onConfirm: performSend
        });
        setShowConfirmModal(true);
    };

    const performSend = async () => {
        setShowConfirmModal(false);
        setIsSending(true);
        try {
            await api.broadcastNotification({
                role: selectedRole === 'all' ? undefined : selectedRole,
                userIds: (selectedUserId && selectedUserId !== 'all') ? [selectedUserId] : undefined,
                message: `${title}: ${message}`,
                title: title,
                type: 'emergency_broadcast',
                severity: alertLevel === 'critical' ? 'High' : alertLevel === 'warning' ? 'Medium' : 'Low'
            });

            setToast({ message: "Alert sent successfully.", type: "success" });
            setTitle('');
            setMessage('');
            setAlertLevel('info');
            setSelectedRole('all');
            setSelectedUserId('');
        } catch (error: any) {
            console.error('Failed to send broadcast. Full error object:', error);
            if (error?.message) {
                 console.error('Error message:', error.message);
            }
            if (error?.details) {
                 console.error('Error details:', error.details);
            }
            setToast({ message: "Failed to send alert. Please try again.", type: "error" });
        } finally {
            setIsSending(false);
        }
    };

    const getIcon = () => {
        switch (alertLevel) {
            case 'info': return <Info className="h-5 w-5 text-blue-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className={`flex items-center gap-3 mb-6 ${isMobile ? 'mt-2' : ''}`}>
                <div className={`p-2 md:p-3 rounded-xl ${isMobile ? 'bg-red-500/20' : 'bg-red-50'}`}>
                    <ShieldAlert className={`h-6 w-6 md:h-8 md:w-8 ${isMobile ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <div>
                    <h1 className={`text-xl md:text-3xl font-bold leading-tight ${isMobile ? 'text-white' : 'text-gray-900'}`}>Emergency Alerts</h1>
                    <p className={`text-sm mt-1 ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Broadcast important messages to all employees instantly</p>
                </div>
            </div>

            <div className={`rounded-2xl overflow-hidden ${isMobile ? 'bg-transparent border-none shadow-none' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className={`${isMobile ? 'bg-transparent border-none' : 'bg-slate-50 border-b border-gray-200'} px-6 py-4 flex items-center justify-between`}>
                    <h2 className={`font-semibold flex items-center gap-2 ${isMobile ? 'text-white/90' : 'text-gray-800'}`}>
                        <Users className={`h-4 w-4 ${isMobile ? 'text-white/40' : 'text-gray-500'}`} />
                        Compose Broadcast
                    </h2>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wide ${
                        isMobile ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-red-100 text-red-700'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isMobile ? 'bg-red-400' : 'bg-red-500'}`}></span>
                        Live System
                    </span>
                </div>

                <form onSubmit={handleSendBroadcast} className="p-0">
                    {/* Audience Selection - Full Width Section */}
                    <div className={`p-6 ${isMobile ? 'bg-transparent border-none' : 'bg-slate-50/50 border-b border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                <Filter className="h-4 w-4" />
                            </div>
                            <h3 className={`text-base font-bold ${isMobile ? 'text-white' : 'text-gray-800'}`}>1. Target Audience</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className={`block text-xs font-bold uppercase tracking-tight ml-1 ${isMobile ? 'text-white/40' : 'text-gray-500'}`}>Role</label>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => {
                                        setSelectedRole(e.target.value);
                                        setSelectedUserId(''); // Reset user when role changes
                                    }}
                                    className={`w-full form-input shadow-sm focus:border-emerald-500 focus:ring-emerald-500 ${
                                        isMobile ? 'bg-white/10 text-white border-white/20' : 'bg-white border-gray-300'
                                    }`}
                                    disabled={isSending || isLoadingData}
                                >
                                    <option value="all">All Roles (Everyone)</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.displayName}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className={`block text-xs font-bold uppercase tracking-tight ml-1 ${isMobile ? 'text-white/40' : 'text-gray-500'}`}>Specific Member (Optional)</label>
                                <SearchableSelect
                                    placeholder="Select specific user"
                                    options={userOptions}
                                    value={selectedUserId || (selectedRole === 'all' && !selectedUserId ? 'all' : '')}
                                    onChange={(id) => {
                                        setSelectedUserId(id === 'all' ? '' : id);
                                    }}
                                    isLoading={isLoadingData}
                                    className={`w-full ${isMobile ? 'bg-white/10 text-white border-white/20' : 'bg-white'}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Message Content - Primary Area */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                        <Info className="h-4 w-4" />
                                    </div>
                                    <h3 className={`text-base font-bold ${isMobile ? 'text-white' : 'text-gray-800'}`}>2. Compose Message</h3>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <label className={`block text-sm font-semibold ${isMobile ? 'text-white/70' : 'text-gray-700'}`}>Alert Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g., Office Closure Alert"
                                            className={`w-full form-input text-lg font-medium ${
                                                isMobile ? 'bg-white/10 text-white border-white/20' : ''
                                            }`}
                                            required
                                            disabled={isSending}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={`block text-sm font-semibold ${isMobile ? 'text-white/70' : 'text-gray-700'}`}>Detailed Message</label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Enter the full alert details here..."
                                            className={`w-full form-input min-h-[160px] resize-y leading-relaxed ${
                                                isMobile ? 'bg-white/10 text-white border-white/20' : ''
                                            }`}
                                            required
                                            disabled={isSending}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Priority & Send - Interaction Area */}
                            <div className="space-y-8 lg:border-l lg:border-gray-100 lg:pl-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <h3 className={`text-base font-bold ${isMobile ? 'text-white' : 'text-gray-800'}`}>3. Set Priority</h3>
                                    </div>
                                    
                                    <div className="space-y-2.5">
                                        {(['info', 'warning', 'critical'] as const).map((l) => {
                                            const isSelected = alertLevel === l;
                                            
                                            let selectedClasses = '';
                                            if (l === 'critical') {
                                                selectedClasses = isMobile 
                                                    ? 'bg-red-600 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                                                    : 'border-red-500 bg-red-50 ring-1 ring-red-200';
                                            } else if (l === 'warning') {
                                                selectedClasses = isMobile 
                                                    ? 'bg-amber-600 border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)]' 
                                                    : 'border-amber-500 bg-amber-50 ring-1 ring-amber-200';
                                            } else {
                                                selectedClasses = isMobile 
                                                    ? 'bg-blue-600 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                                                    : 'border-blue-500 bg-blue-50 ring-1 ring-blue-200';
                                            }

                                            return (
                                                <div 
                                                    key={l}
                                                    onClick={() => !isSending && setAlertLevel(l)}
                                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                                                        isSelected 
                                                            ? selectedClasses
                                                            : isMobile ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300'
                                                    } ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {l === 'critical' && <AlertCircle className={`h-5 w-5 ${isSelected ? (isMobile ? 'text-white' : 'text-red-600') : 'text-gray-400'}`} />}
                                                    {l === 'warning' && <AlertTriangle className={`h-5 w-5 ${isSelected ? (isMobile ? 'text-white' : 'text-amber-600') : 'text-gray-400'}`} />}
                                                    {l === 'info' && <Info className={`h-5 w-5 ${isSelected ? (isMobile ? 'text-white' : 'text-blue-600') : 'text-gray-400'}`} />}
                                                    <span className={`font-bold capitalize ${
                                                        isSelected 
                                                            ? (isMobile ? 'text-white' : 'text-gray-900') 
                                                            : (isMobile ? 'text-white/60' : 'text-gray-500')
                                                    }`}>
                                                        {l}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-gray-100">
                                    <Button 
                                        type="submit" 
                                        disabled={isSending || !title || !message}
                                        className={`w-full py-4 justify-center text-lg font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] ${
                                            alertLevel === 'critical' 
                                            ? 'bg-red-600 hover:bg-red-700 border-red-700 text-white shadow-red-500/20' 
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                    >
                                        {isSending ? (
                                            <><Loader2 className="h-6 w-6 mr-3 animate-spin" /> Dispatching...</>
                                        ) : (
                                            <><Send className="h-6 w-6 mr-3" /> {selectedUserId && selectedUserId !== 'all' ? 'Send to User' : selectedRole !== 'all' ? 'Send to Role' : 'Send to All'}</>
                                        )}
                                    </Button>
                                    <p className="text-[10px] text-gray-400 text-center mt-3 uppercase tracking-widest font-bold">
                                        Secured Broadcast Channel
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {confirmConfig && (
                <Modal
                    isOpen={showConfirmModal}
                    onClose={() => setShowConfirmModal(false)}
                    title={confirmConfig.title}
                >
                    <div className="space-y-4">
                        <p className="text-gray-600 font-medium">{confirmConfig.message}</p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmConfig.onConfirm}
                                isLoading={isSending}
                                className={alertLevel === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                            >
                                Confirm & Send
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Alerts;
