import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PPM_FIELD_SPECS } from '../../config/ppmFieldSpecs';
import { PPMAuditFormEngine } from '../../components/ppm/PPMAuditFormEngine';
import { PPMSummaryRollup } from '../../components/ppm/PPMSummaryRollup';
import { PPMObservation } from '../../types/ppm';

export const PPMExecution: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  
  const template = categoryId ? PPM_FIELD_SPECS[categoryId] : null;
  
  const [observations, setObservations] = useState<Record<string, PPMObservation>>({});

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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

  const handleSubmit = () => {
    alert("Audit Submitted Successfully!");
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
