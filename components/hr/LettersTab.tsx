import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import StageBadge from './StageBadge';
import LetterComposer from './LetterComposer';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { Mail, Plus, Trash2, Calendar, FileText, Download, RotateCcw, ShieldAlert, FileMinus } from 'lucide-react';
import { LetterType } from '../../types';

interface Letter {
  id: string;
  letterType: string;
  refNumber: string;
  status: string;
  createdAt: string;
  pdfPath?: string;
  approvedBy?: string;
  approvalNote?: string;
  issuedAt?: string;
}

interface LettersTabProps {
  candidateId: string;
  candidateName: string;
  onLetterActivity: () => void;
}

const LETTER_LABELS: Record<string, string> = {
  offer: 'Offer Letter',
  appointment: 'Appointment Letter',
  confirmation: 'Confirmation Letter',
  promotion: 'Promotion Letter',
  increment: 'Increment Letter',
  transfer: 'Transfer Letter',
  warning: 'Warning Letter',
  show_cause: 'Show Cause Notice',
  experience: 'Experience Letter',
  termination: 'Termination Letter'
};

const LettersTab: React.FC<LettersTabProps> = ({ candidateId, candidateName, onLetterActivity }) => {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>('offer');
  const [creating, setCreating] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const data = await hrmApi.getLetters({ candidateId });
      setLetters(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load candidate letters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [candidateId, refreshTrigger]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await hrmApi.createLetter(selectedType, candidateId);
      toast.success('Letter draft created');
      setShowCreateModal(false);
      onLetterActivity();
      setRefreshTrigger(prev => prev + 1);
      // Automatically open the workspace for the newly created draft
      if (data && data.id) {
        setActiveWorkspaceId(data.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create draft');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this issued letter? This cannot be undone.')) return;
    try {
      await hrmApi.revokeLetter(id);
      toast.success('Letter revoked successfully');
      onLetterActivity();
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to revoke letter');
    }
  };

  if (activeWorkspaceId) {
    return (
      <LetterComposer
        letterId={activeWorkspaceId}
        onClose={() => {
          setActiveWorkspaceId(null);
          setRefreshTrigger(prev => prev + 1);
        }}
        onLetterIssued={() => {
          onLetterActivity();
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 py-4 animate-pulse">
        <div className="h-10 bg-slate-100 rounded w-1/4" />
        <div className="h-20 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-3 border-b border-border">
        <h3 className="text-sm font-bold text-primary-text uppercase tracking-tight">Dynamic Letters & Contracts</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 bg-[#006b3f] hover:bg-[#005230] text-white px-3 py-1.5 rounded-[2px] font-mono font-bold text-[10px] uppercase tracking-wider transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Draft
        </button>
      </div>

      {letters.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-[2px] bg-slate-50/50">
          <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-500">No letters generated yet</p>
          <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Create a draft to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => {
            const isDraft = letter.status === 'draft';
            const isIssued = letter.status === 'issued';
            const isRevoked = letter.status === 'revoked';
            const dateStr = new Date(letter.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div
                key={letter.id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-border rounded-[2px] bg-white hover:shadow-sm transition-all gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary-text">
                      {LETTER_LABELS[letter.letterType] || letter.letterType.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[8px] font-mono font-bold uppercase tracking-wider ${
                      isIssued ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      isRevoked ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {letter.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono font-bold uppercase">
                    <span>REF: {letter.refNumber}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: {dateStr}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setActiveWorkspaceId(letter.id)}
                    className="px-3 py-1.5 border border-border hover:border-slate-400 text-slate-700 rounded-[2px] text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                  >
                    Open Workspace
                  </button>

                  {isIssued && letter.pdfPath && (
                    <a
                      href={letter.pdfPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-border hover:bg-slate-100 text-slate-700 rounded-[2px] text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </a>
                  )}

                  {isIssued && (
                    <button
                      onClick={() => handleRevoke(letter.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-[2px] text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draft Creator Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white border border-border w-full max-w-sm p-6 rounded-[2px] shadow-2xl animate-fade-in-scale">
            <h4 className="text-sm font-bold text-primary-text uppercase tracking-tight mb-4 pb-2 border-b border-slate-50 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" />
              Generate Letter Draft
            </h4>
            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Letter Template
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-10 px-3 bg-page border border-border rounded-[2px] text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {Object.entries(LETTER_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={creating}>
                  Generate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LettersTab;
