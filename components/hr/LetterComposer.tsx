import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { FileText, Download, Send, Copy, AlertCircle, Edit, Eye, ArrowLeft, RefreshCw } from 'lucide-react';

interface LetterComposerProps {
  letterId: string;
  onClose: () => void;
  onLetterIssued: () => void;
}

const PLACEHOLDERS = [
  { token: '{{candidate_name}}', desc: 'Full Name of Candidate' },
  { token: '{{designation}}', desc: 'Target Designation' },
  { token: '{{joining_date}}', desc: 'Date of Joining' },
  { token: '{{ctc_annual}}', desc: 'Annual CTC (INR)' },
  { token: '{{ctc_monthly}}', desc: 'Monthly CTC (INR)' },
  { token: '{{probation_days}}', desc: 'Probation length (Days)' },
  { token: '{{reporting_manager}}', desc: 'Supervisor name' },
  { token: '{{location}}', desc: 'Work Location' },
  { token: '{{ref_number}}', desc: 'Letter Reference No' },
  { token: '{{company_name}}', desc: 'Paradigm Services' },
  { token: '{{issue_date}}', desc: 'Date of Issuance' }
];

const LetterComposer: React.FC<LetterComposerProps> = ({ letterId, onClose, onLetterIssued }) => {
  const [letter, setLetter] = useState<any>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [issuing, setIssuing] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');

  const fetchLetter = async () => {
    setLoading(true);
    try {
      const data = await hrmApi.getLetter(letterId);
      setLetter(data);
      setHtmlContent(data.templateSnapshot || '');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load letter details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetter();
  }, [letterId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${text}`);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await hrmApi.updateLetterDraft(letterId, htmlContent);
      toast.success('Draft updated successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueLetter = async () => {
    if (!window.confirm('Are you sure you want to issue this letter? This will lock edits and compile the final PDF.')) return;
    setIssuing(true);
    try {
      // First save the current content
      await hrmApi.updateLetterDraft(letterId, htmlContent);
      // Issue
      const data = await hrmApi.issueLetter(letterId);
      toast.success('Letter issued and compiled successfully');
      setLetter(data);
      onLetterIssued();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to issue letter');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Loading Letter Workspace...</p>
      </div>
    );
  }

  const isIssued = letter?.status === 'issued';
  const isRevoked = letter?.status === 'revoked';

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Workspace Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-50 border border-border rounded-[2px] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-primary-text uppercase tracking-tight">
                Letter Workspace: {letter?.refNumber || 'Draft'}
              </h2>
              <span className={`px-2 py-0.5 rounded-[2px] text-[8px] font-mono font-bold uppercase tracking-wider ${
                isIssued ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                isRevoked ? 'bg-red-50 text-red-700 border border-red-100' :
                'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {letter?.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mt-0.5">
              Type: {letter?.letterType} | Candidate: {letter?.candidate?.candidateName || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Preview toggler */}
          <div className="flex border border-border p-0.5 rounded-[2px] bg-slate-50">
            <button
              onClick={() => setPreviewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-tighter rounded-[2px] transition-all ${
                previewMode === 'edit' ? 'bg-white text-primary-text shadow-sm' : 'text-slate-500 hover:text-primary-text'
              }`}
              disabled={isIssued || isRevoked}
            >
              <Edit className="w-3.5 h-3.5" />
              Editor
            </button>
            <button
              onClick={() => setPreviewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-tighter rounded-[2px] transition-all ${
                previewMode === 'preview' ? 'bg-white text-primary-text shadow-sm' : 'text-slate-500 hover:text-primary-text'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Live Preview
            </button>
          </div>

          {!isIssued && !isRevoked && (
            <>
              <Button onClick={handleSaveDraft} variant="secondary" isLoading={saving} className="!rounded-[2px] !text-xs !py-2">
                Save Draft
              </Button>
              <Button onClick={handleIssueLetter} variant="primary" isLoading={issuing} className="!rounded-[2px] !text-xs !py-2 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Issue Letter
              </Button>
            </>
          )}

          {isIssued && letter?.pdfPath && (
            <a
              href={letter.pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary !rounded-[2px] !text-xs !py-2 flex items-center gap-1.5 shadow-md shadow-accent/10"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Textarea Editor or Info panel */}
        {previewMode === 'edit' && !isIssued && !isRevoked ? (
          <div className="flex-1 flex flex-col p-4 bg-slate-50 overflow-hidden">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
              HTML Document Source code
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="flex-1 w-full p-4 border border-border rounded-[2px] font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-accent/10 resize-none shadow-inner"
            />
          </div>
        ) : (
          /* Live Resolved Preview */
          <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-y-auto items-center">
            {/* Simulated A4 document page */}
            <div className="w-[210mm] min-h-[297mm] bg-white border border-border shadow-lg p-16 text-primary-text relative">
              {/* Ref stamp top right */}
              <div className="absolute top-8 right-8 text-[10px] font-mono font-bold text-slate-400">
                REF: {letter?.refNumber || 'DRAFT'}
              </div>

              {/* Resolved template injection */}
              <div
                className="prose prose-sm max-w-none font-sans text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>
        )}

        {/* Right Side: Placeholders drawer */}
        {!isIssued && !isRevoked && (
          <div className="w-80 border-l border-border bg-white flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 flex items-center gap-2 flex-shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-primary-text uppercase tracking-tight">Placeholders Guide</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <div className="bg-amber-50 border border-amber-200 rounded-[2px] p-3 text-[10px] text-amber-800 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Click any placeholder below to copy its token, then insert it into your HTML source where needed.
                </span>
              </div>

              {PLACEHOLDERS.map((ph) => (
                <div
                  key={ph.token}
                  onClick={() => copyToClipboard(ph.token)}
                  className="p-2.5 border border-border hover:border-accent hover:bg-slate-50 rounded-[2px] cursor-pointer group transition-all"
                >
                  <div className="flex justify-between items-center mb-1">
                    <code className="text-xs font-mono font-black text-slate-800 group-hover:text-accent transition-colors">
                      {ph.token}
                    </code>
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-accent opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-normal">
                    {ph.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LetterComposer;
