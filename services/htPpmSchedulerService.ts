/**
 * htPpmSchedulerService.ts
 * Production-Grade Multi-Frequency Planned Preventive Maintenance (PPM) Scheduler Service.
 * 
 * Connected directly to Supabase (`ht_ppm_schedules` table) with offline-first caching.
 * Zero hardcoded seed data.
 */

import { supabase } from './supabase';
import { PPMFrequency, PPMChecklistItem, getChecklistForCategory } from '../config/htPpmChecklists';
import { isOfflineEnabled } from './offline/featureFlag';
import { isOnline } from './offline/networkStatus';

export interface PPMTaskInstance {
  id: string;
  assetId: string;
  assetName: string;
  category: 'RMU' | 'DG_SET' | 'TRANSFORMER' | 'HT_PANEL' | 'LT_KIOSK';
  frequency: PPMFrequency;
  scheduledDate: string; // ISO date string YYYY-MM-DD
  dueDate: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  assignedEngineer?: string;
  completedDate?: string;
  completedBy?: string;
  score?: number;
  snagsCount?: number;
  itemResponses: Record<string, {
    checked: boolean;
    numericValue?: number;
    textValue?: string;
    remarks?: string;
    photoUrls?: string[];
  }>;
  overallRemarks?: string;
}

class HTPpmSchedulerService {
  private storageKey = 'paradigm_ht_ppm_tasks_v2';

  /**
   * Get all PPM tasks for a given month and optional frequency filter
   */
  public async getTasks(year?: number, month?: number, frequency?: PPMFrequency | 'ALL'): Promise<PPMTaskInstance[]> {
    let tasks: PPMTaskInstance[] = [];

    // 1. Fetch from Supabase if online
    if (!isOfflineEnabled() || isOnline()) {
      try {
        let query = supabase.from('ht_ppm_schedules').select('*');
        if (frequency && frequency !== 'ALL') {
          query = query.eq('frequency', frequency);
        }
        
        const { data, error } = await query;
        if (!error && data) {
          tasks = data.map((row: any) => ({
            id: row.id,
            assetId: row.asset_id,
            assetName: row.asset_name,
            category: row.category as any,
            frequency: row.frequency as PPMFrequency,
            scheduledDate: row.scheduled_date,
            dueDate: row.due_date,
            status: row.status,
            assignedEngineer: row.assigned_engineer,
            completedDate: row.completed_date,
            completedBy: row.completed_by,
            score: row.score ? Number(row.score) : undefined,
            snagsCount: row.snags_count || 0,
            itemResponses: row.item_responses || {},
            overallRemarks: row.overall_remarks
          }));

          // Cache in local storage
          this.saveLocalTasks(tasks);
        }
      } catch (err) {
        console.warn('[htPpmSchedulerService] Supabase fetch failed, falling back to cache:', err);
      }
    }

    // 2. Fallback to local storage if empty or offline
    if (tasks.length === 0) {
      tasks = this.getLocalTasks();
    }

    // 3. Filter by year/month if specified
    return tasks.filter(t => {
      if (frequency && frequency !== 'ALL' && t.frequency !== frequency) return false;
      if (year && month !== undefined) {
        const d = new Date(t.scheduledDate);
        if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      }
      return true;
    });
  }

  /**
   * Get upcoming tasks for next 30 days
   */
  public async getUpcomingTasks(): Promise<PPMTaskInstance[]> {
    const all = await this.getTasks();
    const now = new Date().toISOString().split('T')[0];
    return all
      .filter(t => t.scheduledDate >= now && t.status !== 'COMPLETED')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }

  /**
   * Automatically generate recurring PPM schedule for an equipment asset
   */
  public async autoGeneratePpmForAsset(
    assetId: string,
    assetName: string,
    category: 'RMU' | 'DG_SET' | 'TRANSFORMER' | 'HT_PANEL' | 'LT_KIOSK',
    startDate: Date = new Date()
  ): Promise<PPMTaskInstance[]> {
    const tasks: PPMTaskInstance[] = [];
    const base = new Date(startDate);

    // 1. Daily tasks (Next 7 days)
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      tasks.push({
        id: `ppm-${assetId}-daily-${dateStr}`,
        assetId,
        assetName,
        category,
        frequency: 'DAILY',
        scheduledDate: dateStr,
        dueDate: dateStr,
        status: 'SCHEDULED',
        itemResponses: {}
      });
    }

    // 2. Weekly tasks (Next 4 weeks)
    for (let w = 1; w <= 4; w++) {
      const d = new Date(base);
      d.setDate(d.getDate() + (w * 7));
      const dateStr = d.toISOString().split('T')[0];
      tasks.push({
        id: `ppm-${assetId}-weekly-${dateStr}`,
        assetId,
        assetName,
        category,
        frequency: 'WEEKLY',
        scheduledDate: dateStr,
        dueDate: dateStr,
        status: 'SCHEDULED',
        itemResponses: {}
      });
    }

    // 3. Monthly tasks (Next 3 months)
    for (let m = 1; m <= 3; m++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + m);
      const dateStr = d.toISOString().split('T')[0];
      tasks.push({
        id: `ppm-${assetId}-monthly-${dateStr}`,
        assetId,
        assetName,
        category,
        frequency: 'MONTHLY',
        scheduledDate: dateStr,
        dueDate: dateStr,
        status: 'SCHEDULED',
        itemResponses: {}
      });
    }

    // 4. Quarterly task
    const qDate = new Date(base);
    qDate.setMonth(qDate.getMonth() + 3);
    const qDateStr = qDate.toISOString().split('T')[0];
    tasks.push({
      id: `ppm-${assetId}-quarterly-${qDateStr}`,
      assetId,
      assetName,
      category,
      frequency: 'QUARTERLY',
      scheduledDate: qDateStr,
      dueDate: qDateStr,
      status: 'SCHEDULED',
      itemResponses: {}
    });

    // 5. Yearly task
    const yDate = new Date(base);
    yDate.setFullYear(yDate.getFullYear() + 1);
    const yDateStr = yDate.toISOString().split('T')[0];
    tasks.push({
      id: `ppm-${assetId}-yearly-${yDateStr}`,
      assetId,
      assetName,
      category,
      frequency: 'YEARLY',
      scheduledDate: yDateStr,
      dueDate: yDateStr,
      status: 'SCHEDULED',
      itemResponses: {}
    });

    // Upsert into Supabase
    try {
      const payloads = tasks.map(t => ({
        asset_id: t.assetId,
        asset_name: t.assetName,
        category: t.category,
        frequency: t.frequency,
        scheduled_date: t.scheduledDate,
        due_date: t.dueDate,
        status: t.status,
        item_responses: t.itemResponses
      }));

      await supabase.from('ht_ppm_schedules').upsert(payloads, { onConflict: 'asset_id,frequency,scheduled_date' });
    } catch (e) {
      console.warn('[htPpmSchedulerService] Supabase schedule upsert failed:', e);
    }

    // Update local cache
    const current = this.getLocalTasks();
    const merged = [...current];
    tasks.forEach(t => {
      const exists = merged.findIndex(m => m.id === t.id);
      if (exists >= 0) merged[exists] = t;
      else merged.push(t);
    });

    this.saveLocalTasks(merged);
    return tasks;
  }

  /**
   * Complete and sign off a PPM task in Supabase and Local Cache
   */
  public async completeTask(
    taskId: string,
    completedBy: string,
    itemResponses: Record<string, any>,
    overallRemarks: string = ''
  ): Promise<PPMTaskInstance | undefined> {
    const tasks = this.getLocalTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      tasks[idx].status = 'COMPLETED';
      tasks[idx].completedDate = new Date().toISOString();
      tasks[idx].completedBy = completedBy;
      tasks[idx].itemResponses = itemResponses;
      tasks[idx].overallRemarks = overallRemarks;
      tasks[idx].score = 100;
      this.saveLocalTasks(tasks);
    }

    // Update in Supabase
    try {
      await supabase
        .from('ht_ppm_schedules')
        .update({
          status: 'COMPLETED',
          completed_date: new Date().toISOString(),
          completed_by: completedBy,
          item_responses: itemResponses,
          overall_remarks: overallRemarks,
          score: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
    } catch (e) {
      console.warn('[htPpmSchedulerService] Supabase completion update failed:', e);
    }

    return idx >= 0 ? tasks[idx] : undefined;
  }

  private getLocalTasks(): PPMTaskInstance[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load local PPM tasks', e);
    }
    return [];
  }

  private saveLocalTasks(tasks: PPMTaskInstance[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(tasks));
      }
    } catch (e) {
      console.error('Failed to save local PPM tasks', e);
    }
  }
}

export const htPpmSchedulerService = new HTPpmSchedulerService();
