import React, { useState } from 'react';
import { useRuleEngineForScope, TravelRulesConfig } from '../../hooks/useRuleEngine';
import { Save, Loader2 } from 'lucide-react';
import Button from '../ui/Button';

interface TravelRulesConfigProps {
  scopeType: 'global' | 'location' | 'company' | 'entity' | 'region' | 'branch';
  scopeId: string | null;
  changedBy: string;
}

const DEFAULT_TRAVEL_RULES: TravelRulesConfig = {
  id: 'default',
  scopeType: 'global',
  scopeId: null,
  city: null,
  twoWheelerRate: 6,
  fourWheelerPetrolRate: 16,
  fourWheelerDieselRate: 14,
  publicTransportRate: 0,
  companyVehicleRate: 0,
  dailyDeductionKm: 0,
  applyDeductionPer: 'day',
  distanceBufferPct: 5,
  enableGoogleMapsValidation: false,
  enableTravelReimbursement: false,
  enableIdleTimeTracking: false,
  maxIdleMinutesPerDay: 60,
  minimumSitePct: null,
  minimumSiteHours: null,
};

export const TravelRulesConfigPanel: React.FC<TravelRulesConfigProps> = ({ scopeType, scopeId, changedBy }) => {
  const { travelRules, isLoading, saveTravelRulesConfig } = useRuleEngineForScope({
    scopeType,
    scopeId,
    staffCategory: 'field',
  });

  const [localRules, setLocalRules] = useState<TravelRulesConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync on load
  React.useEffect(() => {
    if (travelRules && !localRules) {
      setLocalRules(travelRules);
    } else if (!isLoading && !travelRules && !localRules) {
      setLocalRules(DEFAULT_TRAVEL_RULES);
    }
  }, [travelRules, isLoading, localRules]);

  const handleSave = async () => {
    if (!localRules) return;
    setIsSaving(true);
    try {
      await saveTravelRulesConfig(localRules, changedBy);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !localRules) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-primary-text">Travel & Reimbursement Rules</h3>
          <p className="text-xs text-muted mt-1">Configure travel distance deduction and fuel rates for {scopeType === 'global' ? 'Global Defaults' : scopeId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-primary-text mb-2">
            <input 
              type="checkbox" 
              checked={localRules.enableTravelReimbursement}
              onChange={(e) => setLocalRules({ ...localRules, enableTravelReimbursement: e.target.checked })}
              className="form-checkbox rounded text-accent"
            />
            Enable Travel Reimbursement
          </label>
          <p className="text-xs text-muted ml-6">If disabled, no fuel allowance is calculated for this scope.</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-primary-text mb-2">
            <input 
              type="checkbox" 
              checked={localRules.enableGoogleMapsValidation}
              onChange={(e) => setLocalRules({ ...localRules, enableGoogleMapsValidation: e.target.checked })}
              className="form-checkbox rounded text-accent"
            />
            Use Google Maps Distance Matrix
          </label>
          <p className="text-xs text-muted ml-6">Automatically compute site-to-site travel distances using Maps API.</p>
        </div>
        
        <div>
          <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Daily Deduction Distance (Km)</label>
          <input 
            type="number" 
            value={localRules.dailyDeductionKm}
            onChange={(e) => setLocalRules({ ...localRules, dailyDeductionKm: Number(e.target.value) })}
            className="form-input w-full text-sm py-2"
          />
          <p className="text-xs text-muted mt-1">Distance deducted from daily total (usually home-to-site * 2).</p>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Distance Buffer (%)</label>
          <input 
            type="number" 
            value={localRules.distanceBufferPct}
            onChange={(e) => setLocalRules({ ...localRules, distanceBufferPct: Number(e.target.value) })}
            className="form-input w-full text-sm py-2"
          />
          <p className="text-xs text-muted mt-1">Allowable deviation from standard Google Maps distance.</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-primary-text mb-2">
            <input 
              type="checkbox" 
              checked={localRules.enableIdleTimeTracking}
              onChange={(e) => setLocalRules({ ...localRules, enableIdleTimeTracking: e.target.checked })}
              className="form-checkbox rounded text-accent"
            />
            Enable Idle Time Tracking
          </label>
          <p className="text-xs text-muted ml-6">Flag warnings when user stays stationary for too long.</p>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Max Idle Minutes Per Day</label>
          <input 
            type="number" 
            value={localRules.maxIdleMinutesPerDay}
            onChange={(e) => setLocalRules({ ...localRules, maxIdleMinutesPerDay: Number(e.target.value) })}
            className="form-input w-full text-sm py-2"
          />
          <p className="text-xs text-muted mt-1">Maximum allowed stationary minutes before warnings are triggered.</p>
        </div>
      </div>

      <div className="border-t border-border pt-6 mt-6">
        <h4 className="text-sm font-bold text-primary-text mb-4">Per Km Fuel Rates</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Two Wheeler (₹/Km)</label>
            <input 
              type="number" 
              value={localRules.twoWheelerRate}
              onChange={(e) => setLocalRules({ 
                ...localRules, 
                twoWheelerRate: Number(e.target.value) 
              })}
              className="form-input w-full text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Four Wheeler Petrol (₹/Km)</label>
            <input 
              type="number" 
              value={localRules.fourWheelerPetrolRate}
              onChange={(e) => setLocalRules({ 
                ...localRules, 
                fourWheelerPetrolRate: Number(e.target.value) 
              })}
              className="form-input w-full text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-muted mb-2">Four Wheeler Diesel (₹/Km)</label>
            <input 
              type="number" 
              value={localRules.fourWheelerDieselRate}
              onChange={(e) => setLocalRules({ 
                ...localRules, 
                fourWheelerDieselRate: Number(e.target.value) 
              })}
              className="form-input w-full text-sm py-2"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Travel Rules
        </Button>
      </div>
    </div>
  );
};
