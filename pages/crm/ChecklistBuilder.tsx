import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { crmApi } from '../../services/crmApi';
import type { CrmChecklistTemplate, ChecklistSectionDef, ChecklistFieldDef, ChecklistFieldType } from '../../types/crm';
import Toast from '../../components/ui/Toast';
import {
  ArrowLeft, Plus, Save, Loader2, Trash2, GripVertical,
  ChevronDown, ChevronUp, Copy, Eye, EyeOff, Settings2,
  ClipboardCheck, FileText, ToggleLeft, Hash, Calendar,
  Camera, Star, ListOrdered, Edit2
} from 'lucide-react';

const FIELD_TYPE_OPTIONS: { value: ChecklistFieldType; label: string; icon: React.ReactNode }[] = [
  { value: 'yes_no', label: 'Yes / No', icon: <ToggleLeft className="w-3.5 h-3.5" /> },
  { value: 'yes_no_remarks', label: 'Yes / No + Remarks', icon: <FileText className="w-3.5 h-3.5" /> },
  { value: 'text', label: 'Text Input', icon: <FileText className="w-3.5 h-3.5" /> },
  { value: 'number', label: 'Number', icon: <Hash className="w-3.5 h-3.5" /> },
  { value: 'date', label: 'Date', icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: 'photo', label: 'Photo Upload', icon: <Camera className="w-3.5 h-3.5" /> },
  { value: 'rating_1_5', label: 'Rating (1-5)', icon: <Star className="w-3.5 h-3.5" /> },
  { value: 'dropdown', label: 'Dropdown Select', icon: <ListOrdered className="w-3.5 h-3.5" /> },
];

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const ChecklistBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { templates, fetchTemplates, deleteTemplate } = useCrmStore();

  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [activeTemplate, setActiveTemplate] = useState<CrmChecklistTemplate | null>(null);

  // Editor state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<ChecklistSectionDef[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openEditor = (template?: CrmChecklistTemplate) => {
    if (template) {
      setActiveTemplate(template);
      setName(template.name);
      setDescription(template.description || '');
      setSections(JSON.parse(JSON.stringify(template.sections)));
    } else {
      setActiveTemplate(null);
      setName('');
      setDescription('');
      setSections([{
        id: genId(),
        name: 'General',
        fields: [{ id: genId(), label: '', type: 'yes_no_remarks', required: false }],
      }]);
    }
    setMode('editor');
    setExpandedSection(null);
    setPreviewMode(false);
  };

  // ---- Section Operations ----
  const addSection = () => {
    const newSection: ChecklistSectionDef = {
      id: genId(),
      name: `Section ${sections.length + 1}`,
      fields: [],
    };
    setSections([...sections, newSection]);
    setExpandedSection(newSection.id);
  };

  const removeSection = (id: string) => {
    if (!window.confirm('Delete this entire section and all its fields?')) return;
    setSections(sections.filter(s => s.id !== id));
  };

  const duplicateSection = (id: string) => {
    const source = sections.find(s => s.id === id);
    if (!source) return;
    const clone: ChecklistSectionDef = {
      ...JSON.parse(JSON.stringify(source)),
      id: genId(),
      name: `${source.name} (Copy)`,
    };
    clone.fields = clone.fields.map((f: ChecklistFieldDef) => ({ ...f, id: genId() }));
    setSections([...sections, clone]);
  };

  const updateSection = (id: string, updates: Partial<ChecklistSectionDef>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // ---- Field Operations ----
  const addField = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, fields: [...s.fields, { id: genId(), label: '', type: 'yes_no_remarks', required: false }] };
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, fields: s.fields.filter(f => f.id !== fieldId) };
    }));
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<ChecklistFieldDef>) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) };
    }));
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ message: 'Template name is required', type: 'error' });
      return;
    }
    const emptyFields = sections.some(s => s.fields.some(f => !f.label.trim()));
    if (emptyFields) {
      setToast({ message: 'All fields must have a label', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await crmApi.saveChecklistTemplate({
        id: activeTemplate?.id,
        name: name.trim(),
        description: description.trim(),
        sections,
        isActive: true,
        version: (activeTemplate?.version || 0) + 1,
      });
      await fetchTemplates();
      setToast({ message: 'Checklist template saved', type: 'success' });
      setTimeout(() => setMode('list'), 600);
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteTemplate(id);
      setToast({ message: 'Template deleted', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Delete failed', type: 'error' });
    }
  };

  // ---- Stats ----
  const totalFields = useMemo(() => sections.reduce((t, s) => t + s.fields.length, 0), [sections]);
  const requiredFields = useMemo(() => sections.reduce((t, s) => t + s.fields.filter(f => f.required).length, 0), [sections]);

  // ============================================================================
  // RENDER: LIST VIEW
  // ============================================================================
  if (mode === 'list') {
    return (
      <div className="space-y-6">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/crm')} className="p-2 rounded-lg hover:bg-accent/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-primary-text" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-primary-text">Checklist Templates</h1>
              <p className="text-xs text-muted mt-0.5">Define site survey checklists for field officers</p>
            </div>
          </div>
          <button onClick={() => openEditor()} className="btn btn-primary btn-md gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted/30 mb-3" />
            <p className="text-lg font-medium text-primary-text">No templates yet</p>
            <p className="text-sm text-muted mt-1">Create your first checklist template to start surveys</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => openEditor(t)}
                className="bg-card rounded-xl border border-border p-5 cursor-pointer hover:shadow-card hover:border-accent/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEditor(t); }} 
                      className="p-1.5 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                      title="Edit Template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} 
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 uppercase ml-1">
                      v{t.version}
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-primary-text group-hover:text-accent transition-colors mb-1">
                  {t.name}
                </h3>
                {t.description && (
                  <p className="text-[11px] text-muted mb-3 line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted">
                  <span>{t.sections.length} sections</span>
                  <span>•</span>
                  <span>{t.sections.reduce((c, s) => c + s.fields.length, 0)} fields</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: EDITOR
  // ============================================================================
  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="p-2 rounded-lg hover:bg-accent/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary-text" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-text">
              {activeTemplate ? 'Edit Template' : 'New Checklist Template'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {sections.length} sections • {totalFields} fields • {requiredFields} required
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all gap-1.5 flex items-center ${previewMode ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'}`}
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-md gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Template
          </button>
        </div>
      </div>

      {/* Template Meta */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Template Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Property Service Takeover Checklist"
              disabled={previewMode}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Description</label>
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this checklist..."
              disabled={previewMode}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sIdx) => {
          const isExpanded = expandedSection === section.id || previewMode;
          return (
            <div key={section.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Section Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-page/50 cursor-pointer"
                onClick={() => !previewMode && setExpandedSection(isExpanded ? null : section.id)}
              >
                {!previewMode && <GripVertical className="w-4 h-4 text-muted/40" />}
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent">{sIdx + 1}</span>
                </div>
                {previewMode ? (
                  <h3 className="text-sm font-bold text-primary-text flex-1">{section.name}</h3>
                ) : (
                  <input
                    className="text-sm font-bold text-primary-text bg-transparent border-none outline-none flex-1 focus:ring-0"
                    value={section.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSection(section.id, { name: e.target.value })}
                    placeholder="Section Name"
                  />
                )}
                <span className="text-[10px] text-muted font-medium">{section.fields.length} fields</span>
                {!previewMode && (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }} className="p-1.5 rounded-lg hover:bg-accent/10 text-muted" title="Duplicate">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!previewMode && (
                  isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />
                )}
              </div>

              {/* Fields */}
              {isExpanded && (
                <div className="px-4 py-3 space-y-2 animate-fade-in-down">
                  {section.fields.map((field, fIdx) => (
                    <div key={field.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-page/50 border border-border/50">
                      {!previewMode && (
                        <span className="text-[10px] font-bold text-muted mt-2.5 w-5 text-center">{fIdx + 1}</span>
                      )}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        {/* Label */}
                        <div className="sm:col-span-5">
                          {previewMode ? (
                            <p className="text-sm text-primary-text font-medium py-1.5">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </p>
                          ) : (
                            <input
                              className="form-input !text-sm"
                              value={field.label}
                              onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                              placeholder="Field label (e.g. DG / Generator)"
                            />
                          )}
                        </div>

                        {/* Type */}
                        <div className="sm:col-span-3">
                          {previewMode ? (
                            <span className="px-2 py-1.5 rounded-md text-[10px] font-bold bg-accent/10 text-accent uppercase inline-block">
                              {FIELD_TYPE_OPTIONS.find(o => o.value === field.type)?.label || field.type}
                            </span>
                          ) : (
                            <select
                              className="form-input !text-sm"
                              value={field.type}
                              onChange={(e) => updateField(section.id, field.id, { type: e.target.value as ChecklistFieldType })}
                            >
                              {FIELD_TYPE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Options (for dropdown type) */}
                        {field.type === 'dropdown' && !previewMode && (
                          <div className="sm:col-span-3">
                            <input
                              className="form-input !text-sm"
                              value={(field.options || []).join(', ')}
                              onChange={(e) => updateField(section.id, field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="Option1, Option2, Option3"
                            />
                          </div>
                        )}

                        {/* Required toggle */}
                        {!previewMode && (
                          <div className={`${field.type === 'dropdown' ? 'sm:col-span-1' : 'sm:col-span-4'} flex items-center gap-2`}>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(section.id, field.id, { required: e.target.checked })}
                                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                              />
                              <span className="text-xs text-muted font-medium">Required</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {!previewMode && (
                        <button onClick={() => removeField(section.id, field.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 mt-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add Field */}
                  {!previewMode && (
                    <button
                      onClick={() => addField(section.id)}
                      className="w-full py-2.5 rounded-lg border border-dashed border-accent/30 text-xs font-semibold text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Field
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Section */}
        {!previewMode && (
          <button
            onClick={addSection}
            className="w-full py-4 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        )}
      </div>
    </div>
  );
};

export default ChecklistBuilder;
