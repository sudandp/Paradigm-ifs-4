import { supabase } from './supabase';
import { WeatherRisk, SuggestedWeatherTask, cleanLocationName } from './weather';

export interface DbWeatherAlert {
  id: string;
  site_id?: string | null;
  city_name: string;
  latitude: number;
  longitude: number;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timing?: string | null;
  weather_snapshot?: any;
  triggered_at: string;
  acknowledged_by?: string[];
  created_at: string;
}

export interface DbWeatherTask {
  id: string;
  alert_id?: string | null;
  site_id?: string | null;
  task_name: string;
  category: 'FACILITIES' | 'ELECTRICAL' | 'SECURITY' | 'SAFETY';
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  description?: string;
  suggested_role?: string;
  assigned_to?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completed_at?: string | null;
  completed_by?: string | null;
  completion_notes?: string | null;
  action_code?: string | null;
  created_at: string;
  updated_at: string;
}

export const weatherDbService = {
  /**
   * Fetch active weather alerts created in the last 24 hours
   */
  async fetchActiveAlerts(siteId?: string): Promise<DbWeatherAlert[]> {
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      let query = supabase
        .from('weather_alerts')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (siteId) {
        query = query.or(`site_id.eq.${siteId},site_id.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[weatherDbService] fetchActiveAlerts error:', error.message);
        return [];
      }
      return (data as DbWeatherAlert[]) || [];
    } catch (err) {
      console.warn('[weatherDbService] fetchActiveAlerts exception:', err);
      return [];
    }
  },

  /**
   * Acknowledge an active weather alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const { data: current } = await supabase
        .from('weather_alerts')
        .select('acknowledged_by')
        .eq('id', alertId)
        .single();

      const existing: string[] = current?.acknowledged_by || [];
      if (!existing.includes(userId)) {
        existing.push(userId);
      }

      const { error } = await supabase
        .from('weather_alerts')
        .update({ acknowledged_by: existing })
        .eq('id', alertId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Fetch weather tasks with optional site or status filters
   */
  async fetchWeatherTasks(siteId?: string, status?: string): Promise<DbWeatherTask[]> {
    try {
      let query = supabase
        .from('weather_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (siteId) {
        query = query.or(`site_id.eq.${siteId},site_id.is.null`);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[weatherDbService] fetchWeatherTasks error:', error.message);
        return [];
      }
      return (data as DbWeatherTask[]) || [];
    } catch (err) {
      console.warn('[weatherDbService] fetchWeatherTasks exception:', err);
      return [];
    }
  },

  /**
   * Update weather task status (e.g. mark completed or in-progress)
   */
  async updateWeatherTaskStatus(
    taskId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED',
    userId?: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'COMPLETED') {
        updates.completed_at = new Date().toISOString();
        if (userId) updates.completed_by = userId;
      }
      if (notes) {
        updates.completion_notes = notes;
      }

      const { error } = await supabase
        .from('weather_tasks')
        .update(updates)
        .eq('id', taskId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Broadcast a weather alert and auto-generate related checklist tasks in database
   */
  async broadcastAlertAndTasks(
    risk: WeatherRisk,
    suggestedTasks: SuggestedWeatherTask[],
    location: { name: string; lat: number; lon: number; siteId?: string }
  ): Promise<{ alertId?: string; taskCount: number }> {
    try {
      // 1. Insert Alert
      const alertInsert = {
        site_id: location.siteId || null,
        city_name: location.name,
        latitude: location.lat,
        longitude: location.lon,
        alert_type: risk.type,
        severity: risk.severity,
        title: risk.title,
        message: risk.message,
        timing: risk.timing,
        triggered_at: new Date().toISOString(),
      };

      const { data: alertData, error: alertError } = await supabase
        .from('weather_alerts')
        .insert(alertInsert)
        .select('id')
        .single();

      if (alertError || !alertData) {
        console.warn('[weatherDbService] broadcastAlert insert error:', alertError);
        return { taskCount: 0 };
      }

      const alertId = alertData.id;

      // 2. Insert Tasks linked to this alert
      if (suggestedTasks.length > 0) {
        const tasksToInsert = suggestedTasks.map((t) => ({
          alert_id: alertId,
          site_id: location.siteId || null,
          task_name: t.title,
          category: t.category,
          urgency: t.urgency,
          description: t.description,
          suggested_role: t.suggestedRole,
          action_code: t.actionCode,
          status: 'PENDING',
        }));

        const { error: taskError } = await supabase
          .from('weather_tasks')
          .insert(tasksToInsert);

        if (taskError) {
          console.warn('[weatherDbService] tasks insert error:', taskError);
        }
      }

      return { alertId, taskCount: suggestedTasks.length };
    } catch (err) {
      console.warn('[weatherDbService] broadcastAlertAndTasks exception:', err);
      return { taskCount: 0 };
    }
  },

  /**
   * Subscribe to live Realtime alerts and tasks
   */
  subscribeToRealtime(
    onAlert: (alert: DbWeatherAlert) => void,
    onTask: (task: DbWeatherTask) => void
  ) {
    const channel = supabase
      .channel('weather_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'weather_alerts' },
        (payload) => {
          if (payload.new) {
            onAlert(payload.new as DbWeatherAlert);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_tasks' },
        (payload) => {
          if (payload.new) {
            onTask(payload.new as DbWeatherTask);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Fetch all registered enterprise site locations from database
   */
  async fetchEnterpriseLocations(): Promise<Array<{ id: string; name: string; lat: number; lon: number; address?: string }>> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude, address')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('name', { ascending: true });

      if (error) {
        console.warn('[weatherDbService] fetchEnterpriseLocations error:', error);
        return [];
      }

      const seen = new Set<string>();
      const deduped: Array<{ id: string; name: string; rawName?: string; lat: number; lon: number; address?: string }> = [];

      for (const loc of (data || [])) {
        if (loc.latitude === null || loc.longitude === null || isNaN(Number(loc.latitude)) || isNaN(Number(loc.longitude))) {
          continue;
        }

        const rawName = (loc.name || loc.address || 'Site Location').trim();
        const cleanName = cleanLocationName(rawName);
        const normKey = cleanName.toLowerCase().replace(/[\s,.-]+/g, ' ').trim();

        // Ensure unique site/cluster per weather dropdown entry
        if (!seen.has(normKey)) {
          seen.add(normKey);
          deduped.push({
            id: loc.id,
            name: cleanName,
            rawName,
            lat: Number(loc.latitude),
            lon: Number(loc.longitude),
            address: loc.address || undefined,
          });
        }
      }

      return deduped;
    } catch (err) {
      console.warn('[weatherDbService] fetchEnterpriseLocations exception:', err);
      return [];
    }
  },

  /**
   * Realtime listener on public.locations table
   * Auto-updates when someone creates, updates, or deletes a location in #/hr/locations
   */
  subscribeToLocationsRealtime(
    onLocationChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', loc: { id: string; name: string; lat: number; lon: number; address?: string }) => void
  ) {
    const channel = supabase
      .channel('weather_locations_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          const item = (payload.new || payload.old) as any;
          if (!item) return;
          const rawName = (item.name || item.address || 'Site Location').trim();
          const locItem = {
            id: item.id,
            name: cleanLocationName(rawName),
            rawName,
            lat: Number(item.latitude || 0),
            lon: Number(item.longitude || 0),
            address: item.address || undefined,
          };
          onLocationChange(payload.eventType as any, locItem);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

