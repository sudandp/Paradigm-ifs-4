import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import {
  LayoutTemplate, Save, Copy, AlertTriangle, Eye, Edit, RefreshCw, FileText, CheckCircle
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface LetterTemplate {
  id: string;
  name: string;
  letterType: string;
  bodyHtml: string;
  updatedAt?: string;
}

const PLACEHOLDERS = [
  { token: '{{candidate_name}}', desc: 'Full Name of Candidate' },
  { token: '{{designation}}', desc: 'Target Designation / Role' },
  { token: '{{joining_date}}', desc: 'Date of Joining (DD/MM/YYYY)' },
  { token: '{{ctc_annual}}', desc: 'Annual Cost-To-Company (INR)' },
  { token: '{{ctc_monthly}}', desc: 'Monthly Cost-To-Company (INR)' },
  { token: '{{probation_days}}', desc: 'Probation length in days (90)' },
  { token: '{{reporting_manager}}', desc: 'Assigned Reporting Manager' },
  { token: '{{location}}', desc: 'Deployment Office/Site Location' },
  { token: '{{ref_number}}', desc: 'Letter Reference Number' },
  { token: '{{company_name}}', desc: 'Paradigm Services' },
  { token: '{{issue_date}}', desc: 'Current Date of Issuance' }
];

const TemplateManagerPage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await hrmApi.getTemplates();
      setTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplate(data[0]);
        setBodyHtml(data[0].bodyHtml || '');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load letter templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectTemplate = (temp: LetterTemplate) => {
    setSelectedTemplate(temp);
    setBodyHtml(temp.bodyHtml || '');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${text}`);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await hrmApi.updateTemplate(selectedTemplate.letterType, bodyHtml);
      toast.success('Template saved successfully');
      // Update local state
      setTemplates(prev =>
        prev.map(t => (t.id === selectedTemplate.id ? { ...t, bodyHtml } : t))
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted animate-pulse">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in min-w-0 overflow-x-hidden min-h-screen ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24' : 'space-y-8 pb-32 md:pb-8'}`}>
      {/* Header */}
      <div className={`flex justify-between items-start sm:items-center ${isMobile ? 'flex-col gap-4' : 'flex-col sm:flex-row gap-6'}`}>
        <div className="w-full sm:w-auto">
          <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl text-white' : 'text-xl md:text-2xl text-primary-text'}`}>Template Manager</h1>
          <p className={`mt-1 text-xs md:text-sm leading-relaxed ${isMobile ? 'text-white/60' : 'text-muted'}`}>Design & manage HR letter templates</p>
        </div>
        <Button
          onClick={handleSave}
          variant="primary"
          isLoading={saving}
          className="btn btn-primary btn-md gap-2 shadow-xl shadow-accent/20 hover:shadow-accent/40 active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          Save Template
        </Button>
      </div>

      {/* Main workspace grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-12rem)]">
        {/* 1. Templates list */}
        <div className={`lg:col-span-1 flex flex-col overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-5 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-6 flex-shrink-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-emerald-500/20' : 'bg-accent/5'}`}>
              <LayoutTemplate className={`w-5 h-5 ${isMobile ? 'text-emerald-400' : 'text-accent'}`} />
            </div>
            <h2 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Templates</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {templates.map((temp) => (
              <button
                key={temp.id}
                onClick={() => selectTemplate(temp)}
                className={`w-full text-left p-4 rounded-2xl transition-all flex flex-col gap-1.5 group border ${
                  selectedTemplate?.id === temp.id
                    ? (isMobile ? 'border-emerald-500/40 bg-emerald-500/10 shadow-lg' : 'border-accent/40 bg-accent/5 shadow-md')
                    : (isMobile ? 'border-transparent hover:bg-white/[0.03]' : 'border-transparent hover:bg-page hover:border-border')
                }`}
              >
                <span className={`text-sm font-bold leading-tight ${isMobile ? 'text-white group-hover:text-emerald-400' : 'text-primary-text group-hover:text-accent'} transition-colors`}>{temp.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isMobile ? 'text-white/30' : 'text-muted'}`}>{temp.letterType}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Editor / Preview workspace */}
        <div className={`lg:col-span-2 flex flex-col overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536]' : 'bg-white rounded-3xl border border-border shadow-sm'}`}>
          {/* Workspace toolbar */}
          <div className={`p-5 flex items-center justify-between flex-shrink-0 border-b ${isMobile ? 'border-[#2a4536] bg-[#0a140f]' : 'border-border bg-page/50'}`}>
            <div>
              <h3 className={`text-sm font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                {selectedTemplate?.name || 'Select a template'}
              </h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isMobile ? 'text-white/30' : 'text-muted'}`}>
                HTML Document Definition
              </p>
            </div>

            <div className={`flex p-1 rounded-2xl border ${isMobile ? 'bg-[#121f17] border-transparent' : 'bg-page border-border'}`}>
              <button
                onClick={() => setMode('edit')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  mode === 'edit'
                    ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20')
                    : (isMobile ? 'text-white/40' : 'text-muted')
                }`}
              >
                <Edit className="w-3.5 h-3.5" />
                Editor
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  mode === 'preview'
                    ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20')
                    : (isMobile ? 'text-white/40' : 'text-muted')
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          </div>

          {/* Editor content */}
          {mode === 'edit' ? (
            <div className={`flex-1 p-4 overflow-hidden flex flex-col ${isMobile ? 'bg-[#0a140f]' : 'bg-page/30'}`}>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className={`flex-1 w-full p-5 rounded-2xl font-mono text-xs leading-relaxed outline-none resize-none transition-all ${isMobile ? 'bg-[#121f17] border border-[#2a4536] text-white/80 placeholder:text-white/20 focus:border-emerald-500/30' : 'bg-white border border-border text-primary-text shadow-inner focus:ring-2 focus:ring-accent/10'}`}
              />
            </div>
          ) : (
            <div className={`flex-1 p-6 overflow-y-auto flex flex-col items-center ${isMobile ? 'bg-[#0a140f]' : 'bg-slate-100'}`}>
              <div className={`w-full max-w-[210mm] min-h-[297mm] relative ${isMobile ? 'bg-[#182a20] border border-[#2a4536]' : 'bg-white border border-border shadow-xl'} p-16`}>
                <div
                  className="prose prose-sm max-w-none font-sans text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Variables Guide */}
        <div className={`lg:col-span-1 flex flex-col overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-5 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-6 flex-shrink-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
              <FileText className={`w-5 h-5 ${isMobile ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <h2 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Variables</h2>
          </div>

          {/* Hint banner */}
          <div className={`flex items-start gap-2 p-3 rounded-2xl mb-4 flex-shrink-0 ${isMobile ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isMobile ? 'text-amber-400' : 'text-amber-600'}`} />
            <span className={`text-[10px] leading-relaxed ${isMobile ? 'text-amber-300' : 'text-amber-700'}`}>
              Click any token to copy. Paste into the HTML source. They resolve dynamically.
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {PLACEHOLDERS.map((ph) => (
              <div
                key={ph.token}
                onClick={() => copyToClipboard(ph.token)}
                className={`p-3.5 rounded-2xl cursor-pointer group transition-all border ${isMobile ? 'border-transparent hover:border-emerald-500/30 hover:bg-white/[0.03]' : 'border-transparent hover:border-accent/30 hover:bg-accent/5 hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <code className={`text-xs font-black transition-colors ${isMobile ? 'text-white group-hover:text-emerald-400' : 'text-primary-text group-hover:text-accent'}`}>
                    {ph.token}
                  </code>
                  <Copy className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all ${isMobile ? 'text-emerald-400' : 'text-accent'}`} />
                </div>
                <p className={`text-[10px] leading-normal ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                  {ph.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateManagerPage;
