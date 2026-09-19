import React, { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { PPM_FIELD_SPECS } from '../../config/ppmFieldSpecs';
import { PPMAuditFormEngine } from '../../components/ppm/PPMAuditFormEngine';
import { PPMSummaryRollup } from '../../components/ppm/PPMSummaryRollup';
import { PPMObservation } from '../../types/ppm';

import { saveOfflineAware, unwrap } from '../../services/offline/saveOfflineAware';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import MobileTopBar from '../../components/navigation/MobileTopBar';

export const PPMExecution: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();
  const customTitle = searchParams.get('title');
  const navigate = useNavigate();
  
  // Resolve base category template if categoryId is a duplicate ID like "dup_fac_ELECTRICAL_PANEL_17000"
  let baseCategoryId = categoryId || 'ELECTRICAL_PANEL';
  if (baseCategoryId.startsWith('dup_fac_')) {
    const parts = baseCategoryId.split('_');
    baseCategoryId = parts.slice(2, -1).join('_') || parts[2];
  }
  
  let template = PPM_FIELD_SPECS[baseCategoryId] || (categoryId ? PPM_FIELD_SPECS[categoryId] : null);
  if (template && customTitle) {
    template = {
      ...template,
      name: customTitle
    };
  }

  const [observations, setObservations] = useState<Record<string, PPMObservation>>({});

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <MobileTopBar title="PPM EXECUTION" parentPath="/operations/ppm-audits" />
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Invalid Category</h2>
          <button onClick={() => navigate('/operations/ppm-audits')} className="text-emerald-600 font-medium">Go back to dashboard</button>
        </div>
      </div>
    );
  }

  const handleObservationChange = (criterionId: string, updates: Partial<PPMObservation>) => {
    setObservations(prev => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        ...updates,
        id: prev[criterionId]?.id || `obs-${Date.now()}`,
        criterionId,
        updatedAt: new Date().toISOString()
      } as PPMObservation
    }));
  };

  const handleSubmit = async () => {
    const executionId = crypto.randomUUID();
    const currentUser = useAuthStore.getState().user;
    const now = new Date().toISOString();
    const record = {
      id: executionId,
      site_name: (currentUser as any)?.assignedSite || currentUser?.societyName || currentUser?.locationName || 'PPM Site Audit',
      reference_number: `PPM-${Date.now().toString(36).toUpperCase()}`,
      category_id: categoryId || 'ELECTRICAL_PANEL',
      audit_date: now.split('T')[0],
      status: 'SUBMITTED' as const,
      auditor_name: currentUser?.name || currentUser?.email || 'Field Technician',
      observations,
      summary_counts: { critical: 0, major: 0, medium: 0, minor: 0, total: Object.keys(observations).length },
      snag_ids: [],
      created_at: now,
      updated_at: now,
    };

    try {
      const result = await saveOfflineAware({
        table: 'ppm_executions',
        record,
        onlineSave: async (clean) => {
          const res = await supabase.from('ppm_executions').upsert(clean, { onConflict: 'id' });
          unwrap(res);
        },
      });

      if (result === 'queued') {
        toast.success('⚡ PPM Audit saved locally. Will auto-sync on reconnect.');
      } else {
        toast.success('PPM Audit saved & synced successfully!');
      }
    } catch (err: any) {
      console.warn('Failed to save PPM execution:', err);
      toast.error('Could not save PPM audit: ' + (err?.message || 'Unknown error'));
      return;
    }
    navigate('/operations/ppm-audits');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Main Engine matching HT Yard layout */}
      <PPMAuditFormEngine 
        template={template}
        observations={observations}
        onChangeObservation={handleObservationChange}
        onBack={() => navigate('/operations/ppm-audits')}
        customStages={[
          {
            key: 'summary-rollup',
            title: 'Summary & Sign-off',
            subtitle: 'Review issues and submit',
            content: (
              <PPMSummaryRollup 
                observations={observations}
                onComplete={handleSubmit}
              />
            )
          }
        ]}
      />
    </div>
  );
};
