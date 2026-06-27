import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';export interface AutoRoleRule {
  id: string;
  designation: string;
  department: string;
  earnedLeavePerYear: number;      // e.g. 15
  casualLeavePerYear: number;      // e.g. 8
  weeklyOffDay: 'Sunday' | 'Saturday' | 'Sunday+Saturday' | 'Rotational';
  perDaySalaryFormula: 'CTC/26' | 'CTC/30' | 'CTC/25' | 'Custom';
  customDivisor?: number;
  isActive: boolean;
}

export interface AutoSiteConfigData {
  siteId: string;
  siteName: string;
  globalEL: number;
  globalCL: number;
  globalWeeklyOff: AutoRoleRule['weeklyOffDay'];
  globalPerDayFormula: AutoRoleRule['perDaySalaryFormula'];
  roleRules: AutoRoleRule[];
  lastUpdated?: string;
}

const STORAGE_KEY_PREFIX = 'paradigm_auto_cfg_';

const makeDefaultRule = (designation = '', department = ''): AutoRoleRule => ({
  id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  designation,
  department,
  earnedLeavePerYear: 15,
  casualLeavePerYear: 8,
  weeklyOffDay: 'Sunday',
  perDaySalaryFormula: 'CTC/26',
  isActive: true,
});

const makeDefaultConfig = (siteId: string, siteName: string): AutoSiteConfigData => ({
  siteId,
  siteName,
  globalEL: 15,
  globalCL: 8,
  globalWeeklyOff: 'Sunday',
  globalPerDayFormula: 'CTC/26',
  roleRules: [
    makeDefaultRule('Security Guard', 'Security'),
    makeDefaultRule('Supervisor', 'Security'),
    makeDefaultRule('Senior Supervisor', 'Security'),
  ],
  lastUpdated: new Date().toISOString(),
});

export const useAutoSiteConfig = () => {
  const [saving, setSaving] = useState(false);

  const getConfig = useCallback(async (siteId: string, siteName: string): Promise<AutoSiteConfigData> => {
    try {
      const { data, error } = await supabase
        .from('site_configurations')
        .select('config_data')
        .eq('organization_id', siteId)
        .single();
        
      if (!error && data?.config_data?.autoSiteConfig) {
        return data.config_data.autoSiteConfig as AutoSiteConfigData;
      }
    } catch (e) {
      console.warn('Failed to fetch auto site config from DB', e);
    }
    
    // Fallback to local storage for backward compatibility during migration
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${siteId}`);
      if (stored) return JSON.parse(stored) as AutoSiteConfigData;
    } catch {
      // ignore parse errors
    }
    
    return makeDefaultConfig(siteId, siteName);
  }, []);

  const saveConfig = useCallback(async (config: AutoSiteConfigData): Promise<void> => {
    setSaving(true);
    try {
      const { data: existingData } = await supabase
        .from('site_configurations')
        .select('config_data')
        .eq('organization_id', config.siteId)
        .single();
        
      const existingConfig = existingData?.config_data || {};
      const updatedConfig = {
        ...existingConfig,
        autoSiteConfig: { ...config, lastUpdated: new Date().toISOString() }
      };

      await supabase.from('site_configurations').upsert({
        organization_id: config.siteId,
        config_data: updatedConfig
      }, { onConflict: 'organization_id' });
      
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${config.siteId}`,
        JSON.stringify(updatedConfig.autoSiteConfig)
      );
    } catch (e) {
      console.error('Failed to save auto site config', e);
    } finally {
      setSaving(false);
    }
  }, []);

  const resetConfig = useCallback(async (siteId: string): Promise<void> => {
    try {
      const { data: existingData } = await supabase
        .from('site_configurations')
        .select('config_data')
        .eq('organization_id', siteId)
        .single();
        
      if (existingData?.config_data?.autoSiteConfig) {
        const updatedConfig = { ...existingData.config_data };
        delete updatedConfig.autoSiteConfig;
        
        await supabase.from('site_configurations').upsert({
          organization_id: siteId,
          config_data: updatedConfig
        }, { onConflict: 'organization_id' });
      }
    } catch (e) {}
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${siteId}`);
  }, []);

  const hasConfig = useCallback(async (siteId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('site_configurations')
        .select('config_data')
        .eq('organization_id', siteId)
        .single();
      if (data?.config_data?.autoSiteConfig) return true;
    } catch {}
    return !!localStorage.getItem(`${STORAGE_KEY_PREFIX}${siteId}`);
  }, []);

  const makeNewRule = makeDefaultRule;

  return { getConfig, saveConfig, resetConfig, hasConfig, makeNewRule, saving };
};
