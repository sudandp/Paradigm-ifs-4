import React, { useState } from 'react';
import { api } from '../../services/api';
import type { User } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import { RotateCw, Copy, Check, AlertTriangle, KeyRound } from 'lucide-react';
import { safeCopyToClipboard } from '../../utils/clipboardHelper';

interface BulkPasscodeResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onSuccess: () => void;
}

interface ResetResult {
  user: User;
  passcode: string;
  success: boolean;
  error?: string;
}

export const BulkPasscodeResetModal: React.FC<BulkPasscodeResetModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onSuccess
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [results, setResults] = useState<ResetResult[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleResetConfirm = async () => {
    setIsResetting(true);
    const resetResults: ResetResult[] = [];

    for (const user of selectedUsers) {
      try {
        const newCode = await api.resetUserPasscode(user.id);
        resetResults.push({
          user,
          passcode: newCode,
          success: true
        });
      } catch (err: any) {
        console.error(`Failed to reset passcode for ${user.name}:`, err);
        resetResults.push({
          user,
          passcode: 'FAILED',
          success: false,
          error: err.message || 'Reset failed'
        });
      }
    }

    setResults(resetResults);
    setIsResetting(false);
    onSuccess();
  };

  const handleCopyAll = () => {
    if (!results) return;
    const lines = results
      .filter(r => r.success)
      .map(r => `• ${r.user.name} (${r.user.email}): ${r.passcode}`)
      .join('\n');

    const content = `🔐 Generated Temporary Passcodes (${results.length} Users):\n\n${lines}\n\nNote: Please ask employees to log in and change their passcode.`;
    safeCopyToClipboard(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
    setToast({ message: 'All passcodes copied to clipboard!', type: 'success' });
  };

  const handleCopySingle = (code: string, index: number) => {
    safeCopyToClipboard(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClose = () => {
    setResults(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {results === null ? (
        <Modal
          isOpen={isOpen}
          onClose={handleClose}
          title={`Reset Passcodes (${selectedUsers.length} Users)`}
          onConfirm={handleResetConfirm}
          isConfirming={isResetting}
          confirmButtonText={isResetting ? "Resetting Passcodes..." : `Reset Passcodes for ${selectedUsers.length} Users`}
          confirmButtonVariant="primary"
        >
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-600">
              Are you sure you want to reset the passcodes for all <strong>{selectedUsers.length}</strong> selected employees?
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-bold">Important Security Notice</p>
                <p className="text-[11px] text-amber-700/90 mt-0.5">
                  Each user will be assigned a newly generated 4-digit temporary passcode. You will be able to review and copy all passcodes on the next screen.
                </p>
              </div>
            </div>

            {/* Selected Users preview */}
            <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50 divide-y divide-slate-100">
              {selectedUsers.map(user => (
                <div key={user.id} className="py-1.5 px-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 truncate">{user.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono truncate">{user.email}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Passcodes Generated</h3>
                  <p className="text-[11px] text-slate-500">
                    {results.filter(r => r.success).length} of {results.length} passcodes reset successfully
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyAll}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAll ? 'Copied All!' : 'Copy All'}
              </button>
            </div>

            {/* Passcodes List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {results.map((res, index) => (
                <div
                  key={res.user.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{res.user.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{res.user.email}</p>
                  </div>

                  {res.success ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        {res.passcode}
                      </span>
                      <button
                        onClick={() => handleCopySingle(res.passcode, index)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                        title="Copy passcode"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                      Failed
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <Button onClick={handleClose} variant="primary" className="!px-6 !py-2 text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkPasscodeResetModal;
