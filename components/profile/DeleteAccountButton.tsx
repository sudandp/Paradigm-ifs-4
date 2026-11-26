import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

/**
 * Self-service account deletion (Apple 5.1.1(v), Google Play account deletion policy).
 * Must stay reachable from the profile screen on every platform, without contacting support.
 */
const DeleteAccountButton: React.FC<{ className?: string }> = ({ className }) => {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (busy) return;
        setOpen(false);
        setTyped('');
        setError(null);
    };

    const confirmDelete = async () => {
        setBusy(true);
        setError(null);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
                body: { confirm: 'DELETE' },
            });
            if (fnError || !data?.ok) throw new Error(data?.error || fnError?.message || 'Deletion failed');
            // The login no longer exists; clear local session state.
            window.location.hash = '#/auth/logout';
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Account deletion failed. Please contact support.');
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={className ?? 'flex items-center justify-center gap-2 py-2 text-xs font-semibold text-gray-400 hover:text-rose-600 transition-colors'}
            >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Delete account
            </button>

            {open && createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn"
                    style={{
                        paddingTop: 'max(env(safe-area-inset-top, 0px), 1.5rem)',
                        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2.5rem)',
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-account-title"
                    onClick={close}
                >
                    <div 
                        className="w-full max-w-sm rounded-2xl bg-[#0b2416] border border-emerald-500/30 p-6 shadow-2xl text-white my-auto animate-fade-in-scale" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="delete-account-title" className="text-lg font-bold text-white mb-3">Delete your account?</h2>
                        <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                            <p>This permanently deletes your login and removes your name, email, phone number and profile photo. You will be signed out and cannot sign in again.</p>
                            <p className="text-xs text-slate-400">Employment records your employer must keep by law (attendance, payroll and statutory registers) are retained only for the legally required period.</p>
                        </div>
                        <label className="block mt-4 text-xs font-medium text-slate-300" htmlFor="delete-account-confirm">
                            Type <strong className="text-rose-400">DELETE</strong> to confirm
                        </label>
                        <input
                            id="delete-account-confirm"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            autoComplete="off"
                            autoCapitalize="characters"
                            placeholder="DELETE"
                            className="mt-1.5 w-full rounded-xl border border-emerald-500/40 bg-[#041b0f] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 tracking-wider font-mono"
                        />
                        {error && <p className="mt-3 text-xs text-rose-400" role="alert">{error}</p>}
                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={close}
                                disabled={busy}
                                className="flex-1 rounded-xl border border-emerald-500/30 bg-white/5 hover:bg-white/10 py-2.5 text-sm font-semibold text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={busy || typed.trim().toUpperCase() !== 'DELETE'}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 cursor-pointer shadow-md shadow-rose-900/40"
                            >
                                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                Delete account
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default DeleteAccountButton;
