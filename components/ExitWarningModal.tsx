// components/ExitWarningModal.tsx
// Custom-styled exit warning modal for when users try to minimize/close
// the app while clocked in. Replaces the plain window.confirm() dialog
// with a premium dark modal matching the app's emerald/dark green theme.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, DollarSign, X, ArrowDown } from 'lucide-react';

interface ExitWarningModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ExitWarningModal: React.FC<ExitWarningModalProps> = ({ isOpen, onConfirm, onCancel }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="exit-warning-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
                    style={{ background: 'rgba(2, 20, 10, 0.88)', backdropFilter: 'blur(10px)' }}
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 40 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 40 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-3xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(155deg, #0a2818 0%, #041b0f 100%)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            boxShadow: '0 0 50px rgba(245, 158, 11, 0.15), 0 25px 50px rgba(0,0,0,0.5)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Amber glow ring */}
                        <motion.div
                            animate={{ opacity: [0.2, 0.45, 0.2] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute -inset-0.5 rounded-3xl pointer-events-none"
                            style={{ border: '2px solid rgba(245, 158, 11, 0.6)', background: 'transparent' }}
                        />

                        <div className="relative p-6">
                            {/* Warning icon */}
                            <div className="flex justify-center mb-4">
                                <motion.div
                                    animate={{ scale: [1, 1.08, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                        boxShadow: '0 0 25px rgba(245, 158, 11, 0.2)',
                                    }}
                                >
                                    <AlertTriangle className="w-7 h-7 text-amber-400" />
                                </motion.div>
                            </div>

                            {/* Title */}
                            <div className="text-center mb-4">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">
                                    Important Warning
                                </p>
                                <h2 className="text-xl font-black text-white leading-tight">
                                    You are currently clocked in
                                </h2>
                            </div>

                            {/* Info cards */}
                            <div className="space-y-2 mb-5">
                                <div
                                    className="flex items-start gap-3 rounded-2xl p-3"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                         style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                        <MapPin className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-white/80 leading-snug">
                                            GPS tracking will stop if you force close this app.
                                        </p>
                                        <p className="text-[10px] text-white/40 mt-0.5">
                                            Your route & work hours won't be recorded.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className="flex items-start gap-3 rounded-2xl p-3"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                         style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <DollarSign className="w-4 h-4 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-white/80 leading-snug">
                                            This directly affects your salary & attendance.
                                        </p>
                                        <p className="text-[10px] text-white/40 mt-0.5">
                                            Missing data may lead to payroll discrepancies.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="space-y-2.5">
                                <button
                                    onClick={onCancel}
                                    className="w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#fff',
                                        boxShadow: '0 8px 20px rgba(16,185,129,0.3)',
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                    Keep App Running
                                </button>

                                <button
                                    onClick={onConfirm}
                                    className="w-full py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.45)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                    Minimize Anyway
                                </button>
                            </div>

                            <p className="text-center text-[9px] text-slate-600 mt-4 font-medium">
                                The app must remain open in the background for accurate tracking.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ExitWarningModal;
