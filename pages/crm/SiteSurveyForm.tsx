import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { crmApi } from '../../services/crmApi';
import { useAuthStore } from '../../store/authStore';
import type {
  CrmChecklistTemplate, CrmChecklistSubmission, ChecklistSectionDef,
  ChecklistFieldDef, ChecklistFieldResponse
} from '../../types/crm';
import Toast from '../../components/ui/Toast';
import {
  ArrowLeft, Save, Send, Loader2, ChevronRight, CheckCircle,
  Circle, Camera, Mic, MicOff, Star, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';

const OFFLINE_KEY_PREFIX = 'crm_survey_draft_';

const SiteSurveyForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: leadId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { leads, templates, fetchTemplates } = useCrmStore();

  const lead = leads.find(l => l.id === leadId);

  const [selectedTemplate, setSelectedTemplate] = useState<CrmChecklistTemplate | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<CrmChecklistSubmission | null>(null);
  const [responses, setResponses] = useState<Record<string, ChecklistFieldResponse>>({});
  const [activeSection, setActiveSection] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load templates and existing submission
  useEffect(() => {
    fetchTemplates();
    if (leadId) {
      crmApi.getChecklistSubmission(leadId).then(sub => {
        if (sub) {
          setExistingSubmission(sub);
          setResponses(sub.data || {});
        }
      }).catch(() => {});
    }
  }, [leadId, fetchTemplates]);

  // Auto-select first template
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
    }
  }, [templates, selectedTemplate]);

  // Load offline draft
  useEffect(() => {
    if (leadId && selectedTemplate) {
      const draft = localStorage.getItem(`${OFFLINE_KEY_PREFIX}${leadId}`);
      if (draft && !existingSubmission) {
        try {
          const parsed = JSON.parse(draft);
          setResponses(parsed);
          setToast({ message: 'Offline draft restored', type: 'info' });
        } catch {}
      }
    }
  }, [leadId, selectedTemplate, existingSubmission]);

  // Auto-save to localStorage
  const autoSaveDraft = useCallback(() => {
    if (leadId && Object.keys(responses).length > 0) {
      localStorage.setItem(`${OFFLINE_KEY_PREFIX}${leadId}`, JSON.stringify(responses));
    }
  }, [leadId, responses]);

  useEffect(() => {
    const timer = setInterval(autoSaveDraft, 5000);
    return () => clearInterval(timer);
  }, [autoSaveDraft]);

  // Response handlers
  const setFieldResponse = (fieldId: string, value: any, remarks?: string) => {
    setResponses(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        value,
        ...(remarks !== undefined ? { remarks } : {}),
      },
    }));
  };

  const setFieldRemarks = (fieldId: string, remarks: string) => {
    setResponses(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], value: prev[fieldId]?.value ?? '', remarks },
    }));
  };

  // Progress calculation
  const sections = selectedTemplate?.sections || [];
  const completionStats = useMemo(() => {
    const sectionStats = sections.map(section => {
      const total = section.fields.length;
      const filled = section.fields.filter(f => {
        const r = responses[f.id];
        return r && r.value !== undefined && r.value !== '' && r.value !== null;
      }).length;
      return { total, filled };
    });
    const totalFields = sectionStats.reduce((t, s) => t + s.total, 0);
    const totalFilled = sectionStats.reduce((t, s) => t + s.filled, 0);
    return { sectionStats, totalFields, totalFilled, percent: totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0 };
  }, [sections, responses]);

  // Save / Submit
  const handleSave = async (submit = false) => {
    if (!selectedTemplate || !leadId) return;

    // Validate required fields on submit
    if (submit) {
      const missing: string[] = [];
      sections.forEach(s => {
        s.fields.forEach(f => {
          if (f.required) {
            const r = responses[f.id];
            if (!r || r.value === undefined || r.value === '' || r.value === null) {
              missing.push(`${s.name} → ${f.label}`);
            }
          }
        });
      });
      if (missing.length > 0) {
        setToast({ message: `Missing required fields:\n${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`, type: 'error' });
        return;
      }
    }

    setIsSaving(true);
    try {
      if (isOnline) {
        await crmApi.saveChecklistSubmission({
          id: existingSubmission?.id,
          leadId,
          templateId: selectedTemplate.id,
          data: responses,
          status: submit ? 'submitted' : 'draft',
          submittedBy: submit ? user?.id : undefined,
        });
        localStorage.removeItem(`${OFFLINE_KEY_PREFIX}${leadId}`);
        setToast({ message: submit ? 'Survey submitted successfully' : 'Draft saved', type: 'success' });
        if (submit) {
          // Auto-update lead status
          await crmApi.updateLeadStatus(leadId, 'Survey Completed');
          setTimeout(() => navigate(`/crm/leads/${leadId}`), 800);
        }
      } else {
        autoSaveDraft();
        setToast({ message: 'Saved offline. Will sync when back online.', type: 'info' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Field Renderer ----
  const renderField = (field: ChecklistFieldDef) => {
    const response = responses[field.id];
    const value = response?.value;
    const remarks = response?.remarks || '';

    switch (field.type) {
      case 'yes_no':
        return (
          <div className="flex items-center gap-2">
            {['Yes', 'No', 'NA'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setFieldResponse(field.id, opt)}
                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                  value === opt
                    ? opt === 'Yes' ? 'bg-green-500 text-white border-green-500'
                    : opt === 'No' ? 'bg-red-500 text-white border-red-500'
                    : 'bg-gray-400 text-white border-gray-400'
                    : 'border-border text-muted hover:border-accent/30'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case 'yes_no_remarks':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {['Yes', 'No', 'NA'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFieldResponse(field.id, opt)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                    value === opt
                      ? opt === 'Yes' ? 'bg-green-500 text-white border-green-500'
                      : opt === 'No' ? 'bg-red-500 text-white border-red-500'
                      : 'bg-gray-400 text-white border-gray-400'
                      : 'border-border text-muted hover:border-accent/30'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              className="form-input !text-sm min-h-[48px]"
              value={remarks}
              onChange={(e) => setFieldRemarks(field.id, e.target.value)}
              placeholder="Remarks / observations..."
              rows={1}
            />
          </div>
        );

      case 'text':
        return (
          <textarea
            className="form-input !text-sm min-h-[48px]"
            value={(value as string) || ''}
            onChange={(e) => setFieldResponse(field.id, e.target.value)}
            placeholder="Enter details..."
            rows={2}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className="form-input !text-sm max-w-[200px]"
            value={(value as number) ?? ''}
            onChange={(e) => setFieldResponse(field.id, Number(e.target.value) || '')}
            placeholder="0"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className="form-input !text-sm max-w-[200px]"
            value={(value as string) || ''}
            onChange={(e) => setFieldResponse(field.id, e.target.value)}
          />
        );

      case 'rating_1_5':
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setFieldResponse(field.id, star)}
                className="p-0.5 transition-colors"
              >
                <Star
                  className={`w-7 h-7 transition-all ${
                    star <= (value as number || 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {value && <span className="ml-2 text-xs font-bold text-muted">{value}/5</span>}
          </div>
        );

      case 'dropdown':
        return (
          <select
            className="form-input !text-sm max-w-[300px]"
            value={(value as string) || ''}
            onChange={(e) => setFieldResponse(field.id, e.target.value)}
          >
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'photo':
        return (
          <div className="flex items-center gap-2">
            <label className="px-4 py-2 rounded-lg border border-dashed border-accent/30 text-xs font-semibold text-accent hover:bg-accent/5 transition-colors cursor-pointer flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              Take / Upload Photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setFieldResponse(field.id, file.name);
              }} />
            </label>
            {value && <span className="text-xs text-muted">📷 {String(value)}</span>}
          </div>
        );

      default:
        return <input className="form-input !text-sm" value={(value as string) || ''} onChange={(e) => setFieldResponse(field.id, e.target.value)} />;
    }
  };

  const currentSection = sections[activeSection];

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/crm/leads/${leadId}`)} className="p-2 rounded-lg hover:bg-accent/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary-text" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-text">Site Survey</h1>
            <p className="text-xs text-muted mt-0.5">
              {lead?.clientName || 'Lead'} • {lead?.city || ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={() => handleSave(false)} disabled={isSaving} className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-muted hover:border-accent transition-all gap-1.5 flex items-center">
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={isSaving} className="btn btn-primary btn-md gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-primary-text">Overall Progress</span>
          <span className="text-sm font-bold text-accent">{completionStats.percent}%</span>
        </div>
        <div className="w-full h-2.5 bg-page rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${completionStats.percent}%`,
              backgroundColor: completionStats.percent === 100 ? '#10b981' : '#006b3f',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted">{completionStats.totalFilled} of {completionStats.totalFields} fields completed</span>
          {existingSubmission && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 uppercase">
              {existingSubmission.status}
            </span>
          )}
        </div>
      </div>

      {/* Section Navigation + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Section Nav */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-3 lg:sticky lg:top-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-2 mb-2">Sections</h3>
            <div className="space-y-1">
              {sections.map((section, idx) => {
                const stats = completionStats.sectionStats[idx];
                const isComplete = stats && stats.filled === stats.total && stats.total > 0;
                const isActive = activeSection === idx;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                      isActive ? 'bg-accent text-white' : 'hover:bg-page text-primary-text'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-green-500'}`} />
                    ) : (
                      <Circle className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white/60' : 'text-muted/40'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : ''}`}>{section.name}</p>
                      <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-muted'}`}>
                        {stats?.filled || 0}/{stats?.total || 0}
                      </p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-muted/30'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="lg:col-span-3">
          {currentSection ? (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-accent">{activeSection + 1}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-primary-text">{currentSection.name}</h2>
                  <p className="text-[10px] text-muted">{currentSection.fields.length} items</p>
                </div>
              </div>

              {currentSection.fields.map((field, fIdx) => (
                <div key={field.id} className="py-3 border-b border-border/30 last:border-b-0">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-[10px] font-bold text-muted mt-0.5 w-5">{fIdx + 1}.</span>
                    <label className="text-sm font-semibold text-primary-text flex-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                  </div>
                  <div className="ml-8">
                    {renderField(field)}
                  </div>
                </div>
              ))}

              {/* Section Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                  disabled={activeSection === 0}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-muted hover:border-accent disabled:opacity-30 transition-all"
                >
                  ← Previous
                </button>
                <span className="text-xs text-muted">
                  Section {activeSection + 1} of {sections.length}
                </span>
                <button
                  onClick={() => setActiveSection(Math.min(sections.length - 1, activeSection + 1))}
                  disabled={activeSection === sections.length - 1}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-30 transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <AlertTriangle className="w-10 h-10 text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-muted">No checklist template available. Ask admin to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteSurveyForm;
